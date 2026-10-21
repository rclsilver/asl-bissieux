package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"gorm.io/gorm"
)

type administrationProvider struct {
	auth.AuthProvider
	tx  *gorm.DB
	ids map[string]string
}

func (p *administrationProvider) Authenticate(r *http.Request) (*auth.User, error) {
	id := p.ids[r.Header.Get("X-Test-Role")]
	if id == "" {
		return nil, nil
	}
	var u auth.User
	err := p.tx.First(&u, "id = ?", id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &u, err
}

func TestUserAdministrationHTTP(t *testing.T) {
	conn, _ := testdb.Open(t)
	users := map[string]*auth.User{"admin": auth.NewUser("admin@example.invalid", true, true, nil), "viewer": auth.NewUser("viewer@example.invalid", true, false, nil), "legacy": auth.NewUser("legacy@example.invalid", false, false, nil), "pending": auth.NewUser("pending@example.invalid", false, false, nil)}
	ids := map[string]string{}
	for role, u := range users {
		if err := conn.Create(u).Error; err != nil {
			t.Fatal(err)
		}
		ids[role] = u.ID
	}
	if err := conn.Create(&auth.AccessRequest{UserID: users["pending"].ID, Status: "pending"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := conn.Create(&auth.Identity{Issuer: "https://accounts.google.com", Subject: "fixture-subject", UserID: users["pending"].ID}).Error; err != nil {
		t.Fatal(err)
	}
	app := NewServer().WithAuthProvider(&administrationProvider{tx: conn, ids: ids})
	if err := app.Build(); err != nil {
		t.Fatal(err)
	}
	request := func(role, method, path string, body any) *httptest.ResponseRecorder {
		b, _ := json.Marshal(body)
		r := httptest.NewRequest(method, path, bytes.NewReader(b))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("X-Test-Role", role)
		w := httptest.NewRecorder()
		app.apiRouter.ServeHTTP(w, r)
		return w
	}
	check := func(w *httptest.ResponseRecorder, status int) {
		t.Helper()
		if w.Code != status {
			t.Fatalf("HTTP %d expected %d: %s", w.Code, status, w.Body.String())
		}
	}
	payload := func(u *auth.User, enabled, admin bool) map[string]any {
		return map[string]any{"username": u.Username, "enabled": enabled, "admin": admin, "actions": u.Actions}
	}
	adminPath := "/api/auth/users/" + users["admin"].ID
	for _, body := range []any{payload(users["admin"], false, true), payload(users["admin"], true, false)} {
		check(request("admin", "PUT", adminPath, body), 400)
	}
	check(request("admin", "DELETE", adminPath, nil), 400)
	for _, role := range []string{"viewer", "pending", "legacy", ""} {
		expected := 403
		if role == "pending" || role == "legacy" || role == "" {
			expected = 401
		}
		for _, path := range []string{"/api/auth/users", "/api/auth/access-requests/summary"} {
			check(request(role, "GET", path, nil), expected)
		}
	}
	w := request("admin", "GET", "/api/auth/access-requests/summary", nil)
	check(w, 200)
	var summary struct{ Pending int }
	json.Unmarshal(w.Body.Bytes(), &summary)
	if summary.Pending != 1 {
		t.Fatalf("legacy inactive counted as pending: %s", w.Body.String())
	}
	w = request("admin", "GET", "/api/auth/users?status=pending", nil)
	check(w, 200)
	var rows []auth.User
	json.Unmarshal(w.Body.Bytes(), &rows)
	if len(rows) != 1 || len(rows[0].Identities) != 1 || rows[0].Identities[0].Subject != "fixture-subject" {
		t.Fatalf("pending identity: %s", w.Body.String())
	}
	path := "/api/auth/users/" + users["pending"].ID
	var pendingVersion auth.User
	conn.First(&pendingVersion, "id = ?", users["pending"].ID)
	stale := payload(users["pending"], false, false)
	stale["expected_updated_at"] = pendingVersion.UpdatedAt
	check(request("admin", "PUT", path, stale), 200)
	var stillPending auth.AccessRequest
	conn.First(&stillPending, "user_id = ?", users["pending"].ID)
	if stillPending.Status != "pending" {
		t.Fatal("editing rights resolved a pending request")
	}
	check(request("admin", "PUT", path, stale), 409)
	invalid := payload(users["pending"], false, false)
	invalid["access_decision"] = "disable"
	check(request("admin", "PUT", path, invalid), 400)

	check(request("admin", "PUT", path, payload(users["pending"], true, false)), 200)
	var req auth.AccessRequest
	conn.First(&req, "user_id = ?", users["pending"].ID)
	if req.Status != "approved" || req.ResolvedBy == nil || *req.ResolvedBy != users["admin"].ID {
		t.Fatalf("approval not traced: %+v", req)
	}
	// A disabled session is revoked, even when its provider credential stays valid.
	tokenHash := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if err := conn.Table("auth_session").Create(map[string]any{"token_hash": tokenHash, "csrf_hash": tokenHash, "issuer": "https://accounts.google.com", "subject": "fixture-subject", "user_id": users["pending"].ID, "expires_at": time.Now().Add(time.Hour)}).Error; err != nil {
		t.Fatal(err)
	}
	check(request("admin", "PUT", path, payload(users["pending"], false, false)), 200)
	var sessions int64
	conn.Table("auth_session").Where("user_id = ?", users["pending"].ID).Count(&sessions)
	if sessions != 0 {
		t.Fatal("disabled session retained")
	}
	check(request("pending", "GET", "/api/budget", nil), 401)
	denied := auth.NewUser("denied@example.invalid", false, false, nil)
	conn.Create(denied)
	conn.Create(&auth.AccessRequest{UserID: denied.ID, Status: "pending"})
	denial := payload(denied, false, false)
	denial["access_decision"] = "reject"
	check(request("admin", "PUT", "/api/auth/users/"+denied.ID, denial), 200)
	req = auth.AccessRequest{}
	conn.First(&req, "user_id = ?", denied.ID)
	if req.Status != "rejected" {
		t.Fatalf("request not rejected: %+v", req)
	}
	activation := payload(denied, true, false)
	activation["access_decision"] = "reactivate"
	check(request("admin", "PUT", "/api/auth/users/"+denied.ID, activation), 200)
	// Two administrators concurrently try to remove their own role. At least one remains.
	second := auth.NewUser("second@example.invalid", true, true, nil)
	conn.Create(second)
	ids["second"] = second.ID
	var wg sync.WaitGroup
	results := make(chan int, 2)
	for _, role := range []string{"admin", "second"} {
		role := role
		target := users["admin"]
		if role == "second" {
			target = second
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			results <- request(role, "PUT", "/api/auth/users/"+target.ID, payload(target, true, false)).Code
		}()
	}
	wg.Wait()
	close(results)
	success := 0
	for code := range results {
		if code == 200 {
			success++
		} else if code != 400 && code != 403 {
			t.Fatalf("unexpected concurrent status %d", code)
		}
	}
	var admins int64
	conn.Model(&auth.User{}).Where("enabled=true AND admin=true").Count(&admins)
	if admins != 1 || success != 1 {
		t.Fatalf("concurrent administrators: %d active, %d successes", admins, success)
	}
}
