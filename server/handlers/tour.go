package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/rclsilver/asl-bissieux/pkg/db"
	"github.com/rclsilver/asl-bissieux/pkg/tour"
	serverauth "github.com/rclsilver/asl-bissieux/server/auth"
)

func GetTour(c *gin.Context) (*tour.State, error) {
	u, err := serverauth.GetCurrentUser(c)
	if err != nil {
		return nil, err
	}
	return tour.Get(db.Connection(c).WithContext(c.Request.Context()), u.ID)
}

type viewTourStepIn struct {
	Version  int    `json:"version" binding:"required,min=1"`
	StepID   string `json:"step_id" binding:"required,max=80"`
	Revision int    `json:"revision" binding:"required,min=1"`
}

func ViewTourStep(c *gin.Context, in *viewTourStepIn) (*tour.State, error) {
	u, err := serverauth.GetCurrentUser(c)
	if err != nil {
		return nil, err
	}
	return tour.MarkSeen(db.Connection(c).WithContext(c.Request.Context()), u.ID, in.Version, in.StepID, in.Revision)
}
