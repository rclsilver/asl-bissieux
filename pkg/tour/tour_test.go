package tour

import (
	"github.com/juju/errors"
	"github.com/lib/pq"
	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"sync"
	"testing"
)

func TestCatalogueRightsAndDiff(t *testing.T) {
	viewer := auth.NewUser("viewer@example.invalid", true, false, nil)
	if s := stateFor(viewer, nil, catalogue, Version); len(s.Steps) != 4 {
		t.Fatalf("viewer chapters: %+v", s)
	}
	admin := auth.NewUser("admin@example.invalid", true, true, nil)
	if s := stateFor(admin, nil, catalogue, Version); len(s.Steps) != 7 {
		t.Fatalf("admin chapters: %+v", s)
	}
	admin.Enabled = false
	if s := stateFor(admin, nil, catalogue, Version); len(s.Steps) != 0 {
		t.Fatal("disabled account saw chapters")
	}
	// A previously seen step remains seen; only a revised step and a newly
	// granted chapter are pending. Changes since the actual seen revision win.
	viewer.TourVersion = 1
	viewer.Actions = pq.StringArray{"budget.CreatePayment"}
	chapters := append([]chapter{}, catalogue...)
	chapters[1].revision = 3
	chapters[1].changes = []change{{1, "Original"}, {2, "Recherche améliorée"}, {3, "Fenêtre des membres"}}
	rows := []progress{{StepID: "overview", Revision: 1}, {StepID: "directory", Revision: 1}, {StepID: "budgets", Revision: 1}, {StepID: "emails", Revision: 1}}
	s := stateFor(viewer, rows, chapters, 3)
	pending := []string{}
	for _, step := range s.Steps {
		if step.SeenRevision < step.Revision {
			pending = append(pending, step.ID)
		}
		if step.ID == "directory" && len(step.Changes) != 2 {
			t.Fatal("diff lost or repeated changes")
		}
	}
	if len(pending) != 2 || pending[0] != "directory" || pending[1] != "payments" {
		t.Fatalf("pending: %v", pending)
	}
	for _, step := range s.Steps {
		if len(step.Capabilities) > 0 {
			t.Fatalf("forbidden capabilities: %+v", step)
		}
	}
}

func TestProgressIntegration(t *testing.T) {
	conn, _ := testdb.Open(t)
	user := auth.NewUser("learner@example.invalid", true, false, nil)
	other := auth.NewUser("other@example.invalid", true, false, nil)
	for _, u := range []*auth.User{user, other} {
		if err := conn.Create(u).Error; err != nil {
			t.Fatal(err)
		}
	}
	// PostgreSQL stores microseconds; compare against its persisted timestamp.
	conn.First(user, "id = ?", user.ID)
	initialUpdated := user.UpdatedAt
	s, err := Get(conn, user.ID)
	if err != nil || s.SeenVersion != 0 {
		t.Fatalf("initial: %+v %v", s, err)
	}
	if _, err := MarkSeen(conn, user.ID, Version+1, "overview", 1); !errors.IsAlreadyExists(err) {
		t.Fatalf("future version: %v", err)
	}
	for _, id := range []string{"access", "mailings", "payments", "missing"} {
		if _, err := MarkSeen(conn, user.ID, Version, id, 1); !errors.IsBadRequest(err) {
			t.Fatalf("forbidden chapter %s: %v", id, err)
		}
	}
	if _, err := MarkSeen(conn, user.ID, Version, "overview", 2); !errors.IsBadRequest(err) {
		t.Fatalf("invalid revision: %v", err)
	}
	s, err = MarkSeen(conn, user.ID, Version, "overview", 1)
	if err != nil || s.SeenVersion != 0 || s.Steps[0].SeenRevision != 1 {
		t.Fatalf("partial: %+v %v", s, err)
	}
	var wg sync.WaitGroup
	for _, id := range []string{"directory", "budgets", "emails", "overview"} {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			if _, err := MarkSeen(conn, user.ID, Version, id, 1); err != nil {
				t.Error(err)
			}
		}(id)
	}
	wg.Wait()
	s, err = Get(conn, user.ID)
	if err != nil || s.SeenVersion != Version {
		t.Fatalf("completion: %+v %v", s, err)
	}
	var persisted auth.User
	conn.First(&persisted, "id = ?", user.ID)
	if !persisted.UpdatedAt.Equal(initialUpdated) {
		t.Fatal("progress invalidated permissions form")
	}
	s, err = Get(conn, other.ID)
	if err != nil || s.SeenVersion != 0 || s.Steps[0].SeenRevision != 0 {
		t.Fatal("another user's progress changed")
	}
	// Granting rights reveals an unseen chapter even at the same global version.
	conn.Model(user).Update("actions", pq.StringArray{"budget.CreatePayment"})
	s, err = Get(conn, user.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, step := range s.Steps {
		if step.ID == "payments" && step.SeenRevision != 0 {
			t.Fatal("new right was silently marked seen")
		}
	}
	conn.Model(user).Update("enabled", false)
	if _, err := MarkSeen(conn, user.ID, Version, "payments", 1); !errors.IsForbidden(err) {
		t.Fatalf("disabled write: %v", err)
	}
}
