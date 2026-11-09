package server

import (
	"bytes"
	"encoding/json"
	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/tour"
	"net/http/httptest"
	"testing"
)

func TestTourHTTP(t *testing.T) {
	conn, _ := testdb.Open(t)
	users := map[string]*auth.User{"viewer": auth.NewUser("learner@example.invalid", true, false, nil), "admin": auth.NewUser("admin@example.invalid", true, true, nil), "disabled": auth.NewUser("disabled@example.invalid", false, false, nil)}
	ids := map[string]string{}
	for role, u := range users {
		if err := conn.Create(u).Error; err != nil {
			t.Fatal(err)
		}
		ids[role] = u.ID
	}
	app := NewServer().WithAuthProvider(&administrationProvider{tx: conn, ids: ids})
	if err := app.Build(); err != nil {
		t.Fatal(err)
	}
	request := func(role, method, path, body string, status int) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("X-Test-Role", role)
		w := httptest.NewRecorder()
		app.apiRouter.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("%s %s: %d %s", role, path, w.Code, w.Body.String())
		}
		return w
	}
	for _, role := range []string{"", "disabled"} {
		request(role, "GET", "/api/auth/tour", "", 401)
		request(role, "POST", "/api/auth/tour/progress", `{"version":1,"step_id":"overview","revision":1}`, 401)
	}
	w := request("viewer", "GET", "/api/auth/tour", "", 200)
	var s tour.State
	if err := json.Unmarshal(w.Body.Bytes(), &s); err != nil || len(s.Steps) != 4 {
		t.Fatalf("viewer catalogue: %+v %v", s, err)
	}
	request("viewer", "POST", "/api/auth/tour/progress", `{"version":1,"step_id":"access","revision":1}`, 400)
	request("viewer", "POST", "/api/auth/tour/progress", `{"version":2,"step_id":"overview","revision":1}`, 409)
	request("viewer", "POST", "/api/auth/tour/progress", `{}`, 400)
	request("viewer", "POST", "/api/auth/tour/progress", `{"version":1,"step_id":"overview","revision":1,"user_id":"`+users["admin"].ID+`"}`, 200)
	other, err := tour.Get(conn, users["admin"].ID)
	if err != nil || other.Steps[0].SeenRevision != 0 {
		t.Fatal("client chose another user's progress")
	}
	request("admin", "GET", "/api/auth/tour", "", 200)
}
