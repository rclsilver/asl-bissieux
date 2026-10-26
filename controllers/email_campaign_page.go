package controllers

import (
	"database/sql"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/juju/errors"
	"github.com/rclsilver/asl-bissieux/models"
	"gorm.io/gorm"
)

type PageOptions struct {
	Page, PageSize         int
	Query, Sort, Direction string
}

type CampaignPageOptions = PageOptions

func (o *PageOptions) normalize(allowedSorts ...string) error {
	if o.Page == 0 {
		o.Page = 1
	}
	if o.PageSize == 0 {
		o.PageSize = 25
	}
	if o.Sort == "" {
		o.Sort = "created_at"
	}
	if o.Direction == "" {
		o.Direction = "desc"
	}
	o.Query = strings.TrimSpace(o.Query)
	if o.Page < 1 || o.Page > 1000000 || o.PageSize < 1 || o.PageSize > 100 ||
		utf8.RuneCountInString(o.Query) > 200 ||
		!slices.Contains(allowedSorts, o.Sort) ||
		(o.Direction != "asc" && o.Direction != "desc") {
		return errors.NewBadRequest(nil, "invalid pagination, search or sort")
	}
	return nil
}

// ListEmailCampaignPage returns only the requested summaries. No template,
// context, recipient, message body or attachment is loaded by this endpoint.
func ListEmailCampaignPage(tx *gorm.DB, options CampaignPageOptions, filters ...string) (*models.EmailCampaignPage, error) {
	if err := options.normalize("created_at", "title"); err != nil {
		return nil, err
	}
	state := ""
	if len(filters) > 0 {
		state = filters[0]
	}
	if !slices.Contains([]string{"", "WAITING", "SENDING", "SUCCESSFUL", "ERROR", "UNKNOWN"}, state) {
		return nil, errors.NewBadRequest(nil, "État de campagne invalide.")
	}
	result := &models.EmailCampaignPage{Items: []models.EmailCampaignSummary{}, Page: options.Page, PageSize: options.PageSize}
	err := tx.Transaction(func(tx *gorm.DB) error {
		query := func() *gorm.DB {
			q := tx.Model(&models.EmailCampaign{})
			if state != "" {
				predicate := "e.state = ?"
				args := []any{state}
				if state == "SUCCESSFUL" {
					predicate = "e.state IN ('SENT','READ')"
					args = nil
				} else if state == "UNKNOWN" {
					predicate = "e.state NOT IN ('WAITING','SENDING','SENT','READ','ERROR')"
					args = nil
				}
				q = q.Where("EXISTS (SELECT 1 FROM email e WHERE e.email_campaign_id=email_campaign.id AND e.deleted_at IS NULL AND "+predicate+")", args...)
			}
			if options.Query != "" {
				escaped := strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(options.Query)
				q = q.Where("title ILIKE ?", "%"+escaped+"%")
			}
			return q
		}
		if err := query().Count(&result.Total).Error; err != nil {
			return err
		}
		lastPage := max(1, int((result.Total+int64(options.PageSize)-1)/int64(options.PageSize)))
		result.Page = min(result.Page, lastPage)
		// Sort and direction are allowlisted above. UUID resolves equal dates/titles.
		order := options.Sort + " " + options.Direction + ", id " + options.Direction
		if err := query().Select("id", "created_at", "title").
			Order(order).Limit(options.PageSize).Offset((result.Page - 1) * options.PageSize).
			Scan(&result.Items).Error; err != nil {
			return err
		}
		if len(result.Items) == 0 {
			return nil
		}
		ids := make([]string, 0, len(result.Items))
		for _, row := range result.Items {
			ids = append(ids, row.ID)
		}
		var counts []struct {
			EmailCampaignID    string
			models.EmailCounts `gorm:"embedded"`
		}
		if err := tx.Model(&models.Email{}).Where("email_campaign_id IN ?", ids).
			Select(`email_campaign_id, COUNT(*) AS total,
    COUNT(*) FILTER (WHERE state = 'WAITING') AS waiting,
    COUNT(*) FILTER (WHERE state = 'SENDING') AS sending,
    COUNT(*) FILTER (WHERE state IN ('SENT','READ')) AS successful,
    COUNT(*) FILTER (WHERE state = 'ERROR') AS error,
    COUNT(*) FILTER (WHERE state NOT IN ('WAITING','SENDING','SENT','READ','ERROR')) AS unknown`).
			Group("email_campaign_id").Scan(&counts).Error; err != nil {
			return err
		}
		byCampaign := make(map[string]models.EmailCounts, len(counts))
		for _, row := range counts {
			byCampaign[row.EmailCampaignID] = row.EmailCounts
		}
		for i := range result.Items {
			result.Items[i].Counts = byCampaign[result.Items[i].ID]
		}
		return nil
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return nil, err
	}
	return result, nil
}
