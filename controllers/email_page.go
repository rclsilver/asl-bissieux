package controllers

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/juju/errors"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/templates"
	"gorm.io/gorm"
)

type EmailPageOptions struct {
	PageOptions
	State models.EmailState
}

func (o *EmailPageOptions) normalize() error {
	if err := o.PageOptions.normalize("created_at", "to", "state"); err != nil {
		return err
	}
	switch o.State {
	case "", models.Waiting, models.Sending, models.Unknown, models.Sent, models.Error, models.Read:
		return nil
	default:
		return errors.NewBadRequest(nil, "invalid email state")
	}
}

// ListEmailPage limits work to one page and renders subjects only. Bodies,
// individual contexts and attachments never leave this listing endpoint.
func ListEmailPage(tx *gorm.DB, campaignID string, options EmailPageOptions) (*models.EmailPage, error) {
	if err := validateUUID(campaignID); err != nil {
		return nil, errors.NewNotFound(nil, "campaign not found")
	}
	if err := options.normalize(); err != nil {
		return nil, err
	}
	result := &models.EmailPage{Items: []models.EmailSummary{}, Page: options.Page, PageSize: options.PageSize}
	err := tx.Transaction(func(tx *gorm.DB) error {
		var campaign models.EmailCampaign
		if err := tx.Select("id", "email_template_id").First(&campaign, "id = ?", campaignID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return errors.NewNotFound(nil, "campaign not found")
			}
			return err
		}
		query := func() *gorm.DB {
			q := tx.Model(&models.Email{}).Where("email_campaign_id = ?", campaignID)
			if options.Query != "" {
				escaped := strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(options.Query)
				q = q.Where(`"to" ILIKE ?`, "%"+escaped+"%")
			}
			if options.State != "" {
				q = q.Where("state = ?", options.State)
			}
			return q
		}
		if err := query().Count(&result.Total).Error; err != nil {
			return err
		}
		result.Page = min(result.Page, max(1, int((result.Total+int64(options.PageSize)-1)/int64(options.PageSize))))
		// Both values are allowlisted, and UUID disambiguates equal keys.
		sortColumn := options.Sort
		if sortColumn == "to" {
			sortColumn = `"to"`
		}
		var rows []*models.Email
		if err := query().Select(`id, created_at, "to", subject, state, error,
    CASE WHEN state IN ('WAITING','ERROR') THEN data ELSE '{}'::jsonb END AS data`).
			Order(sortColumn + " " + options.Direction + ", id " + options.Direction).
			Limit(options.PageSize).Offset((result.Page - 1) * options.PageSize).Find(&rows).Error; err != nil {
			return err
		}
		pending := false
		for _, row := range rows {
			if row.State == models.Waiting || row.State == models.Error {
				pending = true
				break
			}
		}
		var preparationError error
		if pending {
			preparationError = tx.Select("id", "email_template_id", "data").First(&campaign, "id = ?", campaignID).Error
			if preparationError == nil {
				var template models.EmailTemplate
				preparationError = tx.Select("id", "subject").First(&template, "id = ?", campaign.EmailTemplateID).Error
				if preparationError == nil {
					campaign.EmailTemplate = &template
				}
			}
			// Missing templates are a recoverable row error; database failures are not.
			if preparationError != nil && preparationError != gorm.ErrRecordNotFound {
				return preparationError
			}
		}
		for _, row := range rows {
			failed := row.Error != ""
			if row.State == models.Waiting || row.State == models.Error {
				row.EmailCampaign = &campaign
				if preparationError != nil {
					failed = true
					row.Subject = ""
				} else {
					templateContext, err := emailTemplateContext(row)
					if err == nil {
						var subject []byte
						subject, err = templateContext.Execute(campaign.EmailTemplate.Subject)
						row.Subject = string(subject)
					}
					if err != nil {
						failed = true
						row.Subject = ""
					}
				}
			}
			result.Items = append(result.Items, models.EmailSummary{ID: row.ID, CreatedAt: row.CreatedAt, To: row.To,
				Subject: row.Subject, State: row.State, HasError: failed})
		}
		return nil
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func GetEmailStatus(tx *gorm.DB, emailID string) (*models.EmailStatus, error) {
	if err := validateUUID(emailID); err != nil {
		return nil, errors.NewNotFound(nil, "email not found")
	}
	var row models.Email
	if err := tx.Select("id", "state", "error").First(&row, "id = ?", emailID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("email %q not found", emailID))
		}
		return nil, err
	}
	return &models.EmailStatus{ID: row.ID, State: row.State, Error: row.Error}, nil
}

// The same context precedence is used for paged subjects and full previews.
func emailTemplateContext(email *models.Email) (*templates.Template, error) {
	if email.EmailCampaign == nil || email.EmailCampaign.EmailTemplate == nil {
		return nil, fmt.Errorf("email campaign or template no longer exists")
	}
	data := make(map[string]any, len(email.Data)+len(email.EmailCampaign.Data))
	for k, v := range email.Data {
		data[k] = v
	}
	for k, v := range email.EmailCampaign.Data {
		data[k] = v
	}
	return templates.NewTemplate(data)
}
