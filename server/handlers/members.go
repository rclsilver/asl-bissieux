package handlers

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/juju/errors"
	"github.com/mitchellh/mapstructure"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/db"
)

type listMembersIn struct{}

// ListMembers returns the list of the members
func ListMembers(c *gin.Context, in *listMembersIn) ([]*models.Member, error) {
	db := db.Connection()

	var result []*models.Member
	if err := db.Preload("Units").Find(&result).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get members")
		return nil, err
	}

	return result, nil
}

type getMemberIn struct {
	ID string `path:"id"`
}

// GetMember get a member
func GetMember(c *gin.Context, in *getMemberIn) (*models.Member, error) {
	if err := validateUUID(in.ID, "invalid member ID"); err != nil {
		return nil, err
	}

	db := db.Connection()
	var row models.Member

	if err := db.Where("id = ?", in.ID).Preload("Units").First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("member %q not found", in.ID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get member")
		return nil, err
	}

	return &row, nil
}

type createMemberIn struct {
	FirstName string `json:"first_name" binding:"required"`
	LastName  string `json:"last_name" binding:"required"`

	Email       string `json:"email"`
	PhoneNumber string `json:"phone_number"`
	Address     string `json:"address"`
}

func (in *createMemberIn) toMap() (map[string]any, error) {
	var data map[string]any

	dec, err := mapstructure.NewDecoder(&mapstructure.DecoderConfig{
		TagName: "json",
		Result:  &data,
	})
	if err != nil {
		return nil, err
	}

	if err := dec.Decode(in); err != nil {
		return nil, err
	}

	if len(in.Email) == 0 {
		data["email"] = nil
	}

	if len(in.PhoneNumber) == 0 {
		data["phone_number"] = nil
	}

	if len(in.Address) == 0 {
		data["address"] = nil
	}

	return data, nil
}

const (
	CreateMemberAction = "members.CreateMember"
)

// CreateMember create a member
func CreateMember(c *gin.Context, in *createMemberIn) (*models.Member, error) {
	data, err := in.toMap()
	if err != nil {
		return nil, err
	}

	db := db.Connection()

	var row models.Member

	if err := db.Model(&row).Create(data).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to create member")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Infof("member %s %s (%s) created", row.FirstName, row.LastName, row.ID)

	return &row, nil
}

type updateMemberIn struct {
	ID string `path:"id"`

	createMemberIn
}

const (
	UpdateMemberAction = "members.UpdateMember"
)

// UpdateMember update a member
func UpdateMember(c *gin.Context, in *updateMemberIn) (*models.Member, error) {
	if err := validateUUID(in.ID, "invalid member ID"); err != nil {
		return nil, err
	}

	data, err := in.toMap()
	if err != nil {
		return nil, err
	}

	db := db.Connection()
	var row models.Member

	if err := db.Where("id = ?", in.ID).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("member %q not found", in.ID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to update member")
		return nil, err
	}

	if err := db.Model(&row).Updates(&data).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to update member")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Error("member %s updated", row.ID)

	return &row, nil
}

const (
	DeleteMemberAction = "members.DeleteMember"
)

type deleteMemberIn struct {
	ID string `path:"id"`
}

// DeleteMember delete a member
func DeleteMember(c *gin.Context, in *deleteMemberIn) error {
	if err := validateUUID(in.ID, "invalid member ID"); err != nil {
		return err
	}

	db := db.Connection().Begin()
	if db.Error != nil {
		logrus.WithContext(c.Request.Context()).WithError(db.Error).Error("unable to begin transaction")
		return db.Error
	}
	defer db.Rollback()

	var row models.Member

	if err := db.Where("id = ?", in.ID).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.NewNotFound(nil, fmt.Sprintf("member %q not found", in.ID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to delete member")
		return err
	}

	if err := db.Select("Units").Delete(&row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to delete member")
		return err
	}
	logrus.WithContext(c.Request.Context()).Infof("member %q deleted", row.ID)

	if err := db.Commit().Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to commit transaction")
		return err
	}

	return nil
}

const (
	LinkUnitAction = "members.LinkUnit"
)

type addMemberUnitIn struct {
	MemberID string `path:"id"`
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
	UnlinkUnitAction = "members.UnlinkUnit"
)

type removeMemberUnitIn struct {
	MemberID string `path:"id"`
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
