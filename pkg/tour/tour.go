// Package tour stores learning progress only; examples never touch business data.
package tour

import (
	"github.com/juju/errors"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"time"
)

// Increment Version for each release; only revise affected chapters.
const Version = 1

type Step struct {
	ID           string   `json:"id"`
	Revision     int      `json:"revision"`
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	SeenRevision int      `json:"seen_revision"`
	Changes      []string `json:"changes"`
	Capabilities []string `json:"capabilities"`
}
type State struct {
	Version     int    `json:"version"`
	SeenVersion int    `json:"seen_version"`
	Steps       []Step `json:"steps"`
}
type progress struct {
	UserID   string `gorm:"primaryKey"`
	StepID   string `gorm:"primaryKey"`
	Revision int
	ViewedAt time.Time
}

func (progress) TableName() string { return "auth_tour_progress" }

type change struct {
	version int
	text    string
}
type chapter struct {
	id, title, description string
	revision               int
	admin                  bool
	action                 string
	capabilities           []string
	changes                []change
}

var catalogue = []chapter{
	{id: "overview", revision: 1, title: "Prendre ses repères", description: "Choisir un budget et lire la situation des paiements depuis l’accueil."},
	{id: "directory", revision: 1, title: "Retrouver un membre depuis son lot", description: "Rechercher dans l’annuaire ou cliquer sur la carte pour consulter tous les membres d’un lot.", capabilities: []string{"member.CreateMember", "member.UpdateMember", "unit.UpdateUnit"}},
	{id: "budgets", revision: 1, title: "Comprendre le budget et les cotisations", description: "Distinguer le prévisionnel d’un budget publié, puis lire les montants appelés et réglés.", capabilities: []string{"budget.CreateBudget", "budget.CreateExpense", "budget.PublishBudget"}},
	{id: "payments", revision: 1, action: "budget.CreatePayment", title: "Enregistrer un règlement", description: "Saisir un paiement sur une cotisation et vérifier le montant restant dû.", capabilities: []string{"budget.CreateRefund", "budget.CreateAdjustment"}},
	{id: "emails", revision: 1, title: "Suivre les e-mails de l’association", description: "Consulter les campagnes et distinguer les messages en attente, envoyés et en erreur.", capabilities: []string{"email.CreateEmailTemplate", "budget.SendEmail", "email.SendEmail"}},
	{id: "access", revision: 1, admin: true, title: "Accueillir un nouvel utilisateur", description: "Distinguer l’activation d’un compte, ses autorisations et son rôle dans l’association."},
	{id: "mailings", revision: 1, admin: true, title: "Mettre à jour les listes de diffusion", description: "Prévisualiser les écarts entre les membres de l’ASL et les listes OVH avant de les appliquer."},
}

func visible(user *auth.User, c chapter) bool {
	return user.Enabled && (!c.admin || user.Admin) && (c.action == "" || user.Allowed(c.action))
}
func stateFor(user *auth.User, rows []progress, chapters []chapter, version int) *State {
	s := &State{Version: version, SeenVersion: user.TourVersion, Steps: []Step{}}
	for _, c := range chapters {
		if !visible(user, c) {
			continue
		}
		step := Step{ID: c.id, Revision: c.revision, Title: c.title, Description: c.description, Capabilities: []string{}, Changes: []string{}}
		for _, row := range rows {
			if row.StepID == c.id {
				step.SeenRevision = row.Revision
			}
		}
		for _, action := range c.capabilities {
			if user.Allowed(action) {
				step.Capabilities = append(step.Capabilities, action)
			}
		}
		for _, note := range c.changes {
			if note.version > step.SeenRevision {
				step.Changes = append(step.Changes, note.text)
			}
		}
		s.Steps = append(s.Steps, step)
	}
	return s
}
func load(tx *gorm.DB, user *auth.User) (*State, error) {
	var rows []progress
	if err := tx.Where("user_id = ?", user.ID).Find(&rows).Error; err != nil {
		return nil, err
	}
	return stateFor(user, rows, catalogue, Version), nil
}
func activeUser(tx *gorm.DB, id string, lock bool) (*auth.User, error) {
	var user auth.User
	if lock {
		tx = tx.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	if err := tx.First(&user, "id = ?", id).Error; err != nil {
		return nil, err
	}
	if !user.Enabled {
		return nil, errors.NewForbidden(nil, "La visite nécessite un compte actif.")
	}
	return &user, nil
}
func Get(tx *gorm.DB, userID string) (*State, error) {
	user, err := activeUser(tx, userID, false)
	if err != nil {
		return nil, err
	}
	return load(tx, user)
}

// MarkSeen is scoped to the authenticated user. Recheck rights under a row lock,
// validate the exact catalogue revision and serialize concurrent tabs.
func MarkSeen(conn *gorm.DB, userID string, version int, stepID string, revision int) (*State, error) {
	var result *State
	err := conn.Transaction(func(tx *gorm.DB) error {
		user, err := activeUser(tx, userID, true)
		if err != nil {
			return err
		}
		if version != Version {
			return errors.NewAlreadyExists(nil, "La visite a changé. Recharge-la pour découvrir la version actuelle.")
		}
		var allowed bool
		for _, c := range catalogue {
			if c.id == stepID && c.revision == revision && visible(user, c) {
				allowed = true
			}
		}
		if !allowed {
			return errors.NewBadRequest(nil, "Cette étape n’est plus disponible avec tes droits ou cette révision.")
		}
		row := progress{UserID: userID, StepID: stepID, Revision: revision, ViewedAt: time.Now().UTC()}
		if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "user_id"}, {Name: "step_id"}}, DoUpdates: clause.Assignments(map[string]any{"revision": gorm.Expr("GREATEST(auth_tour_progress.revision, EXCLUDED.revision)"), "viewed_at": row.ViewedAt})}).Create(&row).Error; err != nil {
			return err
		}
		result, err = load(tx, user)
		if err != nil {
			return err
		}
		complete := true
		for _, step := range result.Steps {
			if step.SeenRevision < step.Revision {
				complete = false
			}
		}
		if complete && user.TourVersion < Version {
			// Learning progress must not invalidate an open permissions form.
			if err := tx.Model(user).UpdateColumn("tour_version", Version).Error; err != nil {
				return err
			}
			result.SeenVersion = Version
		}
		return nil
	})
	return result, err
}
