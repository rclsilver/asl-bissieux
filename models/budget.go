package models

import (
	"time"

	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/db"
)

func init() {
	db.RegisterMigration(&Budget{})
	db.RegisterMigration(&Expense{})
	db.RegisterMigration(&Payment{})
}

type Budget struct {
	db.Model

	Label string `json:"label" gorm:"notNull"`
	Draft bool   `json:"draft" gorm:"notNull;default:true"`

	Expenses    []*Expense    `json:"-"`
	Cotisations []*Cotisation `json:"-"`
}

type BudgetResult struct {
	Budget

	Amount float64 `json:"amount"`
	Paid   float64 `json:"paid"`
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

	Label  string  `json:"label" gorm:"notNull"`
	Amount float64 `json:"amount" gorm:"notNull"`
}

func NewExpense(budgetID, label string, amount float64) *Expense {
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

	Payments []*Payment `json:"payments,omitempty"`

	UnitID string `json:"unit_id" gorm:"notNull"`
	Unit   *Unit  `json:"unit,omitempty" gorm:"notNull;references:ID"`

	Amount float64 `json:"amount" gorm:"notNull"`
}

type CotisationResult struct {
	Cotisation

	Paid float64 `json:"paid"`
}

func NewCotisation(budgetID, unitID string, amount float64) *Cotisation {
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

const (
	Manual     PaymentType = 1
	CreditCard PaymentType = 2
	Check      PaymentType = 3
)

type Payment struct {
	db.Model

	CotisationID string      `json:"cotisation_id" gorm:"notNull"`
	Cotisation   *Cotisation `json:"cotisation,omitempty" gorm:"notNull;references:ID"`

	UserID string     `json:"user_id" gorm:"notNull"`
	User   *auth.User `json:"user,omitempty" gorm:"notNull;references:ID"`

	Date    time.Time   `json:"date" gorm:"notNull"`
	Type    PaymentType `json:"type" gorm:"notNull"`
	Amount  float64     `json:"amount" gorm:"notNull"`
	Comment string      `json:"comment"`
}

func NewPayment(cotisationID, userID string, date time.Time, paymentType PaymentType, amount float64, comment string) *Payment {
	p := &Payment{
		CotisationID: cotisationID,
		UserID:       userID,
		Date:         date,
		Type:         paymentType,
		Amount:       amount,
		Comment:      comment,
	}

	return p
}

// TableName give to gorm the table name to use
func (Payment) TableName() string {
	return "payment"
}
