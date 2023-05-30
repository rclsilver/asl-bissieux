package db

import (
	"context"
	"fmt"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

var (
	connection *gorm.DB
)

func InitDB() error {
	db, err := gorm.Open(cfg.Dialector(), &gorm.Config{
		Logger: newLogger(),
	})
	if err != nil {
		return fmt.Errorf("unable to open a connection to the database: %v", err)
	}
	connection = db

	logrus.Debugf("connection to %s:%d (%s) established", cfg.Host, cfg.Port, cfg.Base)

	if cfg.Migrate {
		if err := migrate(db); err != nil {
			return err
		}
	}

	return nil
}

func Connection(c context.Context) *gorm.DB {
	return connection
}
