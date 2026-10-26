package server

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
)

func TestMailingAccessAndMemberBureau(t *testing.T) {
	// Keep the HTTP authorization test offline even with a configured operator shell.
	for _, name := range []string{"OVH_ENDPOINT", "OVH_APPLICATION_KEY", "OVH_APPLICATION_SECRET", "OVH_CONSUMER_KEY", "APP_ML_DOMAIN", "APP_ML_MEMBERS", "APP_ML_BUREAU"} {
		t.Setenv(name, "")
	}
	tx, _ := testdb.Open(t)
	users := map[string]*auth.User{"admin": auth.NewUser("admin@example.invalid", true, true, nil), "reader": auth.NewUser("reader@example.invalid", true, false, nil), "disabled": auth.NewUser("disabled@example.invalid", false, true, nil)}
	for _, u := range users {
		if err := tx.Create(u).Error; err != nil {
			t.Fatal(err)
		}
	}
	app := NewServer().WithAuthProvider(&budgetTestProvider{users: users})
	if err := app.Build(); err != nil {
		t.Fatal(err)
	}
	for _, role := range []string{"admin", "reader", "disabled", ""} {
		r := httptest.NewRequest("GET", "/api/mailing-lists/preview", nil)
		r.Header.Set("X-Test-Role", role)
		w := httptest.NewRecorder()
		app.apiRouter.ServeHTTP(w, r)
		want := 200
		if role == "reader" {
			want = 403
		}
		if role == "disabled" || role == "" {
			want = 401
		}
		if w.Code != want {
			t.Fatalf("preview role%s code%d body%s", role, w.Code, w.Body.String())
		}
		r = httptest.NewRequest("POST", "/api/mailing-lists/sync", strings.NewReader(`{"token":"fixture"}`))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("X-Test-Role", role)
		w = httptest.NewRecorder()
		app.apiRouter.ServeHTTP(w, r)
		if role == "admin" {
			want = 400
		}
		if w.Code != want {
			t.Fatalf("sync role%s code%d body%s", role, w.Code, w.Body.String())
		}
	}
	create := httptest.NewRequest("POST", "/api/member", strings.NewReader(`{"first_name":"Alice","last_name":"Fixture","email":"alice@example.invalid","bureau":true}`))
	create.Header.Set("Content-Type", "application/json")
	create.Header.Set("X-Test-Role", "admin")
	w := httptest.NewRecorder()
	app.apiRouter.ServeHTTP(w, create)
	if w.Code != 201 {
		t.Fatalf("create: %d %s", w.Code, w.Body.String())
	}
	var m models.Member
	if err := json.Unmarshal(w.Body.Bytes(), &m); err != nil {
		t.Fatal(err)
	}
	if !m.Bureau {
		t.Fatal("bureau not created")
	}
	update := httptest.NewRequest("PUT", "/api/member/"+m.ID, strings.NewReader(`{"first_name":"Alice","last_name":"Fixture","email":"alice@example.invalid","bureau":false}`))
	update.Header.Set("Content-Type", "application/json")
	update.Header.Set("X-Test-Role", "admin")
	w = httptest.NewRecorder()
	app.apiRouter.ServeHTTP(w, update)
	if w.Code != 200 {
		t.Fatalf("update: %d %s", w.Code, w.Body.String())
	}
	var stored models.Member
	tx.First(&stored, "id = ?", m.ID)
	if stored.Bureau {
		t.Fatal("unchecking bureau was not persisted")
	}
}
