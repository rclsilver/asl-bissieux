package server

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// Angular routes must serve index.html on a direct navigation or page refresh.
// Missing assets keep their 404, and the API is routed separately by the mux.
func frontendHandler(dist fs.FS) http.Handler {
	files := http.FileServer(http.FS(dist))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		accept := r.Header.Get("Accept")
		if (r.Method == http.MethodGet || r.Method == http.MethodHead) && path.Ext(r.URL.Path) == "" &&
			(accept == "" || accept == "*/*" || strings.Contains(accept, "text/html")) {
			name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
			if _, err := fs.Stat(dist, name); err != nil {
				copy := r.Clone(r.Context())
				copy.URL.Path, copy.URL.RawPath = "/", ""
				files.ServeHTTP(w, copy)
				return
			}
		}
		files.ServeHTTP(w, r)
	})
}
