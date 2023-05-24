package models

import (
	"github.com/rclsilver/asl-bissieux/pkg/db"
)

func init() {
	db.RegisterMigration(&Email{})
}

type EmailState string

const (
	Waiting EmailState = "WAITING"
	Sent    EmailState = "SENT"
	Error   EmailState = "ERROR"
	Read    EmailState = "READ"
)

type Email struct {
	db.Model

	To string `gorm:"notNull" json:"to"`

	Subject string `json:"subject" gorm:"notNull"`
	Message string `json:"message" gorm:"notNull"`

	State EmailState `json:"state" gorm:"notNull;default:WAITING"`
	Error string     `json:"error,omitempty"`
}

func NewEmail(to, subject, message string) *Email {
	return &Email{
		To:      to,
		Subject: subject,
		Message: message,
		State:   Waiting,
	}
}

// TableName give to gorm the table name to use
func (Email) TableName() string {
	return "email"
}
