package controllers

import (
	"context"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/juju/errors"
	"github.com/sirupsen/logrus"

	"github.com/gomarkdown/markdown"
	"github.com/gomarkdown/markdown/html"
	"github.com/gomarkdown/markdown/parser"

	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/smtp"
	"github.com/rclsilver/asl-bissieux/pkg/templates"
)

func ListEmailTemplates(tx *gorm.DB) ([]*models.EmailTemplate, error) {
	var result []*models.EmailTemplate

	return result, tx.Preload("Attachments").Find(&result).Error
}

func GetEmailTemplate(tx *gorm.DB, templateID string) (*models.EmailTemplate, error) {
	if err := validateUUID(templateID); err != nil {
		return nil, errors.NewNotFound(nil, fmt.Sprintf("email template %q not found", templateID))
	}

	var row models.EmailTemplate

	if err := tx.First(&row, "id = ?", templateID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("email template %q not found", templateID))
		}
		return nil, err
	}

	return &row, nil
}

func CreateEmailTemplate(tx *gorm.DB, label, subject, message string) (*models.EmailTemplate, error) {
	row := models.NewEmailTemplate(label, subject, message)

	if err := tx.Create(row).Error; err != nil {
		return nil, err
	}

	return row, nil
}

func UpdateEmailTemplate(tx *gorm.DB, templateID, label, subject, message string) (*models.EmailTemplate, error) {
	row, err := GetEmailTemplate(tx, templateID)
	if err != nil {
		return nil, err
	}

	row.Label = label
	row.Subject = subject
	row.Message = message

	if err := tx.Where("id = ?", templateID).Updates(row).Error; err != nil {
		return nil, err
	}

	return row, nil
}

func DeleteEmailTemplate(tx *gorm.DB, templateID string) error {
	if err := validateUUID(templateID); err != nil {
		return errors.NewNotFound(nil, fmt.Sprintf("email template %q not found", templateID))
	}

	return tx.Delete(&models.EmailTemplate{}, "id = ?", templateID).Error
}

func PreviewEmailTemplate(tx *gorm.DB, templateID string, data map[string]any) (*models.BuiltEmail, error) {
	template, err := GetEmailTemplate(tx, templateID)
	if err != nil {
		return nil, err
	}

	t, err := templates.NewTemplate(data)
	if err != nil {
		return nil, err
	}

	subject, err := t.Execute(template.Subject)
	if err != nil {
		return nil, errors.NewBadRequest(err, "unable to build the subject")
	}

	mdMessage, err := t.Execute(template.Message)
	if err != nil {
		return nil, errors.NewBadRequest(err, "unable to build the message")
	}

	message, err := ToHTML(mdMessage)
	if err != nil {
		return nil, errors.NewBadRequest(err, "unable to convert the message")
	}

	return &models.BuiltEmail{
		Subject: string(subject),
		Message: string(message),
	}, nil
}

func ListAttachments(tx *gorm.DB, templateID string) ([]*models.Attachment, error) {
	template, err := GetEmailTemplate(tx, templateID)
	if err != nil {
		return nil, err
	}

	var result []*models.Attachment

	return result, tx.Find(&result, "email_template_id = ?", template.ID).Error
}

func AddAttachment(tx *gorm.DB, templateID, name string, inline bool, contentType string, content []byte) (*models.Attachment, error) {
	template, err := GetEmailTemplate(tx, templateID)
	if err != nil {
		return nil, err
	}

	row := models.NewAttachment(template.ID, name, inline, content, contentType)

	if err := tx.Create(row).Error; err != nil {
		return nil, err
	}

	return row, nil
}

func GetAttachment(tx *gorm.DB, templateID, attachmentID string) (*models.Attachment, error) {
	if err := validateUUID(templateID); err != nil {
		return nil, errors.NewNotFound(nil, fmt.Sprintf("attachment %q not found", attachmentID))
	}

	if err := validateUUID(attachmentID); err != nil {
		return nil, errors.NewNotFound(nil, fmt.Sprintf("attachment %q not found", attachmentID))
	}

	var row models.Attachment

	if err := tx.First(&row, "id = ? AND email_template_id = ?", attachmentID, templateID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("attachment %q not found for email template %q", attachmentID, templateID))
		}
		return nil, err
	}

	return &row, nil
}

func DeleteAttachment(tx *gorm.DB, templateID, attachmentID string) error {
	attachment, err := GetAttachment(tx, templateID, attachmentID)
	if err != nil {
		return err
	}

	return tx.Delete(attachment).Error
}

func ListEmails(tx *gorm.DB) ([]*models.Email, error) {
	var result []*models.Email

	if err := tx.Order("created_at ASC").Preload("EmailTemplate").Find(&result).Error; err != nil {
		return nil, err
	}

	for _, email := range result {
		if email.State == models.Waiting || email.State == models.Error {
			if err := buildEmail(email); err != nil {
				return nil, err
			}
		}
	}

	return result, nil
}

func GetEmail(tx *gorm.DB, emailID string, lock bool) (*models.Email, error) {
	if err := validateUUID(emailID); err != nil {
		return nil, errors.NewNotFound(nil, fmt.Sprintf("email %q not found", emailID))
	}

	var row models.Email

	if lock {
		tx = tx.Clauses(clause.Locking{Strength: "UPDATE"})
	}

	if err := tx.Preload("EmailTemplate.Attachments").First(&row, "id = ?", emailID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("email %q not found", emailID))
		}
		return nil, err
	}

	if row.State == models.Waiting || row.State == models.Error {
		if err := buildEmail(&row); err != nil {
			return nil, err
		}
	}

	return &row, nil
}

func DeleteEmail(tx *gorm.DB, emailID string) error {
	if err := validateUUID(emailID); err != nil {
		return errors.NewNotFound(nil, fmt.Sprintf("email %q not found", emailID))
	}

	return tx.Delete(&models.Email{}, "id = ?", emailID).Error
}

func SendEmail(c context.Context, tx *gorm.DB, emailID string, wait bool) error {
	email, err := GetEmail(tx, emailID, true)
	if err != nil {
		return err
	}

	if email.State != models.Waiting && email.State != models.Error {
		return errors.BadRequestf("cannot send an email which has %s state", email.State)
	}

	done := make(chan error)

	go func() {
		if err := buildEmail(email); err != nil {
			email.State = models.Error
			email.Error = err.Error()
			logrus.WithContext(c).WithError(err).Errorf("unable to build the email %s to %s (%s)", email.Subject, email.To, email.ID)
		} else {
			var attachments []*smtp.Attachment
			for _, attachment := range email.EmailTemplate.Attachments {
				attachments = append(attachments, smtp.NewAttachment(attachment.Name, attachment.ContentType, attachment.Content, attachment.Inline))
			}

			if err := smtp.Send(c, email.To, email.Subject, email.Message, email.ID, attachments...); err != nil {
				email.State = models.Error
				email.Error = err.Error()
				logrus.WithContext(c).WithError(err).Errorf("email %s to %s (%s) not sent", email.Subject, email.To, email.ID)
			} else {
				email.State = models.Sent
				email.Error = ""
				logrus.WithContext(c).Infof("email %s to %s (%s) sent", email.Subject, email.To, email.ID)
			}
		}

		if err := tx.Model(email).Where("id = ?", emailID).Updates(map[string]any{
			"subject": email.Subject,
			"message": email.Message,
			"state":   email.State,
			"error":   email.Error,
		}).Error; err != nil {
			logrus.WithContext(c).WithError(err).Error("unable to update email")
		}

		if email.Error != "" {
			done <- fmt.Errorf(email.Error)
		} else {
			done <- nil
		}
	}()

	if wait {
		return <-done
	}

	return nil
}

func MarkAsRead(c context.Context, tx *gorm.DB, emailID string) error {
	if err := tx.Model(&models.Email{}).Where("id = ?", emailID).Updates(map[string]any{
		"state": models.Read,
	}).Error; err != nil {
		return err
	}
	return nil
}

func BuildEmail(template *models.EmailTemplate, t *templates.Template) (*models.BuiltEmail, error) {
	subject, err := t.Execute(template.Subject)
	if err != nil {
		return nil, errors.NewBadRequest(err, "unable to build the subject")
	}

	mdMessage, err := t.Execute(template.Message)
	if err != nil {
		return nil, errors.NewBadRequest(err, "unable to build the message")
	}

	message, err := ToHTML(mdMessage)
	if err != nil {
		return nil, errors.NewBadRequest(err, "unable to convert the message")
	}

	return &models.BuiltEmail{
		Subject: string(subject),
		Message: string(message),
	}, nil
}

func buildEmail(email *models.Email) error {
	t, err := templates.NewTemplate(email.Context)
	if err != nil {
		return err
	}

	subject, err := t.Execute(email.EmailTemplate.Subject)
	if err != nil {
		return err
	}
	email.Subject = string(subject)

	mdMessage, err := t.Execute(email.EmailTemplate.Message)
	if err != nil {
		return err
	}

	message, err := ToHTML(mdMessage)
	if err != nil {
		return err
	}
	email.Message = string(message)

	return nil
}

// ToHTML convert a MarkDown content in HTML
func ToHTML(md []byte) ([]byte, error) {
	extensions := parser.CommonExtensions | parser.NoEmptyLineBeforeBlock
	p := parser.NewWithExtensions(extensions)
	doc := p.Parse(md)

	// create HTML renderer with extensions
	htmlFlags := html.CommonFlags | html.HrefTargetBlank
	opts := html.RendererOptions{Flags: htmlFlags}
	renderer := html.NewRenderer(opts)

	return markdown.Render(doc, renderer), nil
}
