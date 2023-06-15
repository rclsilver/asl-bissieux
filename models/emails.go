package models

import (
	"github.com/rclsilver/asl-bissieux/pkg/db"
)

func init() {
	db.RegisterMigration(&EmailTemplate{})
	db.RegisterMigration(&Attachment{})
	db.RegisterMigration(&Email{})
}

type BuiltEmail struct {
	Subject string `json:"subject"`
	Message string `json:"message"`
}

type EmailTemplate struct {
	db.Model

	Label   string `json:"label" gorm:"notNull"`
	Subject string `json:"subject" gorm:"notNull"`
	Message string `json:"message" gorm:"notNull"`

	Attachments []*Attachment `json:"attachments,omitempty"`
	Emails      []*Email      `json:"emails,omitempty"`
}

func NewEmailTemplate(label, subject, message string) *EmailTemplate {
	return &EmailTemplate{
		Label:   label,
		Subject: subject,
		Message: message,
	}
}

func (EmailTemplate) TableName() string {
	return "email_template"
}

type Attachment struct {
	db.Model

	Name        string `json:"name" gorm:"notNull"`
	Size        int    `json:"size" gorm:"notNull"`
	Content     []byte `json:"-" gorm:"type:bytea;notNull"`
	ContentType string `json:"content_type" gorm:"notNull"`
	Inline      bool   `json:"inline" gorm:"notNull;default:false"`

	EmailTemplateID string         `json:"template_id" gorm:"notNull"`
	EmailTemplate   *EmailTemplate `json:"template,omitempty" gorm:"notNull;references:ID"`
}

func NewAttachment(templateID, name string, inline bool, content []byte, contentType string) *Attachment {
	return &Attachment{
		Name:            name,
		Inline:          inline,
		Size:            len(content),
		Content:         content,
		ContentType:     contentType,
		EmailTemplateID: templateID,
	}
}

func (Attachment) TableName() string {
	return "attachment"
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

	To      string         `json:"to" gorm:"notNull"`
	Context map[string]any `json:"context" gorm:"serializer:json;type:jsonb;notNull"`

	Subject string `json:"subject,omitempty"`
	Message string `json:"message,omitempty"`

	EmailTemplateID string         `json:"template_id" gorm:"notNull"`
	EmailTemplate   *EmailTemplate `json:"template,omitempty" gorm:"notNull;references:ID"`

	State EmailState `json:"state" gorm:"notNull;default:WAITING"`
	Error string     `json:"error,omitempty"`
}

func NewEmail(template *EmailTemplate, to string, context map[string]any) *Email {
	return &Email{
		EmailTemplateID: template.ID,
		To:              to,
		Context:         context,
		State:           Waiting,
	}
}

func (Email) TableName() string {
	return "email"
}
