package people

import (
	"github.com/lib/pq"
	"github.com/rclsilver/asl-bissieux/pkg/db"
)

func init() {
	db.RegisterMigration(&Member{})
}

type Member struct {
	db.Model

	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`

	PhoneNumber *string `json:"phone_number"`
	Email       *string `json:"email"`

	Units pq.Int32Array `json:"units,omitempty" gorm:"type:integer[]"`
}

func New(firstName, lastName, phoneNumber, email string, units []int32) *Member {
	m := &Member{
		FirstName: firstName,
		LastName:  lastName,
		Units:     units,
	}

	if len(phoneNumber) > 0 {
		m.PhoneNumber = &phoneNumber
	}

	if len(email) > 0 {
		m.Email = &email
	}

	return m
}

// TableName give to gorm the table name to use
func (Member) TableName() string {
	return "member"
}
