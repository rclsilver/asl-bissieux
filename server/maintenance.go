package server

import (
	"github.com/gin-gonic/gin"

	"github.com/rclsilver/asl-bissieux/pkg/db"
)

type pingOut struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

// Ping returns the health status of the application.
func Ping(c *gin.Context) (*pingOut, error) {
	conn := db.Connection()

	if r := conn.Exec("SELECT 1"); r.Error != nil {
		return &pingOut{
			Status:  "KO",
			Message: "unable to connect to the database",
		}, nil
	}

	return &pingOut{
		Status: "OK",
	}, nil
}
