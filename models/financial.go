package models

import (
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/money"
	"time"
)

// FinancialEntry is immutable, including reversals. No soft deletion is supported.
type FinancialEntry struct {
	ID           string       `json:"id" gorm:"type:uuid;primaryKey"`
	CreatedAt    time.Time    `json:"created_at"`
	CotisationID string       `json:"cotisation_id"`
	UserID       string       `json:"user_id"`
	User         *auth.User   `json:"user,omitempty" gorm:"references:ID"`
	Kind         string       `json:"kind"`
	Amount       money.Amount `json:"amount"`
	Date         time.Time    `json:"date"`
	Reason       string       `json:"reason"`
	Reference    string       `json:"reference"`
	ReversesID   *string      `json:"reverses_id,omitempty"`
}

func (FinancialEntry) TableName() string { return "financial_entry" }

type FinancialPreview struct {
	CalledBefore   money.Amount `json:"called_before"`
	CalledAfter    money.Amount `json:"called_after"`
	PaidBefore     money.Amount `json:"paid_before"`
	PaidAfter      money.Amount `json:"paid_after"`
	RemainingAfter money.Amount `json:"remaining_after"`
	Version        string       `json:"version"`
}
