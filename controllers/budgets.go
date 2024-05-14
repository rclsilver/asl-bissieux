package controllers

import (
	"encoding/json"
	"fmt"

	"gorm.io/gorm"

	"github.com/juju/errors"

	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/templates"
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
		Preload("Unit.Members").
		Select("cotisation.*, COALESCE(payments.paid, 0) AS paid").
		Joins("LEFT JOIN (?) AS payments ON payments.cotisation_id = cotisation.id", paymentsAmounts).
		Find(&result, "cotisation.budget_id = ?", budget.ID).Error; err != nil {
		return nil, err
	}

	return result, nil
}

func ListPayments(tx *gorm.DB, budgetID, cotisationID string) ([]*models.Payment, error) {
	if err := validateUUID(budgetID); err != nil {
		return nil, errors.NewNotFound(nil, fmt.Sprintf("cotisation %q not found", cotisationID))
	}

	if err := validateUUID(cotisationID); err != nil {
		return nil, errors.NewNotFound(nil, fmt.Sprintf("cotisation %q not found", cotisationID))
	}

	var cotisation models.Cotisation

	if err := tx.First(&cotisation, "id = ? AND budget_id = ?", cotisationID, budgetID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("cotisation %q not found", cotisationID))
		}
		return nil, err
	}

	var result []*models.Payment

	if err := tx.
		Preload("User").
		Find(&result, "cotisation_id = ?", cotisation.ID).Error; err != nil {
		return nil, err
	}

	return result, nil
}

func PreviewBudgetEmail(tx *gorm.DB, budgetID, templateID, memberID string, data map[string]any) (*models.BuiltEmail, error) {
	template, err := GetEmailTemplate(tx, templateID)
	if err != nil {
		return nil, err
	}

	budget, err := GetBudget(tx, budgetID)
	if err != nil {
		return nil, err
	}

	member, err := GetMember(tx, memberID)
	if err != nil {
		return nil, err
	}

	cotisations, err := ListCotisations(tx, budgetID)
	if err != nil {
		return nil, err
	}
	cotisations = filterCotisations(cotisations, member.ID)

	t, err := buildTemplate(tx, budget, member, cotisations, data)
	if err != nil {
		return nil, err
	}

	res, err := BuildEmail(template, t)
	if err != nil {
		return nil, err
	}

	return &models.BuiltEmail{
		Subject: res.Subject,
		Message: res.Message,
	}, nil
}

func SendBudgetEmail(tx *gorm.DB, budgetID, templateID string, data map[string]any, toDoing, toPaid bool) error {
	template, err := GetEmailTemplate(tx, templateID)
	if err != nil {
		return err
	}

	budget, err := GetBudget(tx, budgetID)
	if err != nil {
		return err
	}

	cotisations, err := ListCotisations(tx, budgetID)
	if err != nil {
		return err
	}

	members := make(map[*models.Member][]*models.CotisationResult)

	for _, cotisation := range cotisations {
		if !toPaid && cotisation.Paid == cotisation.Amount {
			continue
		}

		if !toDoing && cotisation.Paid >= cotisation.Amount/2 {
			continue
		}

		for _, member := range cotisation.Unit.Members {
			if len(member.Email) == 0 {
				continue
			}

			if _, exists := members[member]; exists {
				members[member] = append(members[member], cotisation)
			} else {
				members[member] = []*models.CotisationResult{cotisation}
			}
		}
	}

	if len(members) > 0 {
		campaign := models.NewEmailCampaign(fmt.Sprintf("%s: %s", budget.Label, template.Label), template, data)
		if err := tx.Create(campaign).Error; err != nil {
			return err
		}

		for member, cotisations := range members {
			data, err := buildTemplateData(tx, budget, member, cotisations)
			if err != nil {
				return err
			}

			email := models.NewEmail(campaign, member.Email, data)
			if err := tx.Create(email).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

func buildTemplateData(tx *gorm.DB, budget *models.BudgetResult, member *models.Member, cotisations []*models.CotisationResult) (map[string]any, error) {
	expenses, err := ListExpenses(tx, budget.ID)
	if err != nil {
		return nil, err
	}

	var amount float64
	for _, c := range cotisations {
		amount += c.Amount
	}

	data := make(map[string]any)
	data["member"] = member
	data["budget"] = budget
	data["expenses"] = expenses
	data["amount"] = amount
	data["cotisations"] = cotisations

	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, errors.Annotate(err, "unable to marshal the data")
	}

	var context map[string]any
	if err := json.Unmarshal(jsonBytes, &context); err != nil {
		return nil, errors.Annotate(err, "unable to unmarshal the data")
	}

	return context, nil
}

func buildTemplate(tx *gorm.DB, budget *models.BudgetResult, member *models.Member, cotisations []*models.CotisationResult, data map[string]any) (*templates.Template, error) {
	context, err := buildTemplateData(tx, budget, member, cotisations)
	if err != nil {
		return nil, err
	}
	for k, v := range data {
		context[k] = v
	}

	return templates.NewTemplate(context)
}

func filterCotisations(cotisations []*models.CotisationResult, memberID string) []*models.CotisationResult {
	var result []*models.CotisationResult

	for _, c := range cotisations {
		found := false

		for _, m := range c.Unit.Members {
			if m.ID == memberID {
				found = true
				break
			}
		}

		if found {
			result = append(result, c)
		}
	}

	return result
}
