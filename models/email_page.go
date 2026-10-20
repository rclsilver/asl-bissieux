package models

import "time"

type EmailSummary struct {
	ID        string     `json:"id"`
	CreatedAt time.Time  `json:"created_at"`
	To        string     `json:"to"`
	Subject   string     `json:"subject"`
	State     EmailState `json:"state"`
	HasError  bool       `json:"has_error"`
}

type EmailPage struct {
	Items    []EmailSummary `json:"items"`
	Total    int64          `json:"total"`
	Page     int            `json:"page"`
	PageSize int            `json:"page_size"`
}

type EmailStatus struct {
	ID    string     `json:"id"`
	State EmailState `json:"state"`
	Error string     `json:"error,omitempty"`
}
