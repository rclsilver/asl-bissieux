package models

import (
	"github.com/rclsilver/asl-bissieux/pkg/db"
)

func init() {
	db.RegisterMigration(&Unit{})
}

type Unit struct {
	db.Model

	Number  int    `json:"number" gorm:"uniqueIndex;notNull"`
	Address string `json:"address" gorm:"uniqueIndex;notNull"`

	Share int `json:"share" gorm:"notNull"`

	Members []*Member `json:"members,omitempty" gorm:"many2many:member_unit"`
}

func NewUnit(number int, address string, share int) *Unit {
	u := &Unit{
		Number:  number,
		Address: address,
		Share:   share,
	}

	return u
}

// TableName give to gorm the table name to use
func (Unit) TableName() string {
	return "unit"
}
