package models

import (
	"github.com/rclsilver/asl-bissieux/pkg/db"
)

func init() {
	db.RegisterMigration(&Member{})
}

type Member struct {
	db.Model

	FirstName string `json:"first_name" gorm:"notNull"`
	LastName  string `json:"last_name" gorm:"notNull"`

	PhoneNumber string `json:"phone_number"`
	Email       string `json:"email"`
	Address     string `json:"address"`

	Units []*Unit `json:"units,omitempty" gorm:"many2many:member_unit"`
}

func NewMember(firstName, lastName, phoneNumber, email, address string) *Member {
	return &Member{
		FirstName:   firstName,
		LastName:    lastName,
		PhoneNumber: phoneNumber,
		Email:       email,
		Address:     address,
	}
}

// TableName give to gorm the table name to use
func (Member) TableName() string {
	return "member"
}
