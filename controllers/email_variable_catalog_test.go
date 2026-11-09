package controllers

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/templates"
)

// Exercise the actual frontend catalogue against the server's Go/Sprig engine.
// This contract prevents a usable-looking insertion from shipping a bad scope.
func TestEmailVariableCatalogue(t *testing.T) {
	encoded, err := os.ReadFile("../frontend/src/app/emails/template-variables.json")
	if err != nil {
		t.Fatal(err)
	}
	var catalogue struct {
		Groups []struct {
			Variables []struct{ ID, Snippet, Example string }
		}
		SampleData map[string]any
	}
	if err := json.Unmarshal(encoded, &catalogue); err != nil {
		t.Fatal(err)
	}
	seen := make(map[string]bool)
	for _, group := range catalogue.Groups {
		for _, variable := range group.Variables {
			if variable.ID == "" || seen[variable.ID] {
				t.Fatalf("missing or duplicate variable ID: %q", variable.ID)
			}
			seen[variable.ID] = true
			t.Run(variable.ID, func(t *testing.T) {
				context, err := templates.NewTemplate(catalogue.SampleData)
				if err != nil {
					t.Fatal(err)
				}
				rendered, err := BuildEmail(models.NewEmailTemplate("Catalogue", variable.Snippet, variable.Snippet), context)
				if err != nil {
					t.Fatal(err)
				}
				if rendered.Subject != variable.Example {
					t.Fatalf("rendered %q, expected example %q", rendered.Subject, variable.Example)
				}
			})
		}
	}
	if len(seen) == 0 {
		t.Fatal("empty variable catalogue")
	}
}
