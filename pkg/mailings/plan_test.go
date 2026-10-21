package mailings

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/ovh/configstore"
)

func TestPlanGroupsAndDeduplication(t *testing.T) {
	cfg := &Config{Domain: "example.invalid", Members: "membres", Bureau: "bureau"}
	members := []Member{{ID: "one", Email: " Alice@example.invalid ", Bureau: true}, {ID: "coowner", Email: "alice@example.invalid"}, {ID: "two", Email: "bob@example.invalid"}}
	p := BuildPlan(cfg, members, map[string][]string{"membres": {"former@example.invalid", "ALICE@example.invalid"}, "bureau": {"bob@example.invalid"}})
	if !p.CanApply || len(p.Lists[0].Expected) != 2 || strings.Join(p.Lists[0].Add, ",") != "bob@example.invalid" || strings.Join(p.Lists[0].Remove, ",") != "former@example.invalid" || strings.Join(p.Lists[1].Add, ",") != "alice@example.invalid" || strings.Join(p.Lists[1].Remove, ",") != "bob@example.invalid" {
		t.Fatalf("unexpected plan: %+v", p)
	}
	current := map[string][]string{"membres": {"bob@example.invalid", "ALICE@example.invalid"}, "bureau": {"alice@example.invalid"}}
	synchronized := BuildPlan(cfg, members, current)
	for _, l := range synchronized.Lists {
		if len(l.Add)+len(l.Remove) != 0 {
			t.Fatal("not idempotent")
		}
	}
	if synchronized.Token == p.Token {
		t.Fatal("OVH changes must invalidate preview")
	}
	members[0].Bureau = false
	if BuildPlan(cfg, members, current).Token == synchronized.Token {
		t.Fatal("bureau changes must invalidate preview")
	}
	invalid := BuildPlan(cfg, []Member{{ID: "empty"}, {ID: "display", Email: "Alice <alice@example.invalid>"}}, current)
	if invalid.CanApply || len(invalid.Invalid) != 2 {
		t.Fatal("incomplete source must block synchronization")
	}
}
func TestConfigStoreSecretAndValidation(t *testing.T) {
	old := configstore.DefaultStore
	configstore.DefaultStore = configstore.NewStore()
	defer func() { configstore.DefaultStore = old }()
	if cfg, err := LoadConfig(); err != nil || cfg != nil {
		t.Fatalf("missing optional config: %v", err)
	}
	secret := `{"endpoint":"ovh-eu","application_key":"fixture-key","application_secret":"fixture-secret","consumer_key":"fixture-consumer","domain":"example.invalid","members_list":"membres","bureau_list":"bureau"}`
	configstore.InMemory("test").Add(configstore.NewItem(ConfigItem, secret, 0))
	if cfg, err := LoadConfig(); err != nil || cfg.Members != "membres" {
		t.Fatalf("configstore: %v", err)
	}
	for _, bad := range []string{`{"application_secret":"DO-NOT-LEAK",`, strings.Replace(secret, `"bureau_list":"bureau"`, `"bureau_list":"membres"`, 1), strings.Replace(secret, `"endpoint":"ovh-eu"`, `"endpoint":"http://localhost:1234"`, 1)} {
		if _, err := ParseConfig(bad); err == nil || strings.Contains(err.Error(), "DO-NOT-LEAK") {
			t.Fatal("unsafe config error")
		}
	}
}
func TestOVHClientUsesScopedSignedSubscriberRoutes(t *testing.T) {
	calls := []string{}
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/auth/time" {
			fmt.Fprintf(w, "%d", time.Now().Unix())
			return
		}
		if r.Header.Get("X-Ovh-Signature") == "" {
			t.Error("unsigned OVH request")
		}
		calls = append(calls, r.Method+" "+r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/email/domain/example.invalid/task/mailinglist" {
			if r.URL.Query().Get("account") != "bureau" {
				t.Error("wrong task account filter")
			}
			fmt.Fprint(w, `[123]`)
			return
		}
		if r.Method == http.MethodGet {
			fmt.Fprint(w, `["alice@example.invalid"]`)
		} else {
			fmt.Fprint(w, `{"id":123,"status":"todo"}`)
		}
	}))
	defer s.Close()
	c, err := NewClient(&Config{Endpoint: "ovh-eu", ApplicationKey: "fixture-key", ApplicationSecret: "fixture-secret", ConsumerKey: "fixture-consumer", Domain: "example.invalid"})
	if err != nil {
		t.Fatal(err)
	}
	if err := c.api.SetEndpoint(s.URL); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Subscribers(context.Background(), "membres"); err != nil {
		t.Fatal(err)
	}
	if err := c.Add(context.Background(), "membres", "alice@example.invalid"); err != nil {
		t.Fatal(err)
	}
	if err := c.Remove(context.Background(), "bureau", "bob@example.invalid"); err != nil {
		t.Fatal(err)
	}
	ids, err := c.Pending(context.Background(), "bureau")
	if err != nil || len(ids) != 1 || ids[0] != 123 {
		t.Fatalf("pending tasks %v: %v", ids, err)
	}
	if len(calls) != 4 || calls[2] != "DELETE /email/domain/example.invalid/mailingList/bureau/subscriber/bob@example.invalid" {
		t.Fatalf("unexpected routes %v", calls)
	}
}
