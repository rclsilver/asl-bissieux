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
	db := db.Connection(c)

	var result []*models.Unit
	if err := db.Order("number ASC").Preload("Members").Find(&result).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get units")
		return nil, err
	}

	return result, nil
}

type getUnitIn struct {
	UnitID string `path:"unit_id"`
}

// GetUnit get an unit
func GetUnit(c *gin.Context, in *getUnitIn) (*models.Unit, error) {
	if err := validateUUID(in.UnitID, "invalid unit ID"); err != nil {
		return nil, err
	}

	db := db.Connection(c)
	var row models.Unit

	if err := db.Where("id = ?", in.UnitID).Preload("Members").First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("unit %q not found", in.UnitID))
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
	CreateUnitAction = "unit.CreateUnit"
)

// CreateUnit create an unit
func CreateUnit(c *gin.Context, in *createUnitIn) (*models.Unit, error) {
	db := db.Connection(c)
	row := models.NewUnit(in.Number, in.Address, in.Share)

	if err := db.Create(row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to create unit")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Infof("unit %d (%s) created", row.Number, row.ID)

	return row, nil
}

type updateUnitIn struct {
	UnitID string `path:"unit_id"`

	createUnitIn
}

const (
	UpdateUnitAction = "unit.UpdateUnit"
)

// UpdateUnit update an unit
func UpdateUnit(c *gin.Context, in *updateUnitIn) (*models.Unit, error) {
	if err := validateUUID(in.UnitID, "invalid unit ID"); err != nil {
		return nil, err
	}

	db := db.Connection(c)
	var row models.Unit

	if err := db.Where("id = ?", in.UnitID).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("unit %q not found", in.UnitID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to update unit")
		return nil, err
	}

	row.Number = in.Number
	row.Address = in.Address
	row.Share = in.Share

	if err := db.Where("id = ?", in.UnitID).Updates(&row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to update unit")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Error("unit %s updated", row.ID)

	return &row, nil
}

const (
	DeleteUnitAction = "unit.DeleteUnit"
)

type deleteUnitIn struct {
	UnitID string `path:"unit_id"`
}

// DeleteUnit delete an unit
func DeleteUnit(c *gin.Context, in *deleteUnitIn) error {
	if err := validateUUID(in.UnitID, "invalid unit ID"); err != nil {
		return err
	}

	db := db.Connection(c)
	var row models.Unit

	if err := db.Where("id = ?", in.UnitID).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.NewNotFound(nil, fmt.Sprintf("unit %q not found", in.UnitID))
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

type listUnitMembersIn struct {
	UnitID string `path:"unit_id"`
}

// ListUnitMembers get members of an unit
func ListUnitMembers(c *gin.Context, in *listUnitMembersIn) ([]*models.Member, error) {
	if err := validateUUID(in.UnitID, "invalid unit ID"); err != nil {
		return nil, err
	}

	db := db.Connection(c)
	var row models.Unit

	if err := db.Preload("Members").First(&row, "id = ?", in.UnitID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("unit %q not found", in.UnitID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get unit")
		return nil, err
	}

	return row.Members, nil
}
