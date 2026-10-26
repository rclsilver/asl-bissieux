package server

import "net/http"

// Angular inserts component styles at runtime. Keep styles compatible while
// observing the stricter script policy before enforcing it in production.
const applicationCSP = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
	"script-src 'self' https://accounts.google.com/gsi/client; " +
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style; " +
	"font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.googleusercontent.com; " +
	"connect-src 'self' https://accounts.google.com/gsi/ https://www.googleapis.com; " +
	"frame-src https://accounts.google.com/gsi/; form-action 'self'"

func browserProtections(next http.Handler, settings httpConfig) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		if settings.CSPReportOnly {
			h.Set("Content-Security-Policy", "base-uri 'self'; object-src 'none'; frame-ancestors 'none'")
			h.Set("Content-Security-Policy-Report-Only", applicationCSP)
		} else {
			h.Set("Content-Security-Policy", applicationCSP)
		}
		// HTTPS may terminate at the ingress. Trust an explicit deployment
		// setting, never a client-supplied X-Forwarded-Proto header.
		if r.TLS != nil || settings.PublicHTTPS {
			h.Set("Strict-Transport-Security", "max-age=31536000")
		}
		next.ServeHTTP(w, r)
	})
}
