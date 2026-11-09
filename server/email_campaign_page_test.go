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

func TestCampaignPageHTTP(t *testing.T) {
	conn, _ := testdb.Open(t)
	users := map[string]*auth.User{
		"viewer":   auth.NewUser("viewer@example.invalid", true, false, nil),
		"disabled": auth.NewUser("disabled@example.invalid", false, false, nil),
	}
	for _, user := range users {
		if err := conn.Create(user).Error; err != nil {
			t.Fatal(err)
		}
	}
	template := models.NewEmailTemplate("PRIVATE_TEMPLATE", "PRIVATE_SUBJECT", "PRIVATE_BODY")
	if err := conn.Create(template).Error; err != nil {
		t.Fatal(err)
	}
	campaign := models.NewEmailCampaign("Campagne", template, map[string]any{"PRIVATE_CONTEXT": true})
	if err := conn.Create(campaign).Error; err != nil {
		t.Fatal(err)
	}
	app := NewServer().WithAuthProvider(&budgetTestProvider{users: users})
	if err := app.Build(); err != nil {
		t.Fatal(err)
	}
	request := func(role, query string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "/api/email/campaigns"+query, nil)
		r.Header.Set("X-Test-Role", role)
		w := httptest.NewRecorder()
		app.apiRouter.ServeHTTP(w, r)
		return w
	}
	for _, role := range []string{"", "disabled"} {
		if w := request(role, ""); w.Code != 401 {
			t.Fatalf("role %q status %d", role, w.Code)
		}
	}
	for _, query := range []string{"?page_size=101", "?page=-1", "?sort=message", "?direction=sideways", "?page=not-an-integer"} {
		if w := request("viewer", query); w.Code != 400 {
			t.Fatalf("%s status%d: %s", query, w.Code, w.Body.String())
		}
	}
	w := request("viewer", "?page_size=10&query=campagne&sort=title&direction=asc")
	if w.Code != 200 {
		t.Fatalf("list status%d: %s", w.Code, w.Body.String())
	}
	var result models.EmailCampaignPage
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.PageSize != 10 || result.Total != 1 || len(result.Items) != 1 || result.Items[0].ID != campaign.ID {
		t.Fatalf("response %+v", result)
	}
	if strings.Contains(w.Body.String(), "PRIVATE_") {
		t.Fatal("list exposes template or context")
	}
}
