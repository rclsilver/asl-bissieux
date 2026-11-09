package controllers

import (
	"crypto/sha256"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/juju/errors"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/money"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// LockFinancialBudget is shared by all financial writes. The parent lock also
// serializes publication, payment corrections, refunds and adjustment reversals.
func LockFinancialBudget(tx *gorm.DB, budgetID string) error {
	if err := validateUUID(budgetID); err != nil {
		return errors.NewNotFound(nil, "Budget introuvable.")
	}
	var budget models.Budget
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&budget, "id = ?", budgetID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.NewNotFound(nil, "Budget introuvable.")
		}
		return err
	}
	return nil
}

func ListFinancialEntries(tx *gorm.DB, budgetID, cotisationID string) ([]*models.FinancialEntry, error) {
	if _, err := ListPayments(tx, budgetID, cotisationID); err != nil {
		return nil, err
	}
	result := make([]*models.FinancialEntry, 0)
	err := tx.Preload("User").Where("cotisation_id = ?", cotisationID).Order("created_at, id").Find(&result).Error
	return result, err
}

type FinancialInput struct {
	ID         string       `json:"id" binding:"required"`
	Kind       string       `json:"kind" binding:"required"`
	Amount     money.Amount `json:"amount"`
	Date       string       `json:"date" binding:"required"`
	Reason     string       `json:"reason" binding:"required"`
	Reference  string       `json:"reference"`
	ReversesID string       `json:"reverses_id"`
	Version    string       `json:"version"`
}

func financialEffect(tx *gorm.DB, budgetID, cotisationID string, in FinancialInput) (*models.FinancialEntry, *models.FinancialPreview, error) {
	if _, err := uuid.Parse(in.ID); err != nil {
		return nil, nil, errors.NewBadRequest(nil, "Identifiant d’opération invalide.")
	}
	if in.Kind != "refund" && in.Kind != "adjustment" {
		return nil, nil, errors.NewBadRequest(nil, "Type d’opération invalide.")
	}
	date, err := time.Parse("2006-01-02", in.Date)
	if err != nil {
		return nil, nil, errors.NewBadRequest(nil, "Date invalide (AAAA-MM-JJ).")
	}
	reason := strings.TrimSpace(in.Reason)
	if len(reason) == 0 || len(reason) > 1000 || len(in.Reference) > 200 {
		return nil, nil, errors.NewBadRequest(nil, "Indique un motif (1 à 1 000 caractères) et une référence de 200 caractères maximum.")
	}
	budget, err := GetBudget(tx, budgetID)
	if err != nil {
		return nil, nil, err
	}
	if budget.Draft {
		return nil, nil, errors.NewBadRequest(nil, "Publie le budget avant d’ajouter une opération.")
	}
	rows, err := ListCotisations(tx, budgetID)
	if err != nil {
		return nil, nil, err
	}
	var current *models.CotisationResult
	for _, row := range rows {
		if row.ID == cotisationID {
			current = row
			break
		}
	}
	if current == nil {
		return nil, nil, errors.NewNotFound(nil, "Cotisation introuvable dans ce budget.")
	}
	entry := &models.FinancialEntry{ID: in.ID, CotisationID: cotisationID, Kind: in.Kind, Amount: in.Amount, Date: date, Reason: reason, Reference: strings.TrimSpace(in.Reference)}
	entries, err := ListFinancialEntries(tx, budgetID, cotisationID)
	if err != nil {
		return nil, nil, err
	}
	if in.ReversesID != "" {
		if _, err := uuid.Parse(in.ReversesID); err != nil {
			return nil, nil, errors.NewBadRequest(nil, "Opération à annuler invalide.")
		}
		var original *models.FinancialEntry
		for _, row := range entries {
			if row.ReversesID != nil && *row.ReversesID == in.ReversesID {
				return nil, nil, errors.NewBadRequest(nil, "Cette opération a déjà été annulée.")
			}
			if row.ID == in.ReversesID {
				original = row
			}
		}
		if original == nil || original.ReversesID != nil || original.Kind != in.Kind {
			return nil, nil, errors.NewBadRequest(nil, "Cette opération ne peut pas être annulée ici.")
		}
		entry.Amount = money.Of(original.Amount.Neg())
		entry.ReversesID = &in.ReversesID
	} else {
		if err := money.Of(in.Amount.Abs()).ValidateInput(); err != nil {
			return nil, nil, errors.NewBadRequest(err, err.Error())
		}
		if in.Kind == "refund" && (!in.Amount.IsPositive() || in.Amount.Cmp(money.Of(current.Paid.Sub(current.Amount.Decimal))) > 0) {
			return nil, nil, errors.NewBadRequest(nil, "Le remboursement doit être positif et ne peut pas dépasser le trop-perçu disponible.")
		}
	}
	preview := &models.FinancialPreview{CalledBefore: current.Amount, CalledAfter: current.Amount, PaidBefore: current.Paid, PaidAfter: current.Paid}
	if entry.Kind == "adjustment" {
		preview.CalledAfter = preview.CalledAfter.Add(entry.Amount)
	} else {
		preview.PaidAfter = money.Of(preview.PaidAfter.Sub(entry.Amount.Decimal))
	}
	if preview.CalledAfter.IsNegative() || preview.PaidAfter.IsNegative() {
		return nil, nil, errors.NewBadRequest(nil, "Cette opération rendrait le montant appelé ou encaissé négatif.")
	}
	preview.RemainingAfter = money.Of(preview.CalledAfter.Sub(preview.PaidAfter.Decimal))
	// Includes the proposed effect and all source rows: stale previews cannot
	// silently record a different amount after a concurrent financial write.
	payments, err := ListPayments(tx, budgetID, cotisationID)
	if err != nil {
		return nil, nil, err
	}
	sort.Slice(payments, func(i, j int) bool { return payments[i].ID < payments[j].ID })
	stamp := fmt.Sprintf("%s/%s/%s/%s/%s/%s/%s/%s/%s/%s/%v", cotisationID, current.InitialAmount.String(), current.Adjustment.String(), current.GrossPaid.String(), current.Refunded.String(), entry.Kind, entry.Amount.String(), in.Date, reason, entry.Reference, in.ReversesID)
	for _, p := range payments {
		stamp += fmt.Sprintf("/%s/%s/%s", p.ID, p.UpdatedAt.UTC().Format(time.RFC3339Nano), p.Amount.String())
	}
	for _, e := range entries {
		stamp += "/" + e.ID
	}
	preview.Version = fmt.Sprintf("%x", sha256.Sum256([]byte(stamp)))
	return entry, preview, nil
}

func PreviewFinancialEntry(tx *gorm.DB, budgetID, cotisationID string, in FinancialInput) (*models.FinancialPreview, error) {
	_, preview, err := financialEffect(tx, budgetID, cotisationID, in)
	return preview, err
}

func CreateFinancialEntry(tx *gorm.DB, budgetID, cotisationID, userID string, in FinancialInput) (*models.FinancialEntry, error) {
	var result *models.FinancialEntry
	err := tx.Transaction(func(tx *gorm.DB) error {
		if err := LockFinancialBudget(tx, budgetID); err != nil {
			return err
		}
		entry, preview, err := financialEffect(tx, budgetID, cotisationID, in)
		if err != nil {
			return err
		}
		if in.Version == "" || in.Version != preview.Version {
			return errors.NewBadRequest(nil, "La situation ou la saisie a changé. Prévisualise à nouveau l’opération.")
		}
		var count int64
		if err := tx.Model(&models.FinancialEntry{}).Where("id = ?", in.ID).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return errors.NewAlreadyExists(nil, "Cette opération a déjà été enregistrée.")
		}
		entry.UserID = userID
		if err := tx.Create(entry).Error; err != nil {
			return err
		}
		result = entry
		return nil
	})
	return result, err
}

// GuardPaymentReduction prevents editing/removing money that was already refunded.
// Caller must hold the parent budget lock throughout its payment transaction.
func GuardPaymentReduction(tx *gorm.DB, cotisationID string, reduction money.Amount) error {
	var totals struct{ Paid, Refunded money.Amount }
	if err := tx.Raw(`SELECT COALESCE((SELECT SUM(amount) FROM payment WHERE cotisation_id=? AND deleted_at IS NULL),0) paid, COALESCE((SELECT SUM(amount) FROM financial_entry WHERE cotisation_id=? AND kind='refund'),0) refunded`, cotisationID, cotisationID).Scan(&totals).Error; err != nil {
		return err
	}
	if money.Of(totals.Paid.Sub(reduction.Decimal)).Cmp(totals.Refunded) < 0 {
		return errors.NewBadRequest(nil, "Ce paiement a déjà financé un remboursement. Annule d’abord le remboursement concerné.")
	}
	return nil
}

func applyBudgetFinancialTotals(tx *gorm.DB, rows []*models.BudgetResult) error {
	if len(rows) == 0 {
		return nil
	}
	ids := make([]string, 0, len(rows))
	for _, b := range rows {
		ids = append(ids, b.ID)
	}
	var sums []struct {
		BudgetID                     string
		Called, Adjustment, Refunded money.Amount
	}
	err := tx.Raw(`SELECT c.budget_id, SUM(c.amount) called, SUM(COALESCE(e.adjustment,0)) adjustment, SUM(COALESCE(e.refunded,0)) refunded FROM cotisation c LEFT JOIN (SELECT cotisation_id,SUM(CASE WHEN kind='adjustment' THEN amount ELSE 0 END) adjustment,SUM(CASE WHEN kind='refund' THEN amount ELSE 0 END) refunded FROM financial_entry GROUP BY cotisation_id) e ON e.cotisation_id=c.id WHERE c.deleted_at IS NULL AND c.budget_id IN ? GROUP BY c.budget_id`, ids).Scan(&sums).Error
	if err != nil {
		return err
	}
	for _, b := range rows {
		b.GrossPaid = b.Paid
		for _, s := range sums {
			if s.BudgetID == b.ID {
				b.Adjustment = s.Adjustment
				b.Refunded = s.Refunded
				b.Called = s.Called.Add(s.Adjustment)
				b.Paid = money.Of(b.Paid.Sub(s.Refunded.Decimal))
				break
			}
		}
	}
	return nil
}
