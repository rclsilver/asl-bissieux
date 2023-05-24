package controllers

import (
	"context"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/juju/errors"
	"github.com/sirupsen/logrus"

	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/smtp"
)

func ListEmails(tx *gorm.DB) ([]*models.Email, error) {
	var result []*models.Email

	return result, tx.Order("created_at ASC").Find(&result).Error
}

func GetEmail(tx *gorm.DB, emailID string, lock bool) (*models.Email, error) {
	if err := validateUUID(emailID); err != nil {
		return nil, errors.NewNotFound(nil, fmt.Sprintf("email %q not found", emailID))
	}

	var row models.Email

	if lock {
		tx = tx.Clauses(clause.Locking{Strength: "UPDATE"})
	}

	return &row, tx.First(&row, "id = ?", emailID).Error
}

func DeleteEmail(tx *gorm.DB, emailID string) error {
	if err := validateUUID(emailID); err != nil {
		return errors.NewNotFound(nil, fmt.Sprintf("email %q not found", emailID))
	}

	return tx.Delete(&models.Email{}, "id = ?", emailID).Error
}

func SendEmail(c context.Context, tx *gorm.DB, emailID string, wait bool) error {
	email, err := GetEmail(tx, emailID, true)
	if err != nil {
		return err
	}

	if email.State != models.Waiting && email.State != models.Error {
		return errors.BadRequestf("cannot send an email which has %s state", email.State)
	}

	done := make(chan error)

	go func() {
		if err := smtp.Send(c, email.To, email.Subject, email.Message, email.ID); err != nil {
			email.State = models.Error
			email.Error = err.Error()
			logrus.WithContext(c).WithError(err).Errorf("email %s to %s (%s) not sent", email.Subject, email.To, email.ID)
		} else {
			email.State = models.Sent
			email.Error = ""
			logrus.WithContext(c).Infof("email %s to %s (%s) sent", email.Subject, email.To, email.ID)
		}

		if err := tx.Model(email).Where("id = ?", emailID).Updates(map[string]any{
			"state": email.State,
			"error": email.Error,
		}).Error; err != nil {
			logrus.WithContext(c).WithError(err).Error("unable to update email")
		}

		if email.Error != "" {
			done <- fmt.Errorf(email.Error)
		} else {
			done <- nil
		}
	}()

	if wait {
		return <-done
	}

	return nil
}

func MarkAsRead(c context.Context, tx *gorm.DB, emailID string) error {
	if err := tx.Model(&models.Email{}).Where("id = ?", emailID).Updates(map[string]any{
		"state": models.Read,
	}).Error; err != nil {
		return err
	}
	return nil
}
