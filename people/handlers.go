package people

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/rclsilver/asl-bissieux/pkg/db"
)

type listMembersIn struct{}

// ListMembers returns the list of the members
func ListMembers(c *gin.Context, in *listMembersIn) ([]*Member, error) {
	db := db.Connection()

	var result []*Member
	if err := db.Find(&result).Error; err != nil {
		return nil, err
	}

	return result, nil
}

type getMemberIn struct {
	ID string `path:"id"`
}

// GetMember get a member
func GetMember(c *gin.Context, in *getMemberIn) (*Member, error) {
	db := db.Connection()
	var row Member

	if err := db.Where("id = ?", in.ID).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.Status(http.StatusNotFound)
			return nil, nil
		}
		return nil, err
	}

	return &row, nil
}

type createMemberIn struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`

	Email       string `json:"email"`
	PhoneNumber string `json:"phone_number"`

	Units []int32 `json:"units"`
}

const (
	CreateMemberAction = "people.CreateMember"
)

// CreateMember create a member
func CreateMember(c *gin.Context, in *createMemberIn) (*Member, error) {
	db := db.Connection()
	row := New(in.FirstName, in.LastName, in.PhoneNumber, in.Email, in.Units)

	if err := db.Create(row).Error; err != nil {
		return nil, err
	}

	return row, nil
}

type updateMemberIn struct {
	ID string `path:"id"`

	createMemberIn
}

const (
	UpdateMemberAction = "people.UpdateMember"
)

// UpdateMember update a member
func UpdateMember(c *gin.Context, in *updateMemberIn) (*Member, error) {
	db := db.Connection()
	var row Member

	if err := db.Where("id = ?", in.ID).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.Status(http.StatusNotFound)
			return nil, nil
		}
		return nil, err
	}

	row.FirstName = in.FirstName
	row.LastName = in.LastName

	if len(in.Email) > 0 {
		row.Email = &in.Email
	} else {
		row.Email = nil
	}

	if len(in.PhoneNumber) > 0 {
		row.PhoneNumber = &in.PhoneNumber
	} else {
		row.PhoneNumber = nil
	}

	row.Units = in.Units

	if err := db.Where("id = ?", in.ID).Updates(&row).Error; err != nil {
		return nil, err
	}

	return &row, nil
}

const (
	DeleteMemberAction = "people.DeleteMember"
)

type deleteMemberIn struct {
	ID string `path:"id"`
}

// DeleteMember delete a member
func DeleteMember(c *gin.Context, in *deleteMemberIn) error {
	db := db.Connection()
	var row Member

	if err := db.Where("id = ?", in.ID).First(&row).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.Status(http.StatusNotFound)
			return nil
		}
		return err
	}

	if err := db.Delete(&row).Error; err != nil {
		return err
	}

	return nil
}
