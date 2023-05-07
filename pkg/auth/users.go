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
	waitingValidation AccessLevel = 0
	administrator     AccessLevel = 1
	standard          AccessLevel = 2
	disabled          AccessLevel = 3
)

// User represents an user which can open a session to the application
type User struct {
	db.Model

	// Username is the username of the user
	Username string `gorm:"uniqueIndex;notNull" json:"username"`

	// Level is the access level defined to the user
	Level AccessLevel `gorm:"default:0;notNull" json:"level"`

	// Actions are the allowed actions
	Actions pq.StringArray `gorm:"type:text[]" json:"actions,omitempty"`
}

// IsActive return true if the user is active
func (u *User) IsActive() bool {
	return u.Level != waitingValidation && u.Level != disabled
}

// IsAdmin return true if the user is an administrator
func (u *User) IsAdmin() bool {
	return u.Level == administrator
}

// Allowed tells if user is allowed to execute the action
func (u *User) Allowed(action string) bool {
	if u.Level == waitingValidation || u.Level == disabled {
		return false
	}

	if u.Level == administrator {
		return true
	}

	return slices.Contains(u.Actions, action)
}

// TableName give to gorm the table name to use
func (User) TableName() string {
	return "user"
}
