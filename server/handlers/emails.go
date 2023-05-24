package handlers

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/juju/errors"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/rclsilver/asl-bissieux/controllers"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/db"
)

type lisEmailsIn struct{}

// ListEmails returns the list of the emails
func ListEmails(c *gin.Context, in *lisEmailsIn) ([]*models.Email, error) {
	db := db.Connection().WithContext(c)

	result, err := controllers.ListEmails(db)
	if err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get emails")
		return nil, err
	}

	return result, nil
}

type getEmailIn struct {
	EmailID string `path:"email_id"`
}

// GetEmail get an email
func GetEmail(c *gin.Context, in *getEmailIn) (*models.Email, error) {
	db := db.Connection().WithContext(c)

	result, err := controllers.GetEmail(db, in.EmailID, false)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("email %q not found", in.EmailID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get email")
		return nil, err
	}

	return result, nil
}

const (
	DeleteEmailAction = "email.DeleteEmail"
)

type deleteEmailIn struct {
	EmailID string `path:"email_id"`
}

// DeleteEmail delete an email
func DeleteEmail(c *gin.Context, in *deleteEmailIn) error {
	db := db.Connection().WithContext(c)

	if err := controllers.DeleteEmail(db, in.EmailID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.NewNotFound(nil, fmt.Sprintf("email %q not found", in.EmailID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to delete email")
		return err
	}

	return nil
}

const (
	SendEmailAction = "email.SendEmail"
)

type sendEmailIn struct {
	EmailID string `path:"email_id"`
	Wait    bool   `json:"wait"`
}

// SendEmail send an email
func SendEmail(c *gin.Context, in *sendEmailIn) error {
	db := db.Connection().WithContext(c)

	if err := controllers.SendEmail(c, db, in.EmailID, in.Wait); err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.NewNotFound(nil, fmt.Sprintf("email %q not found", in.EmailID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to send email")
		return err
	}

	return nil
}

type trackEmailIn struct {
	EmailID string `path:"email_id"`
}

// SendEmail send an email
func TrackEmail(c *gin.Context, in *trackEmailIn) error {
	db := db.Connection().WithContext(c)

	email, err := controllers.GetEmail(db, in.EmailID, true)
	if err != nil {
		if err != gorm.ErrRecordNotFound {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get email")
		}
	} else if email.State != models.Read {
		if err := controllers.MarkAsRead(c, db, email.ID); err != nil {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to update email")
		}
	}

	c.Header("Content-Type", "image/png")
	c.Writer.Write([]byte{})

	return nil
}
