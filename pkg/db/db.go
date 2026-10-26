package db

import (
	"context"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

var (
	connection *gorm.DB
)

func Open(ctx context.Context) (*gorm.DB, error) {
	db, err := gorm.Open(cfg.Dialector(), &gorm.Config{
		Logger:               newLogger(),
		DisableAutomaticPing: true,
	})
	if err != nil {
		return nil, fmt.Errorf("unable to open database: %w", err)
	}
	pool, err := db.DB()
	if err != nil {
		return nil, err
	}
	if err := pool.PingContext(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("unable to connect to database: %w", err)
	}
	return db.WithContext(ctx), nil
}

func InitDB() error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	conn, err := Open(ctx)
	if err != nil {
		return err
	}
	if cfg.Migrate {
		err = Migrate(ctx, conn)
	} else {
		err = CheckCurrent(ctx, conn)
	}
	if err != nil {
		pool, _ := conn.DB()
		pool.Close()
		return err
	}
	connection = conn.WithContext(context.Background())

	logrus.Debugf("connection to %s:%d (%s) established", cfg.Host, cfg.Port, cfg.Base)

	return nil
}

func Connection(c context.Context) *gorm.DB {
	return connection
}
