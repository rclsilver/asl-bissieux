package auth

import (
	"gorm.io/gorm"
	"time"
)

type AccessRequest struct {
	UserID     string `gorm:"primaryKey"`
	CreatedAt  time.Time
	Status     string
	ResolvedAt *time.Time
	ResolvedBy *string
}

func (AccessRequest) TableName() string { return "auth_access_request" }

type UserIdentity struct {
	Issuer  string `json:"issuer"`
	Subject string `json:"subject"`
	UserID  string `json:"-"`
}

// EnrichAccess leaves stored permissions and account identity untouched.
// Identity metadata is restricted to the administrator account views.
func EnrichAccess(tx *gorm.DB, users []*User, identities bool) error {
	if len(users) == 0 {
		return nil
	}
	ids := make([]string, 0, len(users))
	for _, u := range users {
		ids = append(ids, u.ID)
		u.Identities = nil
		u.AccessStatus = "disabled"
		if u.Enabled {
			u.AccessStatus = "active"
		}
	}
	var requests []AccessRequest
	if err := tx.Where("user_id IN ?", ids).Find(&requests).Error; err != nil {
		return err
	}
	for _, u := range users {
		if !u.Enabled {
			for _, r := range requests {
				if r.UserID == u.ID && (r.Status == "pending" || r.Status == "rejected") {
					u.AccessStatus = r.Status
					break
				}
			}
		}
	}
	if identities {
		var rows []UserIdentity
		if err := tx.Table("auth_identity").Where("user_id IN ?", ids).Scan(&rows).Error; err != nil {
			return err
		}
		for _, u := range users {
			u.Identities = make([]UserIdentity, 0)
			for _, r := range rows {
				if r.UserID == u.ID {
					u.Identities = append(u.Identities, r)
				}
			}
		}
	}
	return nil
}
