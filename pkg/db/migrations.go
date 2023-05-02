package db

import "gorm.io/gorm"

var (
	migrations []any
)

func RegisterMigration(model any) {
	migrations = append(migrations, model)
}

func migrate(db *gorm.DB) error {
	for _, migration := range migrations {
		if err := db.AutoMigrate(migration); err != nil {
			return err
		}
	}
	return nil
}
