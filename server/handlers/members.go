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

type listMembersIn struct{}

// ListMembers returns the list of the members
func ListMembers(c *gin.Context, in *listMembersIn) ([]*models.Member, error) {
	result, err := controllers.ListMembers(db.Connection())
	if err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get members")
	}

	return result, nil
}

type getMemberIn struct {
	MemberID string `path:"member_id"`
}

// GetMember get a member
func GetMember(c *gin.Context, in *getMemberIn) (*models.Member, error) {
	member, err := controllers.GetMember(db.Connection(), in.MemberID)
	if err != nil {
		if !errors.IsNotFound(err) {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get member")
		}
		return nil, err
	}

	return member, nil
}

type createMemberIn struct {
	FirstName string `json:"first_name" binding:"required"`
	LastName  string `json:"last_name" binding:"required"`

	Email       string `json:"email"`
	PhoneNumber string `json:"phone_number"`
	Address     string `json:"address"`
}

const (
	CreateMemberAction = "member.CreateMember"
)

// CreateMember create a member
func CreateMember(c *gin.Context, in *createMemberIn) (*models.Member, error) {
	row := models.NewMember(in.FirstName, in.LastName, in.PhoneNumber, in.Email, in.Address)
	db := db.Connection()

	if err := db.Create(row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to create member")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Infof("member %s %s (%s) created", row.FirstName, row.LastName, row.ID)

	return row, nil
}

type updateMemberIn struct {
	MemberID string `path:"member_id"`

	createMemberIn
}

const (
	UpdateMemberAction = "member.UpdateMember"
)

// UpdateMember update a member
func UpdateMember(c *gin.Context, in *updateMemberIn) (*models.Member, error) {
	if err := validateUUID(in.MemberID, "invalid member ID"); err != nil {
		return nil, err
	}

	db := db.Connection()
	var row models.Member

	if err := db.Where("id = ?", in.MemberID).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("member %q not found", in.MemberID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to update member")
		return nil, err
	}

	row.FirstName = in.FirstName
	row.LastName = in.LastName
	row.Email = in.Email
	row.PhoneNumber = in.PhoneNumber
	row.Address = in.Address

	if err := db.Updates(&row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to update member")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Error("member %s updated", row.ID)

	return &row, nil
}

const (
	DeleteMemberAction = "member.DeleteMember"
)

type deleteMemberIn struct {
	MemberID string `path:"member_id"`
}

// DeleteMember delete a member
func DeleteMember(c *gin.Context, in *deleteMemberIn) error {
	db := db.Connection().Begin()
	if db.Error != nil {
		logrus.WithContext(c.Request.Context()).WithError(db.Error).Error("unable to begin transaction")
		return db.Error
	}
	defer db.Rollback()

	if err := controllers.DeleteMember(db, in.MemberID); err != nil {
		if !errors.IsNotFound(err) {
			logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to delete member")
		}
		return err
	}

	logrus.WithContext(c.Request.Context()).Infof("member %q deleted", in.MemberID)

	if err := db.Commit().Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to commit transaction")
		return err
	}

	return nil
}

const (
	LinkUnitAction = "member.LinkUnit"
)

type addMemberUnitIn struct {
	MemberID string `path:"member_id"`
	UnitID   string `json:"unit_id" binding:"required"`
}

// AddMemberUnit link an unit to a member
func AddMemberUnit(c *gin.Context, in *addMemberUnitIn) error {
	if err := validateUUID(in.MemberID, "invalid member ID"); err != nil {
		return err
	}

	if err := validateUUID(in.UnitID, "invalid unit ID"); err != nil {
		return err
	}

	db := db.Connection().Begin()
	if db.Error != nil {
		logrus.WithContext(c.Request.Context()).WithError(db.Error).Error("unable to begin transaction")
		return db.Error
	}
	defer db.Rollback()

	var member models.Member

	if err := db.Where("id = ?", in.MemberID).Preload("Units").First(&member).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.NewNotFound(nil, fmt.Sprintf("member %q not found", in.MemberID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get member")
		return err
	}

	var unit models.Unit

	if err := db.Where("id = ?", in.UnitID).First(&unit).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.NewNotFound(nil, fmt.Sprintf("unit %q not found", in.UnitID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get unit")
		return err
	}

	for _, u := range member.Units {
		if u.ID == unit.ID {
			db.Rollback()
			logrus.WithContext(c.Request.Context()).Infof("unit %q already linked to member %q", in.UnitID, in.MemberID)
			return nil
		}
	}

	if err := db.Model(&member).Association("Units").Append(&unit); err != nil {
		db.Rollback()
		logrus.WithContext(c.Request.Context()).WithError(err).Errorf("unable to link unit %q to member %q", in.UnitID, in.MemberID)
		return err
	}

	logrus.WithContext(c.Request.Context()).Infof("unit %q linked to member %q", in.UnitID, in.MemberID)

	if err := db.Commit().Error; err != nil {
		db.Rollback()
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to commit the transaction")
		return err
	}

	return nil
}

const (
	UnlinkUnitAction = "member.UnlinkUnit"
)

type removeMemberUnitIn struct {
	MemberID string `path:"member_id"`
	UnitID   string `path:"unit_id"`
}

// RemoveMemberUnit unlink an unit to a member
func RemoveMemberUnit(c *gin.Context, in *removeMemberUnitIn) error {
	if err := validateUUID(in.MemberID, "invalid member ID"); err != nil {
		return err
	}

	if err := validateUUID(in.UnitID, "invalid unit ID"); err != nil {
		return err
	}

	db := db.Connection().Begin()
	if db.Error != nil {
		logrus.WithContext(c.Request.Context()).WithError(db.Error).Error("unable to begin transaction")
		return db.Error
	}
	defer db.Rollback()

	var member models.Member

	if err := db.Where("id = ?", in.MemberID).Preload("Units").First(&member).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.NewNotFound(nil, fmt.Sprintf("member %q not found", in.MemberID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get member")
		return err
	}

	var unit models.Unit

	if err := db.Where("id = ?", in.UnitID).First(&unit).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.NewNotFound(nil, fmt.Sprintf("unit %q not found", in.UnitID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get unit")
		return err
	}

	if err := db.Model(&member).Association("Units").Delete(&unit); err != nil {
		db.Rollback()
		logrus.WithContext(c.Request.Context()).WithError(err).Errorf("unable to unlink unit %q from member %q", in.UnitID, in.MemberID)
		return err
	}

	logrus.WithContext(c.Request.Context()).Infof("unit %q unlinked from member %q", in.UnitID, in.MemberID)

	if err := db.Commit().Error; err != nil {
		db.Rollback()
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to commit the transaction")
		return err
	}

	return nil
}
