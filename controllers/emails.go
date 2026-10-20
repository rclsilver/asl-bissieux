package controllers

import (
	"context"
	"fmt"
	"time"

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

	if err := tx.Preload("Attachments").Find(&result).Error; err != nil {
		return nil, err
	}
	for _, row := range result {
		row.CustomFields = templates.DescribeFields(row.Subject, row.Message)
	}
	return result, nil
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

	row.CustomFields = templates.DescribeFields(row.Subject, row.Message)
	return &row, nil
}

func CreateEmailTemplate(tx *gorm.DB, label, subject, message string) (*models.EmailTemplate, error) {
	row := models.NewEmailTemplate(label, subject, message)
	row.CustomFields = templates.DescribeFields(subject, message)

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
	row.CustomFields = templates.DescribeFields(subject, message)

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

func ListEmailCampaigns(tx *gorm.DB) ([]*models.EmailCampaign, error) {
	var result []*models.EmailCampaign

	return result, tx.Order("created_at ASC").Preload("EmailTemplate").Preload("Emails").Find(&result).Error
}

func GetEmailCampaign(tx *gorm.DB, campaignID string) (*models.EmailCampaign, error) {
	if err := validateUUID(campaignID); err != nil {
		return nil, errors.NewNotFound(nil, fmt.Sprintf("campaign %q not found", campaignID))
	}

	var row models.EmailCampaign

	if err := tx.Preload("EmailTemplate").First(&row, "id = ?", campaignID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("campaign %q not found", campaignID))
		}
		return nil, err
	}

	return &row, nil
}

func CreateEmailCampaign(tx *gorm.DB, title, templateID string, data map[string]any) (*models.EmailCampaign, error) {
	template, err := GetEmailTemplate(tx, templateID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("email template %q not found", templateID))
		}
		return nil, err
	}

	row := models.NewEmailCampaign(title, template, data)

	if err := tx.Create(row).Error; err != nil {
		return nil, err
	}

	return row, nil
}

func DeleteEmailCampaign(tx *gorm.DB, campaignID string) error {
	if err := validateUUID(campaignID); err != nil {
		return errors.NewNotFound(nil, fmt.Sprintf("campaign %q not found", campaignID))
	}

	return tx.Delete(&models.EmailCampaign{}, "id = ?", campaignID).Error
}

func ListEmails(tx *gorm.DB, campaignID string) ([]*models.Email, error) {
	var result []*models.Email

	if err := tx.Order("created_at ASC").Preload("EmailCampaign.EmailTemplate").Find(&result, "email_campaign_id = ?", campaignID).Error; err != nil {
		return nil, err
	}

	for _, email := range result {
		if email.State == models.Waiting || email.State == models.Error {
			if err := buildEmail(email); err != nil {
				email.Error = err.Error()
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

	if err := tx.Preload("EmailCampaign.EmailTemplate.Attachments").First(&row, "id = ?", emailID).Error; err != nil {
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

	result := tx.Where("state <> ?", models.Sending).Delete(&models.Email{}, "id = ?", emailID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.BadRequestf("email not found or currently sending")
	}
	return nil
}

// SendEmail must receive an autocommit connection: the claim must be durable
// before SMTP is contacted, including when the HTTP request finishes early.
func SendEmail(c context.Context, tx *gorm.DB, emailID string, wait bool) error {
	if err := validateUUID(emailID); err != nil {
		return errors.NewNotFound(nil, fmt.Sprintf("email %q not found", emailID))
	}
	claim := tx.WithContext(c).Model(&models.Email{}).
		Where("id = ? AND state IN ?", emailID, []models.EmailState{models.Waiting, models.Error}).
		Updates(map[string]any{"state": models.Sending, "error": ""})
	if claim.Error != nil {
		return claim.Error
	}
	if claim.RowsAffected != 1 {
		var email models.Email
		if err := tx.WithContext(c).First(&email, "id = ?", emailID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return errors.NewNotFound(nil, fmt.Sprintf("email %q not found", emailID))
			}
			return err
		}
		return errors.BadRequestf("cannot send an email which has %s state", email.State)
	}
	if wait {
		return sendClaimedEmail(c, tx, emailID)
	}
	go func() {
		// Never retain a Gin context or the completed HTTP request's lifetime.
		if err := sendClaimedEmail(context.Background(), tx, emailID); err != nil {
			logrus.WithError(err).WithField("email_id", emailID).Error("asynchronous email delivery failed")
		}
	}()
	return nil
}

func sendClaimedEmail(c context.Context, tx *gorm.DB, emailID string) error {
	ctx, cancel := context.WithTimeout(c, time.Minute)
	defer cancel()
	email, sendErr := GetEmail(tx.WithContext(ctx), emailID, false)
	state := models.Error
	if sendErr == nil {
		sendErr = buildEmail(email)
		if sendErr == nil {
			var attachments []*smtp.Attachment
			for _, attachment := range email.EmailCampaign.EmailTemplate.Attachments {
				attachments = append(attachments, smtp.NewAttachment(attachment.Name, attachment.ContentType, attachment.Content, attachment.Inline))
			}
			sendErr = smtp.Send(ctx, email.To, email.Subject, email.Message, email.ID, attachments...)
			if sendErr == nil {
				state = models.Sent
			} else if smtp.IsDeliveryUncertain(sendErr) {
				state = models.Unknown
			}
		}
	}
	values := map[string]any{"state": state, "error": ""}
	if sendErr != nil {
		values["error"] = sendErr.Error()
	}
	if email != nil {
		values["subject"], values["message"] = email.Subject, email.Message
	}
	// Persist the outcome even if the caller disconnected or its deadline expired.
	saveCtx, saveCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer saveCancel()
	result := tx.WithContext(saveCtx).Model(&models.Email{}).Where("id = ? AND state = ?", emailID, models.Sending).Updates(values)
	if result.Error != nil || result.RowsAffected != 1 {
		err := fmt.Errorf("cannot persist delivery outcome for email %s: %v; check delivery before retrying", emailID, result.Error)
		// If this also fails (e.g. database outage), SENDING remains a durable
		// barrier to retries. Recovery requires stopping senders and checking SMTP.
		values["state"], values["error"] = models.Unknown, "Résultat de l’envoi à vérifier avant tout renvoi."
		if fallback := tx.WithContext(saveCtx).Model(&models.Email{}).Where("id = ? AND state = ?", emailID, models.Sending).Updates(values); fallback.Error != nil {
			logrus.WithError(fallback.Error).WithField("email_id", emailID).Error("email remains claimed; offline delivery verification is required")
		}
		return err
	}
	return sendErr
}

func MarkAsError(c context.Context, tx *gorm.DB, emailID string) error {
	if err := validateUUID(emailID); err != nil {
		return errors.NewNotFound(nil, "email not found")
	}
	result := tx.WithContext(c).Model(&models.Email{}).Where("id = ? AND state IN ?", emailID, []models.EmailState{models.Sent, models.Read, models.Unknown}).Updates(map[string]any{
		"state":   models.Error,
		"error":   "",
		"subject": nil,
		"message": nil,
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errors.BadRequestf("email cannot be reset while waiting or sending")
	}
	return nil
}

func MarkAsRead(c context.Context, tx *gorm.DB, emailID string) error {
	if err := tx.WithContext(c).Model(&models.Email{}).Where("id = ? AND state = ?", emailID, models.Sent).Updates(map[string]any{
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
	if email.EmailCampaign == nil || email.EmailCampaign.EmailTemplate == nil {
		return fmt.Errorf("email campaign or template no longer exists")
	}
	data := make(map[string]any, len(email.Data)+len(email.EmailCampaign.Data))
	for k, v := range email.Data {
		data[k] = v
	}
	for k, v := range email.EmailCampaign.Data {
		data[k] = v
	}

	t, err := templates.NewTemplate(data)
	if err != nil {
		return err
	}

	subject, err := t.Execute(email.EmailCampaign.EmailTemplate.Subject)
	if err != nil {
		return err
	}
	email.Subject = string(subject)

	mdMessage, err := t.Execute(email.EmailCampaign.EmailTemplate.Message)
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
