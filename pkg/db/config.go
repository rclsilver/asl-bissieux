package db

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/rclsilver/asl-bissieux/pkg/config"
)

type Dialect string

const (
	Postgresql Dialect = "postgresql"
)

type dbConfig struct {
	Dialect  Dialect
	Migrate  bool
	Host     string
	Port     int
	Username string
	Password string
	Base     string
	TimeZone string
}

func (c *dbConfig) SetDefaults() {
	c.Dialect = Postgresql
	c.Migrate = false
	c.TimeZone = "UTC"

	c.Host = "localhost"
	c.Port = 5432
}

func (c *dbConfig) Dialector() gorm.Dialector {
	return postgres.Open(fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable TimeZone=%s", c.Host, c.Port, c.Username, c.Password, c.Base, c.TimeZone))
}

var (
	cfg dbConfig
)

func init() {
	config.RegisterSection("db", &cfg)
}
