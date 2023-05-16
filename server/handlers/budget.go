package handlers

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/juju/errors"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/rclsilver/asl-bissieux/controllers"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/db"
	"github.com/rclsilver/asl-bissieux/server/auth"
)

type listBudgetsIn struct{}

// ListBudgets returns the list of the budgets
func ListBudgets(c *gin.Context, in *listBudgetsIn) ([]*models.BudgetResult, error) {
	result, err := controllers.ListBudgets(db.Connection())
	if err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get budgets")
	}

	return result, nil
}

type getBudgetIn struct {
	BudgetID string `path:"budget_id"`
}

// GetBudget get a budget
func GetBudget(c *gin.Context, in *getBudgetIn) (*models.BudgetResult, error) {
	budget, err := controllers.GetBudget(db.Connection(), in.BudgetID)
	if err != nil {
		if !errors.IsNotFound(err) {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get budget")
		}
		return nil, err
	}

	return budget, nil
}

type createBudgetIn struct {
	Label string `json:"label" binding:"required"`
}

const (
	CreateBudgetAction = "budget.CreateBudget"
)

// CreateBudget create a budget
func CreateBudget(c *gin.Context, in *createBudgetIn) (*models.Budget, error) {
	db := db.Connection()
	row := models.NewBudget(in.Label)

	if err := db.Create(row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to create budget")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Infof("budget %s (%s) created", row.Label, row.ID)

	return row, nil
}

type updateBudgetIn struct {
	BudgetID string `path:"budget_id"`

	createBudgetIn
}

const (
	UpdateBudgetAction = "budget.UpdateBudget"
)

// UpdateBudget update a budget
func UpdateBudget(c *gin.Context, in *updateBudgetIn) (*models.BudgetResult, error) {
	if err := validateUUID(in.BudgetID, "invalid budget ID"); err != nil {
		return nil, err
	}

	db := db.Connection()
	var row models.Budget

	if err := db.Where("id = ?", in.BudgetID).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("budget %q not found", in.BudgetID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get budget")
		return nil, err
	}

	if err := checkBudgetPermission(c, &row); err != nil {
		return nil, errors.NewForbidden(err, "")
	}

	row.Label = in.Label

	if err := db.Where("id = ?", in.BudgetID).Updates(&row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to update budget")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Error("budget %s updated", row.ID)

	budget, err := controllers.GetBudget(db, in.BudgetID)
	if err != nil {
		if !errors.IsNotFound(err) {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get budget")
		}
		return nil, err
	}

	return budget, nil
}

const (
	DeleteBudgetAction = "budget.DeleteBudget"
)

type deleteBudgetIn struct {
	BudgetID string `path:"budget_id"`
}

// DeleteBudget delete a budget
func DeleteBudget(c *gin.Context, in *deleteBudgetIn) error {
	if err := validateUUID(in.BudgetID, "invalid budget ID"); err != nil {
		return err
	}

	db := db.Connection().Begin()
	if db.Error != nil {
		logrus.WithContext(c.Request.Context()).WithError(db.Error).Error("unable to begin transaction")
		return db.Error
	}
	defer db.Rollback()

	var row models.Budget

	if err := db.Where("id = ?", in.BudgetID).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.NewNotFound(nil, fmt.Sprintf("budget %q not found", in.BudgetID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get budget")
		return err
	}

	if err := checkBudgetPermission(c, &row); err != nil {
		return errors.NewForbidden(err, "")
	}

	if err := db.Delete(&row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to delete budget")
		return err
	}
	logrus.WithContext(c.Request.Context()).Infof("budget %q deleted", row.ID)

	// TODO: delete associations

	if err := db.Commit().Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to commit transaction")
		return err
	}

	return nil
}

const (
	PublishBudgetAction = "budget.PublishBudget"
)

type publishBudgetIn struct {
	BudgetID string `path:"budget_id"`
}

// PublishBudget publish a budget
func PublishBudget(c *gin.Context, in *publishBudgetIn) (*models.BudgetResult, error) {
	db := db.Connection().Begin()
	if db.Error != nil {
		logrus.WithContext(c.Request.Context()).WithError(db.Error).Error("unable to begin transaction")
		return nil, db.Error
	}
	defer db.Rollback()

	// load the budget
	budget, err := controllers.GetBudget(db, in.BudgetID)
	if err != nil {
		if !errors.IsNotFound(err) {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get budget")
		}
		return nil, err
	}

	// check the permissions
	if err := checkBudgetPermission(c, &budget.Budget); err != nil {
		return nil, errors.NewForbidden(err, "")
	}

	// load the units
	var units []*models.Unit
	if err := db.Find(&units).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get units")
		return nil, err
	}

	// shares count
	var sharesCount float64 = 0
	for _, u := range units {
		sharesCount += float64(u.Share)
	}

	// create cotisations
	shareAmount := budget.Amount / sharesCount

	for _, u := range units {
		amount := shareAmount * float64(u.Share)

		if amount <= 0 {
			continue
		}

		cotisation := models.NewCotisation(budget.ID, u.ID, amount)

		if err := db.Save(cotisation).Error; err != nil {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to create cotisation")
			return nil, err
		}
	}

	// update the budget row
	budget.Budget.Draft = false
	if err := db.Save(&budget.Budget).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to save budget")
		return nil, err
	}

	budget, err = controllers.GetBudget(db, in.BudgetID)
	if err != nil {
		if !errors.IsNotFound(err) {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get budget")
		}
		return nil, err
	}

	if err := db.Commit().Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to commit transaction")
		return nil, err
	}

	return budget, nil
}

type listExpensesIn struct {
	BudgetID string `path:"budget_id"`
}

// ListExpenses returns the list of the expenses of a budget
func ListExpenses(c *gin.Context, in *listExpensesIn) ([]*models.Expense, error) {
	result, err := controllers.ListExpenses(db.Connection(), in.BudgetID)
	if err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get expenses")
	}

	return result, nil
}

type createExpenseIn struct {
	BudgetID string  `path:"budget_id"`
	Label    string  `json:"label" binding:"required"`
	Amount   float64 `json:"amount" binding:"required"`
}

const (
	CreateExpenseAction = "budget.CreateExpense"
)

// CreateExpense create an expense
func CreateExpense(c *gin.Context, in *createExpenseIn) (*models.Expense, error) {
	if err := validateUUID(in.BudgetID, "invalid budget ID"); err != nil {
		return nil, err
	}

	db := db.Connection().Begin()
	if db.Error != nil {
		logrus.WithContext(c.Request.Context()).WithError(db.Error).Error("unable to begin transaction")
		return nil, db.Error
	}
	defer db.Rollback()

	var budget models.Budget

	if err := db.Where("id = ?", in.BudgetID).First(&budget).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("budget %q not found", in.BudgetID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get budget")
		return nil, err
	}

	if err := checkBudgetPermission(c, &budget); err != nil {
		return nil, errors.NewForbidden(err, "")
	}

	row := models.NewExpense(budget.ID, in.Label, in.Amount)

	if err := db.Preload("Budget").Create(row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to create expense")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Infof("expense %s (%s) created for budget %s (%s)", row.Label, row.ID, budget.Label, budget.ID)

	if err := db.Commit().Error; err != nil {
		db.Rollback()
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to commit the transaction")
		return nil, err
	}

	return row, nil
}

type updateExpenseIn struct {
	ExpenseID string `path:"expense_id"`

	createExpenseIn
}

const (
	UpdateExpenseAction = "budget.UpdateExpense"
)

// UpdateExpense update an expense
func UpdateExpense(c *gin.Context, in *updateExpenseIn) (*models.Expense, error) {
	if err := validateUUID(in.BudgetID, "invalid budget ID"); err != nil {
		return nil, err
	}

	if err := validateUUID(in.ExpenseID, "invalid expense ID"); err != nil {
		return nil, err
	}

	db := db.Connection()
	var row models.Expense

	if err := db.Preload("Budget").Where("id = ? AND budget_id = ?", in.ExpenseID, in.BudgetID).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("expense %q not found for budget %q", in.ExpenseID, in.BudgetID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get expense")
		return nil, err
	}

	if err := checkBudgetPermission(c, row.Budget); err != nil {
		return nil, errors.NewForbidden(err, "")
	}

	row.Label = in.Label
	row.Amount = in.Amount

	if err := db.Where("id = ?", in.ExpenseID).Updates(&row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to update expense")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Error("expense %s updated", row.ID)

	return &row, nil
}

const (
	DeleteExpenseAction = "budget.DeleteExpense"
)

type deleteExpenseIn struct {
	BudgetID  string `path:"budget_id"`
	ExpenseID string `path:"expense_id"`
}

// DeleteExpense delete a budget
func DeleteExpense(c *gin.Context, in *deleteExpenseIn) error {
	if err := validateUUID(in.BudgetID, "invalid budget ID"); err != nil {
		return err
	}

	if err := validateUUID(in.ExpenseID, "invalid expense ID"); err != nil {
		return err
	}

	db := db.Connection()

	var row models.Expense

	if err := db.Preload("Budget").Where("id = ? AND budget_id = ?", in.ExpenseID, in.BudgetID).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.NewNotFound(nil, fmt.Sprintf("expense %q not found", in.ExpenseID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get expense")
		return err
	}

	if err := checkBudgetPermission(c, row.Budget); err != nil {
		return errors.NewForbidden(err, "")
	}

	if err := db.Delete(&row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to delete expense")
		return err
	}
	logrus.WithContext(c.Request.Context()).Infof("expense %q deleted", row.ID)

	return nil
}

type listCotisationsIn struct {
	BudgetID string `path:"budget_id"`
}

// ListCotisations returns the list of the cotisations of a budget
func ListCotisations(c *gin.Context, in *listCotisationsIn) ([]*models.CotisationResult, error) {
	result, err := controllers.ListCotisations(db.Connection(), in.BudgetID)
	if err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get cotisations")
	}

	return result, nil
}

type listPaymentsIn struct {
	BudgetID     string `path:"budget_id"`
	CotisationID string `path:"cotisation_id"`
}

// ListPayments returns the list of the payments of a cotisation
func ListPayments(c *gin.Context, in *listPaymentsIn) ([]*models.Payment, error) {
	result, err := controllers.ListPayments(db.Connection(), in.BudgetID, in.CotisationID)
	if err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get payments")
	}

	return result, nil
}

const (
	CreatePaymentAction = "budget.CreatePayment"
)

type createPaymentIn struct {
	BudgetID     string `path:"budget_id"`
	CotisationID string `path:"cotisation_id"`

	Date    time.Time `json:"date" binding:"required"`
	Amount  float64   `json:"amount" binding:"required"`
	Comment string    `json:"comment"`
}

// CreatePayment create a payment
func CreatePayment(c *gin.Context, in *createPaymentIn) (*models.Payment, error) {
	if err := validateUUID(in.BudgetID, "invalid budget ID"); err != nil {
		return nil, err
	}

	if err := validateUUID(in.CotisationID, "invalid cotisation ID"); err != nil {
		return nil, err
	}

	db := db.Connection().Begin()
	if db.Error != nil {
		logrus.WithContext(c.Request.Context()).WithError(db.Error).Error("unable to begin transaction")
		return nil, db.Error
	}

	var cotisation models.Cotisation
	if err := db.Preload("Payments").Preload("Unit").Where("id = ? AND budget_id = ?", in.CotisationID, in.BudgetID).First(&cotisation).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("cotisation %q not found", in.CotisationID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get cotisation")
		return nil, err
	}

	user, err := auth.GetUser(c)
	if err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get user")
		return nil, err
	}

	payment := models.NewPayment(cotisation.ID, user.ID, in.Date, in.Amount, in.Comment)
	if err := db.Save(payment).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to create payment")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Infof("new payment for unit %d (%s) created by %s (%s)", cotisation.Unit.Number, cotisation.UnitID, user.Username, user.ID)

	if err := db.Commit().Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to commit transaction")
		return nil, err
	}

	return payment, nil
}

const (
	UpdatePaymentAction = "budget.UpdatePayment"
)

type updatePaymentIn struct {
	createPaymentIn

	PaymentID string `path:"payment_id"`
}

// UpdatePayment update a payment
func UpdatePayment(c *gin.Context, in *updatePaymentIn) (*models.Payment, error) {
	if err := validateUUID(in.BudgetID, "invalid budget ID"); err != nil {
		return nil, err
	}

	if err := validateUUID(in.CotisationID, "invalid cotisation ID"); err != nil {
		return nil, err
	}

	if err := validateUUID(in.PaymentID, "invalid payment ID"); err != nil {
		return nil, err
	}

	user, err := auth.GetUser(c)
	if err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get user")
		return nil, err
	}

	db := db.Connection().Begin()
	if db.Error != nil {
		logrus.WithContext(c.Request.Context()).WithError(db.Error).Error("unable to begin transaction")
		return nil, db.Error
	}

	var payment models.Payment
	if err := db.
		Joins("JOIN cotisation ON cotisation.id = payment.cotisation_id").
		First(&payment, "payment.id = ? AND payment.cotisation_id = ? AND cotisation.budget_id = ?", in.PaymentID, in.CotisationID, in.BudgetID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("payment %q not found", in.CotisationID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get payment")
		return nil, err
	}

	payment.Date = in.Date
	payment.Amount = in.Amount
	payment.Comment = in.Comment

	if err := db.Save(payment).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to save payment")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Infof("payment %s saved by %s (%s)", payment.ID, user.Username, user.ID)

	if err := db.Commit().Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to commit transaction")
		return nil, err
	}

	return &payment, nil
}

const (
	DeletePaymentAction = "budget.DeletePayment"
)

type deletePaymentIn struct {
	BudgetID     string `path:"budget_id"`
	CotisationID string `path:"cotisation_id"`
	PaymentID    string `path:"payment_id"`
}

// DeletePayment update a payment
func DeletePayment(c *gin.Context, in *deletePaymentIn) error {
	if err := validateUUID(in.BudgetID, "invalid budget ID"); err != nil {
		return err
	}

	if err := validateUUID(in.CotisationID, "invalid cotisation ID"); err != nil {
		return err
	}

	if err := validateUUID(in.PaymentID, "invalid payment ID"); err != nil {
		return err
	}

	db := db.Connection().Begin()
	if db.Error != nil {
		logrus.WithContext(c.Request.Context()).WithError(db.Error).Error("unable to begin transaction")
		return db.Error
	}

	var payment models.Payment
	if err := db.
		Joins("JOIN cotisation ON cotisation.id = payment.cotisation_id").
		First(&payment, "payment.id = ? AND payment.cotisation_id = ? AND cotisation.budget_id = ?", in.PaymentID, in.CotisationID, in.BudgetID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.NewNotFound(nil, fmt.Sprintf("payment %q not found", in.CotisationID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get payment")
		return err
	}

	if err := db.Delete(&payment).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to delete payment")
		return err
	}
	logrus.WithContext(c.Request.Context()).Infof("payment %s deleted", payment.ID)

	if err := db.Commit().Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to commit transaction")
		return err
	}

	return nil
}

func checkBudgetPermission(c *gin.Context, budget *models.Budget) error {
	user, err := auth.GetUser(c)
	if err != nil {
		return errors.NewUnauthorized(err, "not authenticated")
	}

	if !budget.Draft && !user.Admin {
		return errors.NewForbidden(nil, "budget cannot be modified")
	}

	return nil
}
