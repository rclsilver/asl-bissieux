// Package testdb provisions disposable PostgreSQL databases for integration tests.
package testdb

import (
	"context"
	"database/sql"
	"net/url"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/rclsilver/asl-bissieux/pkg/config"
	"github.com/rclsilver/asl-bissieux/pkg/db"
	"gorm.io/gorm"
)

// Open never migrates the database supplied in TEST_DATABASE_URL.
func Open(t *testing.T) (*gorm.DB, *sql.DB) {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	u, err := url.Parse(dsn)
	if err != nil || u.Hostname() == "" || u.User == nil {
		t.Fatal("TEST_DATABASE_URL must be a PostgreSQL URL with host and user")
	}
	query := u.Query()
	query.Set("connect_timeout", "5")
	u.RawQuery = query.Encode()
	admin, err := sql.Open("postgres", u.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Close() })
	name := "asl_test_" + uuid.New().String()[:8]
	if _, err := admin.Exec(`CREATE DATABASE "` + name + `"`); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := admin.Exec(`DROP DATABASE "` + name + `" WITH (FORCE)`); err != nil {
			t.Error(err)
		}
	})
	password, _ := u.User.Password()
	port := u.Port()
	if port == "" {
		port = "5432"
	}
	for key, value := range map[string]string{
		"APP_DB_HOST": u.Hostname(), "APP_DB_PORT": port,
		"APP_DB_USERNAME": u.User.Username(), "APP_DB_PASSWORD": password,
		"APP_DB_BASE": name, "APP_DB_MIGRATE": "true",
	} {
		t.Setenv(key, value)
	}
	if err := config.Load(); err != nil {
		t.Fatal(err)
	}
	if err := db.InitDB(); err != nil {
		t.Fatal(err)
	}
	conn := db.Connection(context.Background())
	pool, err := conn.DB()
	if err != nil {
		t.Fatal(err)
	}
	pool.SetMaxOpenConns(8)
	t.Cleanup(func() { pool.Close() })
	return conn, pool
}
