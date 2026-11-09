package server

import (
	"bytes"
	"image/png"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
	"gorm.io/gorm"
)

func TestPublicTrackerOnlyChangesSentEmails(t *testing.T) {
	conn, _ := testdb.Open(t)
	template := models.NewEmailTemplate("Tracker", `{{fail "must not render"}}`, "unused")
	if err := conn.Create(template).Error; err != nil {
		t.Fatal(err)
	}
	campaign := models.NewEmailCampaign("Tracker", template, map[string]any{})
	if err := conn.Create(campaign).Error; err != nil {
		t.Fatal(err)
	}
	attachment := models.NewAttachment(template.ID, "fixture.txt", false, []byte("unused"), "text/plain")
	if err := conn.Create(attachment).Error; err != nil {
		t.Fatal(err)
	}
	var emails []*models.Email
	for _, state := range []models.EmailState{models.Waiting, models.Error, models.Sending, models.Unknown, models.Sent, models.Read} {
		email := models.NewEmail(campaign, "fixture@example.invalid", map[string]any{})
		email.State = state
		if err := conn.Create(email).Error; err != nil {
			t.Fatal(err)
		}
		emails = append(emails, email)
	}
	app := NewServer().WithAuthProvider(&budgetTestProvider{})
	if err := app.Build(); err != nil {
		t.Fatal(err)
	}
	queries, changed := 0, int64(0)
	if err := conn.Callback().Query().Before("gorm:query").Register("tracker_no_select", func(tx *gorm.DB) { queries++ }); err != nil {
		t.Fatal(err)
	}
	if err := conn.Callback().Update().After("gorm:update").Register("tracker_changes", func(tx *gorm.DB) { changed += tx.RowsAffected }); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		conn.Callback().Query().Remove("tracker_no_select")
		conn.Callback().Update().Remove("tracker_changes")
	})
	ids := []string{"invalid", uuid.NewString()}
	for _, email := range emails {
		ids = append(ids, email.ID)
	}
	var expected []byte
	for repeat := 0; repeat < 2; repeat++ {
		for _, id := range ids {
			w := httptest.NewRecorder()
			app.apiRouter.ServeHTTP(w, httptest.NewRequest("GET", "/api/email/"+id+"/tracker", nil))
			if w.Code != 200 || w.Header().Get("Content-Type") != "image/png" || w.Header().Get("Cache-Control") != "no-store" {
				t.Fatalf("tracker: %d %v", w.Code, w.Header())
			}
			if expected == nil {
				expected = append([]byte(nil), w.Body.Bytes()...)
			}
			if !bytes.Equal(expected, w.Body.Bytes()) {
				t.Fatal("tracker response reveals email state")
			}
		}
	}
	if queries != 0 || changed != 1 {
		t.Fatalf("tracker SELECTs=%d, changed=%d", queries, changed)
	}
	conn.Callback().Query().Remove("tracker_no_select")
	conn.Callback().Update().Remove("tracker_changes")
	for _, email := range emails {
		var stored models.Email
		if err := conn.First(&stored, "id = ?", email.ID).Error; err != nil {
			t.Fatal(err)
		}
		want := email.State
		if want == models.Sent {
			want = models.Read
		}
		if stored.State != want {
			t.Fatalf("state %s became %s", email.State, stored.State)
		}
	}
	img, err := png.Decode(bytes.NewReader(expected))
	if err != nil {
		t.Fatal(err)
	}
	_, _, _, alpha := img.At(0, 0).RGBA()
	if img.Bounds().Dx() != 1 || img.Bounds().Dy() != 1 || alpha != 0 {
		t.Fatal("expected transparent 1x1 pixel")
	}
}
