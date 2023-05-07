package db

import "gorm.io/gorm"

var (
	migrations []any
)

func RegisterMigration(model any) {
	migrations = append(migrations, model)
}

func migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(migrations...); err != nil {
		return err
	}
	return nil
}
