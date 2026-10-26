package controllers

import (
	"context"
	stdErrors "errors"
	"strings"
	"sync"
	"testing"

	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/attachments"
	"github.com/rclsilver/asl-bissieux/pkg/config"
	"gorm.io/gorm"
)

func TestAttachmentLimitsAndConcurrentAdds(t *testing.T) {
	t.Cleanup(func() { _ = config.Load() })
	conn, _ := testdb.Open(t)
	t.Setenv("APP_ATTACHMENTS_MAX_FILE_BYTES", "8")
	t.Setenv("APP_ATTACHMENTS_MAX_TEMPLATE_BYTES", "12")
	if err := config.Load(); err != nil {
		t.Fatal(err)
	}
	newTemplate := func() string {
		email := emailFixture(t, conn)
		campaign, err := GetEmailCampaign(conn, email.EmailCampaignID)
		if err != nil {
			t.Fatal(err)
		}
		return campaign.EmailTemplateID
	}
	add := func(id string, size int) (*models.Attachment, error) {
		return AddAttachment(conn, id, "fixture.txt", false, "text/plain", make([]byte, size))
	}
	id := newTemplate()
	if _, err := add(id, 9); !stdErrors.Is(err, attachments.ErrTooLarge) {
		t.Fatalf("oversized file accepted: %v", err)
	}
	first, err := add(id, 8)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := add(id, 4); err != nil {
		t.Fatal(err)
	}
	if _, err := add(id, 1); !stdErrors.Is(err, attachments.ErrTooLarge) {
		t.Fatalf("total limit bypassed: %v", err)
	}
	if err := DeleteAttachment(conn, id, first.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := add(id, 8); err != nil {
		t.Fatalf("deleted attachment still counted: %v", err)
	}

	id = newTemplate()
	if _, err := add(id, 4); err != nil {
		t.Fatal(err)
	}
	var workers sync.WaitGroup
	start, results := make(chan struct{}), make(chan error, 2)
	for i := 0; i < 2; i++ {
		workers.Add(1)
		go func() { defer workers.Done(); <-start; _, err := add(id, 5); results <- err }()
	}
	close(start)
	workers.Wait()
	close(results)
	accepted, refused := 0, 0
	for err := range results {
		if err == nil {
			accepted++
		} else if stdErrors.Is(err, attachments.ErrTooLarge) {
			refused++
		} else {
			t.Fatal(err)
		}
	}
	if accepted != 1 || refused != 1 {
		t.Fatalf("concurrent uploads: accepted=%d refused=%d", accepted, refused)
	}
}

func TestOversizedLegacyAttachmentRefusedBeforeDeliveryLoad(t *testing.T) {
	t.Cleanup(func() { _ = config.Load() })
	conn, _ := testdb.Open(t)
	t.Setenv("APP_ATTACHMENTS_MAX_FILE_BYTES", "8")
	t.Setenv("APP_ATTACHMENTS_MAX_TEMPLATE_BYTES", "12")
	smtp := smtpForDelivery(t)
	email := emailFixture(t, conn)
	campaign, err := GetEmailCampaign(conn, email.EmailCampaignID)
	if err != nil {
		t.Fatal(err)
	}
	legacy := models.NewAttachment(campaign.EmailTemplateID, "legacy.txt", false, make([]byte, 13), "text/plain")
	legacy.Size = 1 // A stale metadata size must not bypass the actual byte limit.
	if err := conn.Create(legacy).Error; err != nil {
		t.Fatal(err)
	}
	contentQueries := 0
	conn.Callback().Query().After("gorm:query").Register("legacy_content", func(tx *gorm.DB) {
		if strings.Contains(tx.Statement.SQL.String(), `SELECT * FROM "attachment"`) {
			contentQueries++
		}
	})
	t.Cleanup(func() { conn.Callback().Query().Remove("legacy_content") })
	if err := SendEmail(context.Background(), conn, email.ID, true); !stdErrors.Is(err, attachments.ErrTooLarge) {
		t.Fatalf("legacy file sent: %v", err)
	}
	if smtp.received.Load() != 0 || contentQueries != 0 {
		t.Fatalf("SMTP=%d content queries=%d", smtp.received.Load(), contentQueries)
	}
	waitEmailState(t, conn, email.ID, models.Error)
}
