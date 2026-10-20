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

func TestEmailPageAndStatusHTTP(t *testing.T) {
	conn, _ := testdb.Open(t)
	users := map[string]*auth.User{"viewer": auth.NewUser("viewer@example.invalid", true, false, nil), "disabled": auth.NewUser("disabled@example.invalid", false, false, nil)}
	for _, user := range users {
		if err := conn.Create(user).Error; err != nil {
			t.Fatal(err)
		}
	}
	template := models.NewEmailTemplate("Fixture", "Hello {{.name}}", "PRIVATE_BODY")
	if err := conn.Create(template).Error; err != nil {
		t.Fatal(err)
	}
	campaign := models.NewEmailCampaign("Campaign", template, map[string]any{})
	if err := conn.Create(campaign).Error; err != nil {
		t.Fatal(err)
	}
	row := models.NewEmail(campaign, "target@example.invalid", map[string]any{"name": "Fixture", "secret": "PRIVATE_CONTEXT"})
	row.State = models.Error
	row.Error = "SMTP detail"
	if err := conn.Create(row).Error; err != nil {
		t.Fatal(err)
	}
	app := NewServer().WithAuthProvider(&budgetTestProvider{users: users})
	if err := app.Build(); err != nil {
		t.Fatal(err)
	}
	request := func(role, path string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", path, nil)
		r.Header.Set("X-Test-Role", role)
		w := httptest.NewRecorder()
		app.apiRouter.ServeHTTP(w, r)
		return w
	}
	list := "/api/email/campaigns/" + campaign.ID + "/emails"
	status := "/api/email/" + row.ID + "/status"
	for _, role := range []string{"", "disabled"} {
		for _, path := range []string{list, status} {
			if w := request(role, path); w.Code != 401 {
				t.Fatalf("role%q status%d", role, w.Code)
			}
		}
	}
	for _, query := range []string{"?page_size=101", "?state=INVALID", "?sort=subject", "?page=no"} {
		if w := request("viewer", list+query); w.Code != 400 {
			t.Fatalf("query%s status%d", query, w.Code)
		}
	}
	w := request("viewer", list+"?state=ERROR&query=target&page_size=10")
	if w.Code != 200 {
		t.Fatalf("list %d: %s", w.Code, w.Body.String())
	}
	var page models.EmailPage
	if err := json.Unmarshal(w.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if page.Total != 1 || len(page.Items) != 1 || !page.Items[0].HasError || page.Items[0].Subject != "Hello Fixture" {
		t.Fatalf("page %+v", page)
	}
	for _, secret := range []string{"PRIVATE_", "SMTP detail", "message", "data", "attachments"} {
		if strings.Contains(w.Body.String(), secret) {
			t.Fatalf("leaked %s", secret)
		}
	}
	w = request("viewer", status)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "SMTP detail") || strings.Contains(w.Body.String(), "PRIVATE_") {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	w = request("viewer", "/api/email/"+row.ID)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "PRIVATE_BODY") {
		t.Fatalf("preview %d", w.Code)
	}
	if w := request("viewer", "/api/email/campaigns/invalid/emails"); w.Code != 404 {
		t.Fatalf("invalid campaign%d", w.Code)
	}
	if w := request("viewer", "/api/email/invalid/status"); w.Code != 404 {
		t.Fatalf("invalid email%d", w.Code)
	}
}
