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

const (
	WaitingValidation AccessLevel = 0
	Administrator     AccessLevel = 1
	Standard          AccessLevel = 2
)

// User represents an user which can open a session to the application
type User struct {
	db.Model

	// Username is the username of the user
	Username string `gorm:"uniqueIndex" json:"username"`

	// Level is the access level defined to the user
	Level AccessLevel `gorm:"default:0" json:"level"`

	// Actions are the allowed actions
	Actions pq.StringArray `gorm:"type:text[]" json:"actions,omitempty"`
}

// Allowed tells if user is allowed to execute the action
func (u *User) Allowed(action string) bool {
	if u.Level == WaitingValidation {
		return false
	}

	if u.Level == Administrator {
		return true
	}

	return slices.Contains(u.Actions, action)
}

// TableName give to gorm the table name to use
func (User) TableName() string {
	return "user"
}
