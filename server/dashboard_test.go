package server

import (
	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDashboardHTTP(t *testing.T) {
	tx, _ := testdb.Open(t)
	users := map[string]*auth.User{"viewer": auth.NewUser("viewer@example.invalid", true, false, nil), "disabled": auth.NewUser("disabled@example.invalid", false, true, nil)}
	for _, u := range users {
		if err := tx.Create(u).Error; err != nil {
			t.Fatal(err)
		}
	}
	b := models.NewBudget("Fixture")
	tx.Create(b)
	app := NewServer().WithAuthProvider(&budgetTestProvider{users: users})
	if err := app.Build(); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/api/dashboard/directory", "/api/dashboard/emails", "/api/budget/" + b.ID + "/dashboard?year=2026"} {
		for _, role := range []string{"viewer", "disabled", ""} {
			r := httptest.NewRequest("GET", path, nil)
			r.Header.Set("X-Test-Role", role)
			w := httptest.NewRecorder()
			app.apiRouter.ServeHTTP(w, r)
			want := 200
			if role != "viewer" {
				want = 401
			}
			if w.Code != want {
				t.Fatalf("%s %s: %d %s", role, path, w.Code, w.Body.String())
			}
			if strings.Contains(w.Body.String(), "pending") || strings.Contains(w.Body.String(), "identities") {
				t.Fatal("administrator fields leaked into business dashboard")
			}
		}
	}
}
