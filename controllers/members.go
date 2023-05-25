package controllers

import (
	"fmt"

	"github.com/juju/errors"
	"gorm.io/gorm"

	"github.com/rclsilver/asl-bissieux/models"
)

func ListMembers(tx *gorm.DB) ([]*models.Member, error) {
	var result []*models.Member

	if err := tx.Preload("Units").Find(&result).Error; err != nil {
		return nil, err
	}

	return result, nil
}

func GetMember(tx *gorm.DB, memberID string) (*models.Member, error) {
	if err := validateUUID(memberID); err != nil {
		return nil, errors.NewNotFound(nil, fmt.Sprintf("member %q not found", memberID))
	}

	var row models.Member

	if err := tx.Preload("Units").First(&row, "id = ?", memberID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("member %q not found", memberID))
		}
		return nil, err
	}

	return &row, nil
}

func DeleteMember(tx *gorm.DB, memberID string) error {
	row, err := GetMember(tx, memberID)
	if err != nil {
		return err
	}

	return tx.Select("Units").Delete(row).Error
}
