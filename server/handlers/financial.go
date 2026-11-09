package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/juju/errors"
	"github.com/rclsilver/asl-bissieux/controllers"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/db"
	"github.com/rclsilver/asl-bissieux/server/auth"
)

const CreateRefundAction = "budget.CreateRefund"
const CreateAdjustmentAction = "budget.CreateAdjustment"

type financialEntryIn struct {
	BudgetID     string `path:"budget_id"`
	CotisationID string `path:"cotisation_id"`
	controllers.FinancialInput
}

func requireFinancialAction(c *gin.Context, kind string) error {
	user, err := auth.GetCurrentUser(c)
	if err != nil {
		return err
	}
	action := CreateAdjustmentAction
	if kind == "refund" {
		action = CreateRefundAction
	}
	if !user.Allowed(action) {
		return errors.NewForbidden(nil, "Tu n’as pas le droit d’enregistrer cette opération.")
	}
	return nil
}
func ListFinancialEntries(c *gin.Context, in *listPaymentsIn) ([]*models.FinancialEntry, error) {
	return controllers.ListFinancialEntries(db.Connection(c), in.BudgetID, in.CotisationID)
}
func PreviewFinancialEntry(c *gin.Context, in *financialEntryIn) (*models.FinancialPreview, error) {
	if err := requireFinancialAction(c, in.Kind); err != nil {
		return nil, err
	}
	return controllers.PreviewFinancialEntry(db.Connection(c), in.BudgetID, in.CotisationID, in.FinancialInput)
}
func CreateFinancialEntry(c *gin.Context, in *financialEntryIn) (*models.FinancialEntry, error) {
	if err := requireFinancialAction(c, in.Kind); err != nil {
		return nil, err
	}
	user, err := auth.GetCurrentUser(c)
	if err != nil {
		return nil, err
	}
	return controllers.CreateFinancialEntry(db.Connection(c), in.BudgetID, in.CotisationID, user.ID, in.FinancialInput)
}
