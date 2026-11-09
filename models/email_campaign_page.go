package models

import "time"

// EmailCounts groups delivery states without loading message contents.
// Successful includes SENT and READ once; a tracking pixel is not proof of human reading.
type EmailCounts struct {
	Total      int64 `json:"total"`
	Waiting    int64 `json:"waiting"`
	Sending    int64 `json:"sending"`
	Successful int64 `json:"successful"`
	Error      int64 `json:"error"`
	Unknown    int64 `json:"unknown"`
}

type EmailCampaignSummary struct {
	ID        string      `json:"id"`
	CreatedAt time.Time   `json:"created_at"`
	Title     string      `json:"title"`
	Counts    EmailCounts `json:"counts" gorm:"-"`
}

type EmailCampaignPage struct {
	Items    []EmailCampaignSummary `json:"items"`
	Total    int64                  `json:"total"`
	Page     int                    `json:"page"`
	PageSize int                    `json:"page_size"`
}
