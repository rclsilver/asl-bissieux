package db

import (
	"context"
	"crypto/sha256"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
)

//go:embed migrations/*
var migrationFiles embed.FS

const ledgerDDL = `CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version bigint PRIMARY KEY, name text NOT NULL, checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
)`

type migration struct {
	Version             int
	Name, SQL, Checksum string
}

type appliedMigration struct {
	Version        int
	Name, Checksum string
	AppliedAt      time.Time
}

type MigrationInfo struct {
	Version   int
	Name      string
	Applied   bool
	AppliedAt time.Time
}

type SchemaStatus struct {
	NeedsBaseline bool
	Migrations    []MigrationInfo
}

func loadMigrations() ([]migration, error) {
	paths, err := fs.Glob(migrationFiles, "migrations/[0-9][0-9][0-9][0-9]_*.sql")
	if err != nil {
		return nil, err
	}
	sort.Strings(paths)
	var result []migration
	for i, path := range paths {
		name := strings.TrimPrefix(path, "migrations/")
		version, err := strconv.Atoi(name[:4])
		if err != nil || version != i+1 {
			return nil, fmt.Errorf("migration versions must be contiguous from 0001: %s", name)
		}
		content, err := migrationFiles.ReadFile(path)
		if err != nil {
			return nil, err
		}
		result = append(result, migration{Version: version, Name: name, SQL: string(content), Checksum: fmt.Sprintf("%x", sha256.Sum256(content))})
	}
	if len(result) == 0 {
		return nil, fmt.Errorf("no migrations embedded")
	}
	return result, nil
}

func appliedMigrations(tx *gorm.DB) ([]appliedMigration, error) {
	var exists bool
	if err := tx.Raw("SELECT to_regclass('public.schema_migrations') IS NOT NULL").Scan(&exists).Error; err != nil {
		return nil, err
	}
	if !exists {
		return nil, nil
	}
	var rows []appliedMigration
	err := tx.Raw("SELECT version, name, checksum, applied_at FROM public.schema_migrations ORDER BY version").Scan(&rows).Error
	return rows, err
}

func validateHistory(migrations []migration, applied []appliedMigration) error {
	if len(applied) > len(migrations) {
		return fmt.Errorf("database is newer than this application")
	}
	for i, row := range applied {
		if row.Version != migrations[i].Version || row.Name != migrations[i].Name || row.Checksum != migrations[i].Checksum {
			return fmt.Errorf("migration history mismatch at version %d; do not edit applied migrations", row.Version)
		}
	}
	return nil
}

func hasLegacyTables(tx *gorm.DB) (bool, error) {
	var exists bool
	err := tx.Raw(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public'
    AND table_name IN ('attachment','budget','cotisation','email','email_campaign','email_template','expense','member','member_unit','payment','unit','user'))`).Scan(&exists).Error
	return exists, err
}

func baselineRequired() error {
	return fmt.Errorf("existing unversioned database: back up and verify it, then run 'database baseline' before migration")
}

// MigrationStatus performs no DDL or writes.
func MigrationStatus(ctx context.Context, conn *gorm.DB) (*SchemaStatus, error) {
	migrations, err := loadMigrations()
	if err != nil {
		return nil, err
	}
	tx := conn.WithContext(ctx)
	rows, err := appliedMigrations(tx)
	if err != nil {
		return nil, err
	}
	if err := validateHistory(migrations, rows); err != nil {
		return nil, err
	}
	status := &SchemaStatus{}
	if len(rows) == 0 {
		status.NeedsBaseline, err = hasLegacyTables(tx)
		if err != nil {
			return nil, err
		}
	}
	for i, m := range migrations {
		info := MigrationInfo{Version: m.Version, Name: m.Name, Applied: i < len(rows)}
		if info.Applied {
			info.AppliedAt = rows[i].AppliedAt
		}
		status.Migrations = append(status.Migrations, info)
	}
	return status, nil
}

func CheckCurrent(ctx context.Context, conn *gorm.DB) error {
	status, err := MigrationStatus(ctx, conn)
	if err != nil {
		return err
	}
	if status.NeedsBaseline {
		return baselineRequired()
	}
	for _, info := range status.Migrations {
		if !info.Applied {
			return fmt.Errorf("pending migration %s: run 'database migrate' before starting the server", info.Name)
		}
	}
	return nil
}

// Migrate serializes application instances and applies SQL and checksums atomically.
func Migrate(ctx context.Context, conn *gorm.DB) error {
	migrations, err := loadMigrations()
	if err != nil {
		return err
	}
	return applyMigrations(ctx, conn, migrations)
}

func applyMigrations(ctx context.Context, conn *gorm.DB, migrations []migration) error {
	return conn.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SELECT pg_advisory_xact_lock(714067239105)").Error; err != nil {
			return err
		}
		rows, err := appliedMigrations(tx)
		if err != nil {
			return err
		}
		if err := validateHistory(migrations, rows); err != nil {
			return err
		}
		if len(rows) == 0 {
			legacy, err := hasLegacyTables(tx)
			if err != nil {
				return err
			}
			if legacy {
				return baselineRequired()
			}
		}
		if err := tx.Exec(ledgerDDL).Error; err != nil {
			return err
		}
		for _, m := range migrations[len(rows):] {
			if err := tx.Exec(m.SQL).Error; err != nil {
				return fmt.Errorf("migration %s failed: %w", m.Name, err)
			}
			if err := tx.Exec("INSERT INTO public.schema_migrations (version, name, checksum) VALUES (?, ?, ?)", m.Version, m.Name, m.Checksum).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// Baseline adopts only a structurally equivalent frozen initial schema. It never
// rebuilds a table or updates application rows, or applies later versions.
func Baseline(ctx context.Context, conn *gorm.DB) error {
	migrations, err := loadMigrations()
	if err != nil {
		return err
	}
	return conn.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SELECT pg_advisory_xact_lock(714067239105)").Error; err != nil {
			return err
		}
		rows, err := appliedMigrations(tx)
		if err != nil {
			return err
		}
		if err := validateHistory(migrations, rows); err != nil {
			return err
		}
		if len(rows) != 0 {
			return nil
		}
		if err := validateBaseline(tx); err != nil {
			return err
		}
		if err := tx.Exec(ledgerDDL).Error; err != nil {
			return err
		}
		m := migrations[0]
		return tx.Exec("INSERT INTO public.schema_migrations (version, name, checksum) VALUES (?, ?, ?)", m.Version, m.Name, m.Checksum).Error
	})
}

func validateBaseline(tx *gorm.DB) error {
	query, err := migrationFiles.ReadFile("migrations/baseline_signature.sql")
	if err != nil {
		return err
	}
	expected, err := migrationFiles.ReadFile("migrations/0001_baseline_signature.txt")
	if err != nil {
		return err
	}
	if err := tx.Exec("SET LOCAL search_path TO public, pg_catalog").Error; err != nil {
		return err
	}
	var actual []string
	if err := tx.Raw(string(query)).Scan(&actual).Error; err != nil {
		return err
	}
	want, err := normalizeBaselineSignature(strings.Split(strings.TrimSpace(string(expected)), "\n"))
	if err != nil {
		return err
	}
	actual, err = normalizeBaselineSignature(actual)
	if err != nil {
		return err
	}
	if len(actual) != len(want) {
		return fmt.Errorf("schema differs from baseline (%d entries, expected %d); no changes were made", len(actual), len(want))
	}
	for i := range want {
		if want[i] != actual[i] {
			return fmt.Errorf("schema differs from baseline near %q; no changes were made", strings.SplitN(want[i], ":{", 2)[0])
		}
	}
	return nil
}

// Column order and duplicate equivalent foreign keys can vary across historical
// GORM schemas. They do not change the constraints enforced on application rows.
// Keep types, defaults, nullability, checks, FK targets/actions and indexes exact.
func normalizeBaselineSignature(entries []string) ([]string, error) {
	unique := make(map[string]struct{}, len(entries))
	for _, entry := range entries {
		parts := strings.SplitN(entry, ":", 4)
		if len(parts) == 4 {
			switch parts[0] {
			case "column":
				var definition map[string]json.RawMessage
				if err := json.Unmarshal([]byte(parts[3]), &definition); err != nil {
					return nil, fmt.Errorf("invalid baseline column metadata for %s.%s: %w", parts[1], parts[2], err)
				}
				delete(definition, "position")
				data, err := json.Marshal(definition)
				if err != nil {
					return nil, err
				}
				entry = strings.Join(parts[:3], ":") + ":" + string(data)
			case "constraint":
				if strings.HasPrefix(parts[3], "FOREIGN KEY (") {
					entry = "foreign-key:" + parts[1] + ":" + parts[3]
				}
			}
		}
		unique[entry] = struct{}{}
	}
	result := make([]string, 0, len(unique))
	for entry := range unique {
		result = append(result, entry)
	}
	sort.Strings(result)
	return result, nil
}
