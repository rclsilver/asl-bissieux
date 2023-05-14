package controllers

import (
	"fmt"

	"gorm.io/gorm"

	"github.com/juju/errors"

	"github.com/rclsilver/asl-bissieux/models"
)

func ListBudgets(tx *gorm.DB) ([]*models.BudgetResult, error) {
	var result []*models.BudgetResult

	expensesAmounts := tx.
		Model(&models.Expense{}).
		Select("budget_id, SUM(amount) AS amount").
		Group("budget_id")

	paymentsAmounts := tx.
		Model(&models.Payment{}).
		Select("cotisation.budget_id, SUM(payment.amount) AS paid").
		Joins("JOIN cotisation ON cotisation.id = payment.cotisation_id").
		Group("cotisation.budget_id")

	if err := tx.
		Model(&models.Budget{}).
		Select("budget.*, expenses.amount as amount, payments.paid as paid").
		Joins("LEFT JOIN (?) AS expenses ON expenses.budget_id = budget.id", expensesAmounts).
		Joins("LEFT JOIN (?) AS payments ON payments.budget_id = budget.id", paymentsAmounts).
		Find(&result).Error; err != nil {
		return nil, err
	}

	return result, nil
}

func GetBudget(tx *gorm.DB, budgetID string) (*models.BudgetResult, error) {
	if err := validateUUID(budgetID); err != nil {
		return nil, errors.NewNotFound(nil, fmt.Sprintf("budget %q not found", budgetID))
	}

	var row models.BudgetResult

	expensesAmounts := tx.
		Model(&models.Expense{}).
		Select("budget_id, SUM(amount) AS amount").
		Group("budget_id")

	paymentsAmounts := tx.
		Model(&models.Payment{}).
		Select("cotisation.budget_id, SUM(payment.amount) AS paid").
		Joins("JOIN cotisation ON cotisation.id = payment.cotisation_id").
		Group("cotisation.budget_id")

	if err := tx.
		Model(&models.Budget{}).
		Select("budget.*, expenses.amount as amount, payments.paid as paid").
		Joins("LEFT JOIN (?) AS expenses ON expenses.budget_id = budget.id", expensesAmounts).
		Joins("LEFT JOIN (?) AS payments ON payments.budget_id = budget.id", paymentsAmounts).
		First(&row, "budget.id = ?", budgetID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("budget %q not found", budgetID))
		}
		return nil, err
	}

	return &row, nil
}

func ListExpenses(tx *gorm.DB, budgetID string) ([]*models.Expense, error) {
	if err := validateUUID(budgetID); err != nil {
		return nil, errors.NewNotFound(nil, fmt.Sprintf("budget %q not found", budgetID))
	}

	var budget models.Budget

	if err := tx.First(&budget, "id = ?", budgetID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("budget %q not found", budgetID))
		}
		return nil, err
	}

	var result []*models.Expense

	if err := tx.Find(&result, "budget_id = ?", budget.ID).Error; err != nil {
		return nil, err
	}

	return result, nil
}

func ListCotisations(tx *gorm.DB, budgetID string) ([]*models.CotisationResult, error) {
	if err := validateUUID(budgetID); err != nil {
		return nil, errors.NewNotFound(nil, fmt.Sprintf("budget %q not found", budgetID))
	}

	var budget models.Budget

	if err := tx.First(&budget, "id = ?", budgetID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("budget %q not found", budgetID))
		}
		return nil, err
	}

	var result []*models.CotisationResult

	paymentsAmounts := tx.
		Model(&models.Payment{}).
		Select("cotisation.id as cotisation_id, SUM(payment.amount) AS paid").
		Joins("JOIN cotisation ON cotisation.id = payment.cotisation_id").
		Group("cotisation.id")

	if err := tx.
		Model(&models.Cotisation{}).
		Preload("Unit").
		Preload("Payments.User").
		Select("cotisation.*, COALESCE(payments.paid, 0) AS paid").
		Joins("LEFT JOIN (?) AS payments ON payments.cotisation_id = cotisation.id", paymentsAmounts).
		Find(&result, "cotisation.budget_id = ?", budget.ID).Error; err != nil {
		return nil, err
	}

	return result, nil
}
