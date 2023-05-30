package db

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Model struct {
	// ID is the primary key
	ID string `json:"id" gorm:"type:uuid;primaryKey"`

	// CreatedAt is the date of creation of the record
	CreatedAt time.Time `json:"created_at"`

	// UpdatedAt is the date of the last modification of the record
	UpdatedAt time.Time `json:"updated_at"`

	// DeletedAt is the  date of deletion of the record
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

func (b *Model) BeforeCreate(tx *gorm.DB) error {
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	return nil
}
