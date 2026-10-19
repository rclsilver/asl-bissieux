package server

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sirupsen/logrus"
)

func TestAuthorizationQueryNeverEntersRequestLogs(t *testing.T) {
	var output bytes.Buffer
	previous := logrus.StandardLogger().Out
	logrus.SetOutput(&output)
	t.Cleanup(func() { logrus.SetOutput(previous) })
	handler := withLogging(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	for _, path := range []string{"/api/auth/callback", "/api/auth/login"} {
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", path+"?code=private-authorization-code&state=private-browser-state", nil))
	}
	if strings.Contains(output.String(), "private-") || strings.Contains(output.String(), "?code=") {
		t.Fatal("authorization response entered HTTP logs")
	}
	if !strings.Contains(output.String(), "/api/auth/callback") {
		t.Fatal("request itself was not logged")
	}
}
