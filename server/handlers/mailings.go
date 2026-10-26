package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/rclsilver/asl-bissieux/controllers"
	"github.com/rclsilver/asl-bissieux/pkg/db"
	"github.com/rclsilver/asl-bissieux/pkg/mailings"
)

type mailingSyncIn struct {
	Token string `json:"token" binding:"required"`
}

func PreviewMailingLists(c *gin.Context) (*mailings.Plan, error) {
	return controllers.PreviewMailingLists(db.Connection(c).WithContext(c.Request.Context()))
}
func SyncMailingLists(c *gin.Context, in *mailingSyncIn) (*mailings.Result, error) {
	return controllers.SyncMailingLists(db.Connection(c).WithContext(c.Request.Context()), in.Token)
}
