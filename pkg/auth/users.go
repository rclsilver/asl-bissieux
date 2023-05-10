package auth

import (
	"github.com/lib/pq"
	"golang.org/x/exp/slices"

	"github.com/rclsilver/asl-bissieux/pkg/db"
)

func init() {
	db.RegisterMigration(&User{})
}

// AccessLevel is a type which represents an access level
type AccessLevel int

// User represents an user which can open a session to the application
type User struct {
	db.Model

	Username string         `gorm:"uniqueIndex;notNull" json:"username"`
	Enabled  bool           `gorm:"default:false;notNull" json:"enabled"`
	Admin    bool           `gorm:"default:false;notNull" json:"admin"`
	Actions  pq.StringArray `gorm:"type:text[]" json:"actions,omitempty"`
}

// Allowed tells if user is allowed to execute the action
func (u *User) Allowed(action string) bool {
	if u.Enabled {
		return false
	}

	if u.Admin {
		return true
	}

	return slices.Contains(u.Actions, action)
}

// TableName give to gorm the table name to use
func (User) TableName() string {
	return "user"
}
