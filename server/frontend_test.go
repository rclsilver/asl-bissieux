package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func TestFrontendRoutes(t *testing.T) {
	dist := fstest.MapFS{"index.html": {Data: []byte("<!doctype html><title>Application</title>")}, "main.js": {Data: []byte("console.log('application');")}}
	mux := http.NewServeMux()
	mux.Handle("/", frontendHandler(dist))
	mux.Handle("/api/", http.NotFoundHandler())
	for _, tc := range []struct {
		method, path, accept string
		code                 int
		html                 bool
	}{
		{"GET", "/", "text/html", 200, true},
		{"GET", "/budgets", "text/html", 200, true},
		{"GET", "/budgets/example?tab=expenses", "text/html", 200, true},
		{"HEAD", "/members/example", "text/html", 200, false},
		{"GET", "/main.js", "*/*", 200, false},
		{"GET", "/missing.js", "text/html", 404, false},
		{"GET", "/assets/missing.svg", "*/*", 404, false},
		{"GET", "/api/missing", "text/html", 404, false},
		{"GET", "/budgets", "application/json", 404, false},
		{"POST", "/budgets", "text/html", 404, false},
	} {
		t.Run(tc.method+tc.path+tc.accept, func(t *testing.T) {
			r := httptest.NewRequest(tc.method, tc.path, nil)
			r.Header.Set("Accept", tc.accept)
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, r)
			if w.Code != tc.code || strings.Contains(w.Body.String(), "<!doctype html>") != tc.html {
				t.Fatalf("HTTP %d %s", w.Code, w.Body.String())
			}
		})
	}
}
