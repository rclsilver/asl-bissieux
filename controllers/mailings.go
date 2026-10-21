package controllers

import (
	"context"
	"strings"
	"time"

	"github.com/juju/errors"
	"gorm.io/gorm"

	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/mailings"
)

var loadMailingConfig = mailings.LoadConfig
var newMailingProvider = func(cfg *mailings.Config) (mailings.Provider, error) { return mailings.NewClient(cfg) }

func mailingPlan(tx *gorm.DB, cfg *mailings.Config, provider mailings.Provider) (*mailings.Plan, error) {
	var rows []models.Member
	if err := tx.Select("id", "email", "bureau", "first_name", "last_name").Order("id").Find(&rows).Error; err != nil {
		return nil, err
	}
	members := make([]mailings.Member, 0, len(rows))
	for _, m := range rows {
		members = append(members, mailings.Member{ID: m.ID, Email: m.Email, Bureau: m.Bureau, Name: strings.TrimSpace(m.FirstName + " " + m.LastName)})
	}
	current := map[string][]string{}
	pending := map[string][]int64{}
	for _, name := range []string{cfg.Members, cfg.Bureau} {
		var err error
		pending[name], err = provider.Pending(tx.Statement.Context, name)
		if err != nil {
			return nil, errors.NewNotValid(nil, "Impossible de vérifier les tâches OVH en cours ; aucune nouvelle synchronisation autorisée")
		}
		current[name], err = provider.Subscribers(tx.Statement.Context, name)
		if err != nil {
			return nil, errors.NewNotValid(nil, "Impossible de lire les abonnés OVH")
		}
	}
	return mailings.BuildPlan(cfg, members, current, pending), nil
}
func PreviewMailingLists(tx *gorm.DB) (*mailings.Plan, error) {
	cfg, err := loadMailingConfig()
	if err != nil {
		return nil, errors.NewNotValid(nil, "Configuration OVH indisponible ou invalide")
	}
	if cfg == nil {
		return &mailings.Plan{Lists: []mailings.ListPlan{}, Invalid: []mailings.InvalidMember{}}, nil
	}
	provider, err := newMailingProvider(cfg)
	if err != nil {
		return nil, errors.NewNotValid(nil, "Client OVH indisponible")
	}
	ctx, cancel := context.WithTimeout(tx.Statement.Context, 30*time.Second)
	defer cancel()
	return mailingPlan(tx.WithContext(ctx), cfg, provider)
}
func mailingVerified(plan *mailings.Plan) bool {
	if plan == nil || !plan.Configured || len(plan.Invalid) > 0 {
		return false
	}
	for _, l := range plan.Lists {
		if len(l.Add)+len(l.Remove)+len(l.PendingTasks) > 0 {
			return false
		}
	}
	return true
}
func SyncMailingLists(conn *gorm.DB, expected string) (*mailings.Result, error) {
	ctx, cancel := context.WithTimeout(conn.Statement.Context, 90*time.Second)
	defer cancel()
	tx := conn.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer tx.Rollback()
	var locked bool
	if err := tx.Raw("SELECT pg_try_advisory_xact_lock(724918326)").Scan(&locked).Error; err != nil {
		return nil, err
	}
	if !locked {
		return nil, errors.NewAlreadyExists(nil, "Une synchronisation OVH est déjà en cours")
	}
	cfg, err := loadMailingConfig()
	if err != nil || cfg == nil {
		return nil, errors.NewBadRequest(nil, "Configuration OVH absente ou invalide")
	}
	provider, err := newMailingProvider(cfg)
	if err != nil {
		return nil, errors.NewNotValid(nil, "Client OVH indisponible")
	}
	before, err := mailingPlan(tx, cfg, provider)
	if err != nil {
		return nil, err
	}
	if expected == "" || expected != before.Token {
		return nil, errors.NewBadRequest(nil, "Les membres, la configuration ou les listes OVH ont changé. Actualise l’aperçu.")
	}
	if !before.CanApply {
		return nil, errors.NewBadRequest(nil, "Aucune modification applicable : vérifie les e-mails et les tâches OVH en cours")
	}
	failed := false
	// Add first. If an API call fails or times out, stop and re-read; never retry a
	// request whose outcome is unknown, nor continue with removals automatically.
	for _, l := range before.Lists {
		for _, email := range l.Add {
			if err := provider.Add(ctx, l.Name, email); err != nil {
				failed = true
				break
			}
		}
		if failed {
			break
		}
	}
	if !failed {
		for _, l := range before.Lists {
			for _, email := range l.Remove {
				if err := provider.Remove(ctx, l.Name, email); err != nil {
					failed = true
					break
				}
			}
			if failed {
				break
			}
		}
	}
	after, readErr := mailingPlan(tx, cfg, provider)
	result := &mailings.Result{Plan: after, Partial: failed}
	if readErr != nil {
		result.Plan = nil
		result.Partial = true
		result.Message = "Le résultat OVH ne peut pas être confirmé. Vérifie les listes et recharge l’aperçu avant toute reprise."
	} else if mailingVerified(after) {
		result.Verified = true
		result.Partial = false
		result.Message = "Les deux listes OVH sont vérifiées à jour."
	} else if failed {
		result.Message = "La synchronisation est partielle ou son résultat est incertain. Recharge l’aperçu ; aucune nouvelle tentative automatique n’est lancée."
	} else {
		result.Message = "Demandes acceptées par OVH. Les listes ne sont pas encore vérifiées à jour : actualise après traitement des tâches."
	}
	// The transaction only serializes synchronizations. It does not imply that
	// OVH operations can be rolled back if a local transaction ends.
	if err := tx.Commit().Error; err != nil {
		return &mailings.Result{Partial: true, Message: "Les demandes OVH peuvent avoir été acceptées. Recharge l’aperçu pour vérifier leur résultat."}, nil
	}
	return result, nil
}
