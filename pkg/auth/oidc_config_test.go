package auth

import (
	"testing"
	"time"
)

func TestOIDCConfigRefusesUnsafeOrIncompleteSettings(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(*oidcConfig)
	}{
		{"HTTP issuer requires explicit dev mode", func(c *oidcConfig) { c.Issuer = "http://localhost:9080/realms/test" }},
		{"HTTP application requires explicit dev mode", func(c *oidcConfig) { c.PublicURL = "http://localhost:4200" }},
		{"public URL is an origin", func(c *oidcConfig) { c.PublicURL += "/nested/path" }},
		{"missing client", func(c *oidcConfig) { c.ClientID = "" }},
		{"unbounded session", func(c *oidcConfig) { c.SessionDuration = 25 * time.Hour }},
		{"missing Google secret", func(c *oidcConfig) {}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			p := oidcProvider{cfg: oidcConfig{Issuer: "https://accounts.google.com", ClientID: "test-client", PublicURL: "https://app.example", SessionDuration: 8 * time.Hour}}
			tc.change(&p.cfg)
			if err := p.validate(); err == nil {
				t.Fatal("unsafe/incomplete configuration accepted")
			}
		})
	}
}
