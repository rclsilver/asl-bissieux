package handlers

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/juju/errors"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/db"
)

type lisUnitsIn struct{}

// ListUnits returns the list of the units
func ListUnits(c *gin.Context, in *lisUnitsIn) ([]*models.Unit, error) {
	db := db.Connection()

	var result []*models.Unit
	if err := db.Order("number ASC").Preload("Members").Find(&result).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get units")
		return nil, err
	}

	return result, nil
}

type getUnitIn struct {
	ID string `path:"id"`
}

// GetUnit get an unit
func GetUnit(c *gin.Context, in *getUnitIn) (*models.Unit, error) {
	if err := validateUUID(in.ID, "invalid unit ID"); err != nil {
		return nil, err
	}

	db := db.Connection()
	var row models.Unit

	if err := db.Where("id = ?", in.ID).Preload("Members").First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("unit %q not found", in.ID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get unit")
		return nil, err
	}

	return &row, nil
}

type createUnitIn struct {
	Number  int    `json:"number" binding:"required"`
	Address string `json:"address" binding:"required"`
	Share   int    `json:"share" binding:"required"`
}

const (
	CreateUnitAction = "units.CreateUnit"
)

// CreateUnit create an unit
func CreateUnit(c *gin.Context, in *createUnitIn) (*models.Unit, error) {
	db := db.Connection()
	row := models.NewUnit(in.Number, in.Address, in.Share)

	if err := db.Create(row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to create unit")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Infof("unit %d (%s) created", row.Number, row.ID)

	return row, nil
}

type updateUnitIn struct {
	ID string `path:"id"`

	createUnitIn
}

const (
	UpdateUnitAction = "units.UpdateUnit"
)

// UpdateUnit update an unit
func UpdateUnit(c *gin.Context, in *updateUnitIn) (*models.Unit, error) {
	if err := validateUUID(in.ID, "invalid unit ID"); err != nil {
		return nil, err
	}

	db := db.Connection()
	var row models.Unit

	if err := db.Where("id = ?", in.ID).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("unit %q not found", in.ID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to update unit")
		return nil, err
	}

	row.Number = in.Number
	row.Address = in.Address
	row.Share = in.Share

	if err := db.Where("id = ?", in.ID).Updates(&row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to update unit")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Error("unit %s updated", row.ID)

	return &row, nil
}

const (
	DeleteUnitAction = "units.DeleteUnit"
)

type deleteUnitIn struct {
	ID string `path:"id"`
}

// DeleteUnit delete an unit
func DeleteUnit(c *gin.Context, in *deleteUnitIn) error {
	if err := validateUUID(in.ID, "invalid unit ID"); err != nil {
		return err
	}

	db := db.Connection()
	var row models.Unit

	if err := db.Where("id = ?", in.ID).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.NewNotFound(nil, fmt.Sprintf("unit %q not found", in.ID))
		}
		return err
	}

	if err := db.Select("Members").Delete(&row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to delete unit")
		return err
	}
	logrus.WithContext(c.Request.Context()).Infof("unit %q deleted", row.ID)

	return nil
}
