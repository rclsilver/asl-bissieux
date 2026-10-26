package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/rclsilver/asl-bissieux/controllers"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/db"
)

type budgetDashboardIn struct {
	BudgetID string `path:"budget_id"`
	Year     int    `query:"year"`
}

func GetBudgetDashboard(c *gin.Context, in *budgetDashboardIn) (*models.BudgetDashboard, error) {
	return controllers.GetBudgetDashboard(db.Connection(c), in.BudgetID, in.Year)
}
func GetDirectoryQuality(c *gin.Context) (*models.DirectoryQuality, error) {
	return controllers.GetDirectoryQuality(db.Connection(c))
}
func GetEmailDashboard(c *gin.Context) (*models.EmailDashboard, error) {
	return controllers.GetEmailDashboard(db.Connection(c))
}
