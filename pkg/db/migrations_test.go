package db

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func migrationTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL for migration integration tests")
	}
	u, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
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
	if _, err := admin.Exec("CREATE DATABASE " + pq.QuoteIdentifier(name)); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := admin.Exec("DROP DATABASE " + pq.QuoteIdentifier(name) + " WITH (FORCE)"); err != nil {
			t.Error(err)
		}
	})
	u.Path = "/" + name
	conn, err := gorm.Open(postgres.Open(u.String()), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	pool, err := conn.DB()
	if err != nil {
		t.Fatal(err)
	}
	pool.SetMaxOpenConns(8)
	t.Cleanup(func() { pool.Close() })
	return conn
}

func assertNoLedger(t *testing.T, conn *gorm.DB) {
	t.Helper()
	var exists bool
	if err := conn.Raw("SELECT to_regclass('public.schema_migrations') IS NOT NULL").Scan(&exists).Error; err != nil || exists {
		t.Fatalf("ledger unexpectedly exists: %t, %v", exists, err)
	}
}

func applicationFingerprint(t *testing.T, conn *gorm.DB) map[string]string {
	t.Helper()
	var tables []string
	if err := conn.Raw("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'").Scan(&tables).Error; err != nil {
		t.Fatal(err)
	}
	result := make(map[string]string)
	for _, table := range tables {
		var hash string
		query := "SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text, '[]')) FROM public." + pq.QuoteIdentifier(table) + " t"
		if err := conn.Raw(query).Scan(&hash).Error; err != nil {
			t.Fatal(err)
		}
		result[table] = hash
	}
	return result
}

// Successful upgrades may add empty tables, while all existing rows stay byte-identical.
func assertUpgradePreservesData(t *testing.T, conn *gorm.DB, before map[string]string) {
	t.Helper()
	after := applicationFingerprint(t, conn)
	// Migration 0007 adds a role column. Compare all original member values,
	// then independently require the new role to default to false.
	var legacyMemberHash string
	if err := conn.Raw("SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) - 'bureau' ORDER BY (to_jsonb(t) - 'bureau')::text)::text, '[]')) FROM public.member t").Scan(&legacyMemberHash).Error; err != nil {
		t.Fatal(err)
	}
	after["member"] = legacyMemberHash
	var legacyUserHash string
	if err := conn.Raw(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) - 'tour_version' ORDER BY (to_jsonb(t) - 'tour_version')::text)::text, '[]')) FROM public."user" t`).Scan(&legacyUserHash).Error; err != nil {
		t.Fatal(err)
	}
	after["user"] = legacyUserHash
	var seenTours int64
	if err := conn.Raw(`SELECT count(*) FROM public."user" WHERE tour_version <> 0`).Scan(&seenTours).Error; err != nil || seenTours != 0 {
		t.Fatalf("existing users acquired tour progress: %d, %v", seenTours, err)
	}
	var unexpectedBureau int64
	if err := conn.Raw("SELECT count(*) FROM public.member WHERE bureau IS DISTINCT FROM false").Scan(&unexpectedBureau).Error; err != nil || unexpectedBureau != 0 {
		t.Fatalf("existing members gained bureau status: %d, %v", unexpectedBureau, err)
	}
	for table := range after {
		if _, exists := before[table]; !exists {
			var count int64
			if err := conn.Table(table).Count(&count).Error; err != nil || count != 0 {
				t.Fatalf("new table %s is not empty: %d, %v", table, count, err)
			}
			delete(after, table)
		}
	}
	if !reflect.DeepEqual(before, after) {
		t.Fatalf("application data changed: %v vs %v", before, after)
	}
}

const legacyFixture = `
INSERT INTO public."user" (id, username, enabled, admin, actions) VALUES ('10000000-0000-4000-8000-000000000001','operator@example.invalid',true,true,ARRAY['budget.CreatePayment']);
INSERT INTO public.budget (id,label,draft) VALUES ('10000000-0000-4000-8000-000000000002','Anonymised budget',false);
INSERT INTO public.unit (id,number,address,share) VALUES ('20000000-0000-4000-8000-000000000001',1,'Fictitious address',1);
INSERT INTO public.member (id,first_name,last_name,email) VALUES ('50000000-0000-4000-8000-000000000001','Example','Member','member@example.invalid');
INSERT INTO public.member_unit (member_id,unit_id) VALUES ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
INSERT INTO public.expense (id,budget_id,label,amount) VALUES ('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Fictitious expense',100.25);
INSERT INTO public.cotisation (id,budget_id,unit_id,amount) VALUES ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',100.25);
INSERT INTO public.payment (id,cotisation_id,user_id,date,amount,comment) VALUES ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','2026-01-01T00:00:00Z',25.01,'Preserve me');
INSERT INTO public.email_template (id,label,subject,message) VALUES ('60000000-0000-4000-8000-000000000001','Example','Subject','Body');
INSERT INTO public.email_campaign (id,title,email_template_id,data) VALUES ('70000000-0000-4000-8000-000000000001','Example','60000000-0000-4000-8000-000000000001','{}');
INSERT INTO public.email (id,email_campaign_id,"to",data,state,subject,message,error) VALUES ('80000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','member@example.invalid','{}','UNKNOWN','Prepared subject','Prepared body','Verify delivery');
`

func TestMigrationsIntegration(t *testing.T) {
	migrations, err := loadMigrations()
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	t.Run("empty database and idempotent startup", func(t *testing.T) {
		conn := migrationTestDB(t)
		status, err := MigrationStatus(ctx, conn)
		if err != nil || status.NeedsBaseline || status.Migrations[0].Applied {
			t.Fatalf("unexpected initial status: %+v, %v", status, err)
		}
		assertNoLedger(t, conn)
		if err := CheckCurrent(ctx, conn); err == nil {
			t.Fatal("empty database was treated as current")
		}
		if err := Migrate(ctx, conn); err != nil {
			t.Fatal(err)
		}
		if err := Migrate(ctx, conn); err != nil {
			t.Fatal(err)
		}
		if err := CheckCurrent(ctx, conn); err != nil {
			t.Fatal(err)
		}
		var count int64
		conn.Raw("SELECT count(*) FROM public.schema_migrations").Scan(&count)
		if count != int64(len(migrations)) {
			t.Fatalf("migration applied %d times", count)
		}
	})
	t.Run("legacy data and permissions preserved by explicit adoption", func(t *testing.T) {
		conn := migrationTestDB(t)
		if err := conn.Exec(migrations[0].SQL).Error; err != nil {
			t.Fatal(err)
		}
		if err := conn.Transaction(validateBaseline); err != nil {
			t.Fatal(err)
		}
		if err := conn.Exec(legacyFixture).Error; err != nil {
			t.Fatal(err)
		}
		before := applicationFingerprint(t, conn)
		if err := Migrate(ctx, conn); err == nil {
			t.Fatal("unversioned data was adopted implicitly")
		}
		assertNoLedger(t, conn)
		if err := Baseline(ctx, conn); err != nil {
			t.Fatal(err)
		}
		if err := Baseline(ctx, conn); err != nil {
			t.Fatal(err)
		}
		if err := Migrate(ctx, conn); err != nil {
			t.Fatal(err)
		}
		assertUpgradePreservesData(t, conn, before)
	})
	t.Run("equivalent historical GORM schema with reordered columns and duplicate FK", func(t *testing.T) {
		conn := migrationTestDB(t)
		schema := strings.Replace(migrations[0].SQL,
			"    inline boolean DEFAULT false NOT NULL,\n    email_template_id uuid NOT NULL",
			"    email_template_id uuid NOT NULL,\n    inline boolean DEFAULT false NOT NULL", 1)
		schema = strings.Replace(schema,
			"    email_campaign_id uuid NOT NULL,\n    state text DEFAULT 'WAITING'::text NOT NULL,\n    error text",
			"    state text DEFAULT 'WAITING'::text NOT NULL,\n    error text,\n    email_campaign_id uuid NOT NULL", 1)
		schema = strings.Replace(schema,
			"    title text NOT NULL,\n    email_template_id uuid NOT NULL,\n    data jsonb NOT NULL",
			"    email_template_id uuid NOT NULL,\n    data jsonb NOT NULL,\n    title text NOT NULL", 1)
		if schema == migrations[0].SQL {
			t.Fatal("fixture did not reorder columns")
		}
		if err := conn.Exec(schema).Error; err != nil {
			t.Fatal(err)
		}
		if err := conn.Exec(`ALTER TABLE public.email ADD CONSTRAINT fk_email_email_campaign FOREIGN KEY (email_campaign_id) REFERENCES public.email_campaign(id)`).Error; err != nil {
			t.Fatal(err)
		}
		if err := conn.Exec(legacyFixture).Error; err != nil {
			t.Fatal(err)
		}
		before := applicationFingerprint(t, conn)
		if err := Baseline(ctx, conn); err != nil {
			t.Fatal(err)
		}
		if after := applicationFingerprint(t, conn); !reflect.DeepEqual(before, after) {
			t.Fatal("adoption changed existing rows")
		}
		if err := Migrate(ctx, conn); err != nil {
			t.Fatal(err)
		}
		assertUpgradePreservesData(t, conn, before)
	})
	for _, change := range []string{
		"ALTER TABLE public.unit ADD COLUMN unexpected text",
		"DROP INDEX public.idx_user_username",
		"ALTER TABLE public.expense ALTER COLUMN amount TYPE double precision",
		"ALTER TABLE public.budget ALTER COLUMN draft SET DEFAULT false",
		"ALTER TABLE public.attachment ALTER COLUMN inline DROP NOT NULL",
		`ALTER TABLE public.email DROP CONSTRAINT fk_email_campaign_emails; ALTER TABLE public.email ADD CONSTRAINT renamed FOREIGN KEY (email_campaign_id) REFERENCES public.email_template(id)`,
		`ALTER TABLE public.email DROP CONSTRAINT fk_email_campaign_emails; ALTER TABLE public.email ADD CONSTRAINT renamed FOREIGN KEY (email_campaign_id) REFERENCES public.email_campaign(id) ON DELETE CASCADE`,
		`ALTER TABLE public.email ADD CONSTRAINT deferred_copy FOREIGN KEY (email_campaign_id) REFERENCES public.email_campaign(id) DEFERRABLE INITIALLY DEFERRED`,
		`ALTER TABLE public.email ADD CONSTRAINT unvalidated_copy FOREIGN KEY (email_campaign_id) REFERENCES public.email_campaign(id) NOT VALID`,
	} {
		t.Run("refuse schema drift "+change, func(t *testing.T) {
			conn := migrationTestDB(t)
			if err := conn.Exec(migrations[0].SQL).Error; err != nil {
				t.Fatal(err)
			}
			if err := conn.Exec(change).Error; err != nil {
				t.Fatal(err)
			}
			if err := Baseline(ctx, conn); err == nil {
				t.Fatal("schema drift was adopted")
			}
			assertNoLedger(t, conn)
		})
	}
	t.Run("checksum mismatch and unknown future version", func(t *testing.T) {
		conn := migrationTestDB(t)
		if err := Migrate(ctx, conn); err != nil {
			t.Fatal(err)
		}
		conn.Exec("UPDATE public.schema_migrations SET checksum='changed' WHERE version=1")
		if err := Migrate(ctx, conn); err == nil {
			t.Fatal("changed migration was accepted")
		}
		if err := CheckCurrent(ctx, conn); err == nil {
			t.Fatal("changed checksum passed startup")
		}
		conn.Exec("UPDATE public.schema_migrations SET checksum=? WHERE version=1", migrations[0].Checksum)
		conn.Exec("INSERT INTO public.schema_migrations (version,name,checksum) VALUES (?,'future','future')", len(migrations)+1)
		if err := CheckCurrent(ctx, conn); err == nil {
			t.Fatal("newer schema was accepted by an old binary")
		}
	})
	t.Run("failing migration rolls back DDL and ledger", func(t *testing.T) {
		for _, initiallyEmpty := range []bool{true, false} {
			t.Run(fmt.Sprint(initiallyEmpty), func(t *testing.T) {
				conn := migrationTestDB(t)
				if !initiallyEmpty {
					if err := Migrate(ctx, conn); err != nil {
						t.Fatal(err)
					}
					if err := conn.Exec(legacyFixture).Error; err != nil {
						t.Fatal(err)
					}
				}
				before := applicationFingerprint(t, conn)
				script := "CREATE TABLE public.migration_probe (id int); SELECT * FROM public.deliberately_absent_table;"
				failed := migration{Version: len(migrations) + 1, Name: fmt.Sprintf("%04d_failure.sql", len(migrations)+1), SQL: script, Checksum: fmt.Sprintf("%x", sha256.Sum256([]byte(script)))}
				if err := applyMigrations(ctx, conn, append(append([]migration{}, migrations...), failed)); err == nil {
					t.Fatal("failing migration reported success")
				}
				if after := applicationFingerprint(t, conn); !reflect.DeepEqual(before, after) {
					t.Fatal("failed migration left schema changes")
				}
				if initiallyEmpty {
					assertNoLedger(t, conn)
				} else if err := CheckCurrent(ctx, conn); err != nil {
					t.Fatal(err)
				}
			})
		}
	})
	t.Run("concurrent migrations are serialized", func(t *testing.T) {
		conn := migrationTestDB(t)
		var workers sync.WaitGroup
		results := make(chan error, 4)
		for i := 0; i < 4; i++ {
			workers.Add(1)
			go func() { defer workers.Done(); results <- Migrate(ctx, conn) }()
		}
		workers.Wait()
		close(results)
		for err := range results {
			if err != nil {
				t.Fatal(err)
			}
		}
		if err := CheckCurrent(ctx, conn); err != nil {
			t.Fatal(err)
		}
	})
	t.Run("cancelled lock wait can be retried", func(t *testing.T) {
		conn := migrationTestDB(t)
		lock := conn.Begin()
		defer lock.Rollback()
		if err := lock.Exec("SELECT pg_advisory_xact_lock(714067239105)").Error; err != nil {
			t.Fatal(err)
		}
		deadline, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
		defer cancel()
		if err := Migrate(deadline, conn); err == nil || !strings.Contains(err.Error(), "context") {
			t.Fatalf("lock wait did not respect context: %v", err)
		}
		lock.Rollback()
		if err := Migrate(ctx, conn); err != nil {
			t.Fatal(err)
		}
	})
	t.Run("duplicates require review and soft deleted history is preserved", func(t *testing.T) {
		conn := migrationTestDB(t)
		if err := conn.Exec(migrations[0].SQL).Error; err != nil {
			t.Fatal(err)
		}
		if err := conn.Exec(legacyFixture).Error; err != nil {
			t.Fatal(err)
		}
		insert := `INSERT INTO public.cotisation (id,budget_id,unit_id,amount) VALUES (?,'10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',100.25)`
		duplicate := "30000000-0000-4000-8000-000000000002"
		if err := conn.Exec(insert, duplicate).Error; err != nil {
			t.Fatal(err)
		}
		if err := Baseline(ctx, conn); err != nil {
			t.Fatal(err)
		}
		before := applicationFingerprint(t, conn)
		if err := Migrate(ctx, conn); err == nil {
			t.Fatal("duplicate cotisations were accepted")
		}
		if !reflect.DeepEqual(before, applicationFingerprint(t, conn)) {
			t.Fatal("duplicates were silently changed")
		}
		if err := conn.Exec("UPDATE public.cotisation SET deleted_at=now() WHERE id=?", duplicate).Error; err != nil {
			t.Fatal(err)
		}
		if err := Migrate(ctx, conn); err != nil {
			t.Fatal(err)
		}
		third := "30000000-0000-4000-8000-000000000003"
		if err := conn.Exec(insert, third).Error; err == nil {
			t.Fatal("unique constraint allowed a duplicate active cotisation")
		}
		if err := conn.Exec("UPDATE public.cotisation SET deleted_at=now() WHERE deleted_at IS NULL").Error; err != nil {
			t.Fatal(err)
		}
		if err := conn.Exec(insert, third).Error; err != nil {
			t.Fatal(err)
		}
		var count int64
		conn.Raw("SELECT count(*) FROM public.payment").Scan(&count)
		if count != 1 {
			t.Fatal("historical payment was lost")
		}
	})
	t.Run("new cent rules preserve historical fractions and reject invalid new writes", func(t *testing.T) {
		conn := migrationTestDB(t)
		if err := applyMigrations(ctx, conn, migrations[:2]); err != nil {
			t.Fatal(err)
		}
		if err := conn.Exec(legacyFixture).Error; err != nil {
			t.Fatal(err)
		}
		for _, query := range []string{
			"UPDATE public.expense SET amount=100.251",
			"UPDATE public.cotisation SET amount=100.251",
			"UPDATE public.payment SET amount=25.011",
			"UPDATE public.unit SET share=-1",
		} {
			if err := conn.Exec(query).Error; err != nil {
				t.Fatal(err)
			}
		}
		before := applicationFingerprint(t, conn)
		if err := Migrate(ctx, conn); err != nil {
			t.Fatal(err)
		}
		assertUpgradePreservesData(t, conn, before)
		for _, table := range []string{"expense", "cotisation", "payment"} {
			for _, amount := range []string{"-1", "0.001", "10000000000", "'NaN'::numeric", "'Infinity'::numeric"} {
				if err := conn.Exec("UPDATE public." + table + " SET amount=" + amount).Error; err == nil {
					t.Fatalf("accepted %s amount %s", table, amount)
				}
			}
			// An explicitly unchanged historical value is never rounded.
			if err := conn.Exec("UPDATE public." + table + " SET amount=amount").Error; err != nil {
				t.Fatal(err)
			}
			if err := conn.Exec("UPDATE public." + table + " SET amount=1.23").Error; err != nil {
				t.Fatal(err)
			}
		}
		if err := conn.Exec("UPDATE public.unit SET share=share").Error; err != nil {
			t.Fatal(err)
		}
		if err := conn.Exec("UPDATE public.unit SET share=-2").Error; err == nil {
			t.Fatal("accepted negative new shares")
		}
		if err := conn.Exec("UPDATE public.unit SET share=0").Error; err != nil {
			t.Fatal(err)
		}
		if err := conn.Exec("UPDATE public.cotisation SET amount=0").Error; err != nil {
			t.Fatal(err)
		}
		for _, table := range []string{"expense", "payment"} {
			if err := conn.Exec("UPDATE public." + table + " SET amount=0").Error; err == nil {
				t.Fatalf("accepted zero %s", table)
			}
		}
		if err := conn.Exec(`INSERT INTO public.expense (id,budget_id,label,amount) VALUES ('11000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','Invalid new expense',1.001)`).Error; err == nil {
			t.Fatal("accepted invalid inserted expense")
		}
	})
}
