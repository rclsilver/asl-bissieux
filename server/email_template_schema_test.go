package server

import (
	"encoding/json"
	"net/http/httptest"
	"os"
	"testing"
)

func TestEmailTemplateFieldSchema(t *testing.T) {
	s := NewServer()
	if err := s.Build(); err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	s.apiRouter.ServeHTTP(recorder, httptest.NewRequest("GET", "/api/spec.json", nil))
	if recorder.Code != 200 {
		t.Fatalf("spec status %d", recorder.Code)
	}
	var spec struct {
		Components struct {
			Schemas map[string]struct{ Properties map[string]json.RawMessage }
		}
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &spec); err != nil {
		t.Fatal(err)
	}
	for schema, properties := range map[string][]string{
		"ModelsEmailTemplate": {"custom_fields"}, "TemplatesFieldDescription": {"fields", "advanced"}, "TemplatesCustomField": {"name", "complex"},
	} {
		for _, property := range properties {
			if _, ok := spec.Components.Schemas[schema].Properties[property]; !ok {
				t.Fatalf("missing %s.%s", schema, property)
			}
		}
	}
	// Optional local export lets code generation use the same router schema
	// without starting HTTP or contacting an external identity provider.
	if path := os.Getenv("TEST_OPENAPI_OUTPUT"); path != "" {
		if err := os.WriteFile(path, recorder.Body.Bytes(), 0600); err != nil {
			t.Fatal(err)
		}
	}
}
