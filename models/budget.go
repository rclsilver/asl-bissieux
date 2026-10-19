package models

import (
	"time"

	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/db"
	"github.com/rclsilver/asl-bissieux/pkg/money"
)

type Budget struct {
	db.Model

	Label string `json:"label" gorm:"notNull"`
	Draft bool   `json:"draft" gorm:"notNull;default:true"`

	Expenses    []*Expense    `json:"-"`
	Cotisations []*Cotisation `json:"-"`
}

type BudgetResult struct {
	Budget

	Amount  money.Amount   `json:"amount"`
	Paid    money.Amount   `json:"paid"`
	Preview *BudgetPreview `json:"preview,omitempty" gorm:"-"`
}

// Informative rates are shown to six decimal places. Actual unit cotisations
// use exact integer-cent allocation, never a multiplication of these rates.
type BudgetPreview struct {
	Amount          money.Amount `json:"amount"`
	TotalShares     int64        `json:"total_shares"`
	Months          int          `json:"months"`
	AnnualPerShare  money.Amount `json:"annual_per_share"`
	MonthlyPerShare money.Amount `json:"monthly_per_share"`
	Ready           bool         `json:"ready"`
	Message         string       `json:"message"`
}

func NewBudget(label string) *Budget {
	b := &Budget{
		Label: label,
	}

	return b
}

// TableName give to gorm the table name to use
func (Budget) TableName() string {
	return "budget"
}

type Expense struct {
	db.Model

	BudgetID string  `json:"budget_id" gorm:"notNull"`
	Budget   *Budget `json:"budget,omitempty" gorm:"notNull;references:ID"`

	Label  string       `json:"label" gorm:"notNull"`
	Amount money.Amount `json:"amount" gorm:"notNull"`
}

func NewExpense(budgetID, label string, amount money.Amount) *Expense {
	e := &Expense{
		BudgetID: budgetID,
		Label:    label,
		Amount:   amount,
	}

	return e
}

// TableName give to gorm the table name to use
func (Expense) TableName() string {
	return "expense"
}

type Cotisation struct {
	db.Model

	BudgetID string  `json:"budget_id" gorm:"notNull"`
	Budget   *Budget `json:"budget,omitempty" gorm:"notNull;references:ID"`

	Payments []*Payment `json:"-"`

	UnitID string `json:"unit_id" gorm:"notNull"`
	Unit   *Unit  `json:"unit,omitempty" gorm:"notNull;references:ID"`

	Amount money.Amount `json:"amount" gorm:"notNull"`
}

type CotisationResult struct {
	Cotisation

	Paid         money.Amount `json:"paid"`
	Remaining    money.Amount `json:"remaining" gorm:"-"`
	PaymentState int          `json:"payment_state" gorm:"-"`
}

func NewCotisation(budgetID, unitID string, amount money.Amount) *Cotisation {
	c := &Cotisation{
		BudgetID: budgetID,
		UnitID:   unitID,
		Amount:   amount,
	}

	return c
}

// TableName give to gorm the table name to use
func (Cotisation) TableName() string {
	return "cotisation"
}

type PaymentType int

type Payment struct {
	db.Model

	CotisationID string      `json:"cotisation_id" gorm:"notNull"`
	Cotisation   *Cotisation `json:"cotisation,omitempty" gorm:"notNull;references:ID"`

	UserID string     `json:"user_id" gorm:"notNull"`
	User   *auth.User `json:"user,omitempty" gorm:"notNull;references:ID"`

	Date    time.Time    `json:"date" gorm:"notNull"`
	Amount  money.Amount `json:"amount" gorm:"notNull"`
	Comment string       `json:"comment"`
}

func NewPayment(cotisationID, userID string, date time.Time, amount money.Amount, comment string) *Payment {
	p := &Payment{
		CotisationID: cotisationID,
		UserID:       userID,
		Date:         date,
		Amount:       amount,
		Comment:      comment,
	}

	return p
}

// TableName give to gorm the table name to use
func (Payment) TableName() string {
	return "payment"
}
