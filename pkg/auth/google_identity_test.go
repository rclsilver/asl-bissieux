package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rclsilver/asl-bissieux/internal/testdb"
)

func TestVerifiedLegacyGoogleIdentityMigrationIntegration(t *testing.T) {
	conn, _ := testdb.Open(t)
	existing := NewUser("test@example.invalid", true, true, []string{"budget.CreatePayment"})
	if err := conn.Create(existing).Error; err != nil {
		t.Fatal(err)
	}
	infos := validGoogleInfos()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(infos) }))
	defer server.Close()
	provider := googleProvider{cfg: googleAuthConfig{ClientID: "client"}, client: server.Client(), endpoint: server.URL}
	r := httptest.NewRequest("GET", "/api/auth/me", nil)
	r.Header.Set("Authorization", "Bearer test-verified-google-token")
	user, err := provider.Authenticate(r)
	if err != nil || user.ID != existing.ID || !user.Admin || !user.Enabled {
		t.Fatalf("account/rights were not preserved: %v", err)
	}
	var identity Identity
	if err := conn.First(&identity, "issuer = ? AND subject = ?", "https://accounts.google.com", infos.UserID).Error; err != nil || identity.UserID != existing.ID {
		t.Fatalf("stable identity not captured: %v", err)
	}
	infos.Email = "changed@example.invalid"
	user, err = provider.Authenticate(r)
	if err != nil || user.ID != existing.ID || user.Username != existing.Username {
		t.Fatalf("email change lost account: %v", err)
	}
	infos.Email = existing.Username
	infos.UserID = "a-different-google-subject"
	if _, err := provider.Authenticate(r); err == nil {
		t.Fatal("another Google subject acquired the established account by email")
	}
	var count int64
	conn.Model(&Identity{}).Count(&count)
	if count != 1 {
		t.Fatal("unexpected extra identity link")
	}
}
