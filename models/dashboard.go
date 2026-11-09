package models

import "github.com/rclsilver/asl-bissieux/pkg/money"

type RecoverySummary struct {
	Called    money.Amount `json:"called"`
	Paid      money.Amount `json:"paid"`
	Remaining money.Amount `json:"remaining"`
	Surplus   money.Amount `json:"surplus"`
	Covered   money.Amount `json:"covered"`
	Refunded  money.Amount `json:"refunded"`
	Rate      *float64     `json:"rate"`
	Lots      int          `json:"lots"`
	Settled   int          `json:"settled"`
	Partial   int          `json:"partial"`
	Unpaid    int          `json:"unpaid"`
	Overpaid  int          `json:"overpaid"`
}

type MonthlyCollection struct {
	Month      int          `json:"month"`
	Payments   money.Amount `json:"payments"`
	Refunds    money.Amount `json:"refunds"`
	Net        money.Amount `json:"net"`
	Cumulative money.Amount `json:"cumulative"`
}

type BudgetDashboard struct {
	Budget      *BudgetResult       `json:"budget"`
	Recovery    RecoverySummary     `json:"recovery"`
	Cotisations []*CotisationResult `json:"cotisations"`
	Year        int                 `json:"year"`
	Years       []int               `json:"years"`
	Timezone    string              `json:"timezone"`
	Months      []MonthlyCollection `json:"months"`
}

type DirectoryQuality struct {
	MissingEmail  int64 `json:"missing_email"`
	NoMember      int64 `json:"no_member"`
	InvalidShares int64 `json:"invalid_shares"`
}

type EmailDashboard struct {
	Counts    EmailCounts            `json:"counts"`
	Recent    []EmailCampaignSummary `json:"recent"`
	Campaigns int64                  `json:"campaigns"`
}
