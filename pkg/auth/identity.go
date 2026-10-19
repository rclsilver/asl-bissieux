package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/rclsilver/asl-bissieux/pkg/db"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

type Identity struct {
	Issuer    string
	Subject   string
	UserID    string
	CreatedAt time.Time
}

func (Identity) TableName() string { return "auth_identity" }

// Authorization codes, PKCE verifiers and session/CSRF hashes must not enter SQL logs.
func authDB(ctx context.Context) *gorm.DB {
	return db.Connection(ctx).WithContext(ctx).Session(&gorm.Session{Logger: logger.Discard})
}

func identityLock(tx *gorm.DB, issuer, subject string) error {
	key, _ := json.Marshal([]string{issuer, subject})
	return tx.Exec("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", string(key)).Error
}

// LinkIdentity is an explicit operator action. It cannot move an existing link.
func LinkIdentity(ctx context.Context, issuer, subject, userID string) error {
	if issuer == "" || subject == "" || userID == "" {
		return fmt.Errorf("issuer, subject and user ID are required")
	}
	return authDB(ctx).Transaction(func(tx *gorm.DB) error {
		if err := identityLock(tx, issuer, subject); err != nil {
			return err
		}
		var user User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, "id = ?", userID).Error; err != nil {
			return fmt.Errorf("target account does not exist")
		}
		var identity Identity
		err := tx.First(&identity, "issuer = ? AND subject = ?", issuer, subject).Error
		if err == nil {
			if identity.UserID != user.ID {
				return fmt.Errorf("identity already belongs to another account")
			}
			return nil
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		return tx.Create(&Identity{Issuer: issuer, Subject: subject, UserID: user.ID}).Error
	})
}

// The transitional Google provider already authenticates this exact Google credential.
// Capture its immutable subject before moving production to OIDC. An established link
// wins over email, and a reassigned email cannot acquire another subject's account.
func resolveLegacyGoogleIdentity(ctx context.Context, subject, email string) (*User, error) {
	const issuer = "https://accounts.google.com"
	var user User
	err := authDB(ctx).Transaction(func(tx *gorm.DB) error {
		if err := identityLock(tx, issuer, subject); err != nil {
			return err
		}
		var identity Identity
		err := tx.First(&identity, "issuer = ? AND subject = ?", issuer, subject).Error
		if err == nil {
			return tx.First(&user, "id = ?", identity.UserID).Error
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, "username = ?", email).Error
		if err == gorm.ErrRecordNotFound {
			if !cfg.CreateUser {
				return fmt.Errorf("account is not registered")
			}
			user = *NewUser(email, false, false, nil)
			if err := tx.Create(&user).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		}
		var established int64
		if err := tx.Model(&Identity{}).Where("issuer = ? AND user_id = ?", issuer, user.ID).Count(&established).Error; err != nil {
			return err
		}
		if established != 0 {
			return fmt.Errorf("account requires explicit identity association")
		}
		return tx.Create(&Identity{Issuer: issuer, Subject: subject, UserID: user.ID}).Error
	})
	return &user, err
}

func resolveIdentity(ctx context.Context, issuer, subject, email string) (*User, error) {
	var user User
	err := authDB(ctx).Transaction(func(tx *gorm.DB) error {
		if err := identityLock(tx, issuer, subject); err != nil {
			return err
		}
		var identity Identity
		err := tx.First(&identity, "issuer = ? AND subject = ?", issuer, subject).Error
		if err == nil {
			return tx.First(&user, "id = ?", identity.UserID).Error
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		if !cfg.CreateUser {
			return fmt.Errorf("identity is not linked to an account")
		}
		// A collision with an existing username requires an explicit link. Never merge by email.
		user = *NewUser(email, false, false, nil)
		if err := tx.Create(&user).Error; err != nil {
			return fmt.Errorf("account requires an explicit identity link")
		}
		return tx.Create(&Identity{Issuer: issuer, Subject: subject, UserID: user.ID}).Error
	})
	return &user, err
}
