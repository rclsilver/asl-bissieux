package auth

import (
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/juju/errors"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/db"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Serialize role changes and recheck the actor after acquiring the lock. A
// previously authorized request cannot demote a second administrator afterward.
func administrativeWrite(c *gin.Context, fn func(*gorm.DB, *auth.User) error) error {
	return db.Connection(c).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SELECT pg_advisory_xact_lock(714067239106)").Error; err != nil {
			return err
		}
		actor, err := GetCurrentUser(c)
		if err != nil {
			return err
		}
		var current auth.User
		if err := tx.First(&current, "id = ?", actor.ID).Error; err != nil || !current.Enabled || !current.Admin {
			return errors.NewForbidden(nil, "L’administration nécessite un compte administrateur actif.")
		}
		return fn(tx, &current)
	})
}

func protectLastAdministrator(tx *gorm.DB, row *auth.User, enabled, admin bool) error {
	if !row.Enabled || !row.Admin || (enabled && admin) {
		return nil
	}
	var count int64
	if err := tx.Model(&auth.User{}).Where("enabled = true AND admin = true").Count(&count).Error; err != nil {
		return err
	}
	if count <= 1 {
		return errors.NewBadRequest(nil, "Le dernier administrateur actif doit être conservé. Active d’abord un autre administrateur.")
	}
	return nil
}

func validateUserInput(in *createUserIn, old *auth.User) error {
	in.Username = strings.TrimSpace(in.Username)
	if len(in.Username) == 0 || len(in.Username) > 320 {
		return errors.NewBadRequest(nil, "Indique un compte de 1 à 320 caractères.")
	}
	actionsMut.Lock()
	known := append([]string{}, actions...)
	actionsMut.Unlock()
	for _, action := range in.Actions {
		if !slices.Contains(known, action) && (old == nil || !slices.Contains(old.Actions, action)) {
			return errors.NewBadRequest(nil, "Autorisation inconnue : "+action)
		}
	}
	return nil
}

func resolveAccess(tx *gorm.DB, row *auth.User, actor *auth.User) error {
	var request auth.AccessRequest
	result := tx.First(&request, "user_id = ?", row.ID)
	if result.Error == gorm.ErrRecordNotFound {
		return nil
	}
	if result.Error != nil {
		return result.Error
	}
	status := "disabled"
	if row.Enabled {
		status = "approved"
	} else if request.Status == "pending" || request.Status == "rejected" {
		status = "rejected"
	}
	now := time.Now()
	return tx.Model(&request).Updates(map[string]any{"status": status, "resolved_at": now, "resolved_by": actor.ID}).Error
}
func revokeDisabledSessions(tx *gorm.DB, row *auth.User) error {
	if row.Enabled {
		return nil
	}
	return tx.Exec("DELETE FROM auth_session WHERE user_id = ?", row.ID).Error
}

func lockedUser(tx *gorm.DB, id string) (*auth.User, error) {
	var row auth.User
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&row, "id = ?", id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, errors.NewNotFound(nil, "Compte introuvable.")
	}
	return &row, err
}

type AccessRequestSummary struct {
	Pending int64 `json:"pending"`
}

func PendingAccessRequests(c *gin.Context) (*AccessRequestSummary, error) {
	var result AccessRequestSummary
	err := db.Connection(c).Table("auth_access_request r").Select("COUNT(*) pending").Joins(`JOIN "user" u ON u.id=r.user_id AND u.deleted_at IS NULL AND u.enabled=false`).Where("r.status = ?", "pending").Scan(&result).Error
	return &result, err
}

func validateAccessDecision(row *auth.User, in *updateUserIn) error {
	valid := in.AccessDecision == ""
	switch in.AccessDecision {
	case "approve":
		valid = row.AccessStatus == "pending" && in.Enabled
	case "reject":
		valid = row.AccessStatus == "pending" && !in.Enabled
	case "disable":
		valid = row.Enabled && !in.Enabled
	case "reactivate":
		valid = !row.Enabled && row.AccessStatus != "pending" && in.Enabled
	}
	if !valid {
		return errors.NewBadRequest(nil, "Cette décision ne correspond plus à l’état du compte. Actualise sa fiche.")
	}
	return nil
}
