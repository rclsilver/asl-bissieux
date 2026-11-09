package server

import (
	"crypto/tls"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBrowserProtections(t *testing.T) {
	for _, tc := range []struct {
		name                     string
		tls, proxyHTTPS, enforce bool
	}{
		{name: "development HTTP"},
		{name: "direct TLS", tls: true},
		{name: "explicit HTTPS ingress", proxyHTTPS: true},
		{name: "CSP enforced", enforce: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			settings := httpConfig{PublicHTTPS: tc.proxyHTTPS, CSPReportOnly: !tc.enforce}
			handler := browserProtections(http.NotFoundHandler(), settings)
			r := httptest.NewRequest("GET", "/missing", nil)
			r.Header.Set("X-Forwarded-Proto", "https")
			if tc.tls {
				r.TLS = &tls.ConnectionState{}
			}
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, r)
			if w.Code != 404 || w.Header().Get("X-Frame-Options") != "DENY" || w.Header().Get("X-Content-Type-Options") != "nosniff" {
				t.Fatalf("headers: %v", w.Header())
			}
			if got := w.Header().Get("Strict-Transport-Security"); (got != "") != (tc.tls || tc.proxyHTTPS) || strings.Contains(got, "includeSubDomains") {
				t.Fatalf("unexpected HSTS %q", got)
			}
			policy := w.Header().Get("Content-Security-Policy")
			if !strings.Contains(policy, "frame-ancestors 'none'") {
				t.Fatal("missing enforced iframe protection")
			}
			if tc.enforce {
				if policy != applicationCSP || w.Header().Get("Content-Security-Policy-Report-Only") != "" {
					t.Fatal("expected enforced application policy")
				}
			} else if w.Header().Get("Content-Security-Policy-Report-Only") != applicationCSP {
				t.Fatal("expected observation policy")
			}
		})
	}
}

func TestAPIGrantsNoCrossOriginAccess(t *testing.T) {
	app := NewServer().WithAuthProvider(&budgetTestProvider{})
	if err := app.Build(); err != nil {
		t.Fatal(err)
	}
	handler, err := app.Handler()
	if err != nil {
		t.Fatal(err)
	}
	for _, origin := range []string{"", "http://example.com", "https://untrusted.invalid"} {
		for _, method := range []string{"GET", "OPTIONS"} {
			r := httptest.NewRequest(method, "/api/spec.json", nil)
			r.Header.Set("Origin", origin)
			if method == "OPTIONS" {
				r.Header.Set("Access-Control-Request-Method", "POST")
				r.Header.Set("Access-Control-Request-Headers", "authorization,content-type")
			}
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, r)
			if w.Header().Get("Access-Control-Allow-Origin") != "" || w.Header().Get("Access-Control-Allow-Credentials") != "" {
				t.Fatalf("unexpected CORS grant for %q", origin)
			}
			if method == "GET" && w.Code != 200 {
				t.Fatalf("GET broke: %d", w.Code)
			}
			if w.Header().Get("X-Content-Type-Options") != "nosniff" {
				t.Fatal("API headers missing")
			}
		}
	}
	// Direct Angular navigation and errors receive the same protections.
	for _, path := range []string{"/dashboard", "/api/missing"} {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Header().Get("X-Frame-Options") != "DENY" {
			t.Fatalf("missing SPA/API protection on %s", path)
		}
	}
}
