package mailings

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/rclsilver/asl-bissieux/pkg/config"
	"github.com/spf13/pflag"
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
func TestViperMailingConfigAndOVHEnvironment(t *testing.T) {
	previous := targets
	t.Cleanup(func() { targets = previous })
	load := func() (*Config, error) {
		t.Helper()
		if err := config.Load(); err != nil {
			t.Fatal(err)
		}
		return LoadConfig()
	}
	values := map[string]string{
		"OVH_ENDPOINT":           "ovh-eu",
		"OVH_APPLICATION_KEY":    "fixture-key",
		"OVH_APPLICATION_SECRET": "DO-NOT-LEAK",
		"OVH_CONSUMER_KEY":       "fixture-consumer",
		"APP_ML_DOMAIN":          "example.invalid",
		"APP_ML_MEMBERS":         "membres",
		"APP_ML_BUREAU":          "bureau",
	}
	for name := range values {
		t.Setenv(name, "")
	}
	if cfg, err := load(); err != nil || cfg != nil {
		t.Fatalf("missing optional config: %v", err)
	}
	for name, value := range values {
		t.Setenv(name, value)
	}
	if cfg, err := load(); err != nil || cfg == nil || *cfg != (Config{Endpoint: "ovh-eu", ApplicationKey: "fixture-key", ApplicationSecret: "DO-NOT-LEAK", ConsumerKey: "fixture-consumer", Domain: "example.invalid", Members: "membres", Bureau: "bureau"}) {
		t.Fatalf("environment configuration not loaded: %v", err)
	}
	for _, bad := range []struct{ name, value string }{
		{"APP_ML_BUREAU", "membres"},
		{"OVH_ENDPOINT", "not-an-endpoint"},
		{"OVH_ENDPOINT", "file:///etc/ovh.conf"},
		{"OVH_ENDPOINT", "http://user:password@localhost:8180"},
		{"OVH_ENDPOINT", "http://localhost:8180?query=1"},
		{"OVH_ENDPOINT", "http://localhost:8180/#fragment"},
		{"OVH_ENDPOINT", "http://localhost:8180/"},
		{"APP_ML_DOMAIN", "example.invalid/path"},
		{"APP_ML_MEMBERS", "members@example.invalid"},
		{"APP_ML_BUREAU", ".."},
	} {
		t.Run(bad.name+"="+bad.value, func(t *testing.T) {
			t.Setenv(bad.name, bad.value)
			if cfg, err := load(); cfg != nil || err == nil || strings.Contains(err.Error(), "DO-NOT-LEAK") {
				t.Fatal("invalid configuration must fail without exposing credentials")
			}
		})
	}
	for _, endpoint := range []string{"http://smocker:8180", "http://127.0.0.1:8180", "https://eu.api.ovh.com/1.0"} {
		t.Run(endpoint, func(t *testing.T) {
			t.Setenv("OVH_ENDPOINT", endpoint)
			if cfg, err := load(); err != nil || cfg == nil || cfg.Endpoint != endpoint {
				t.Fatal("explicit SDK endpoint URL not accepted")
			}
		})
	}
	for name := range values {
		t.Run("missing_"+name, func(t *testing.T) {
			t.Setenv(name, "")
			if cfg, err := load(); cfg != nil || err == nil {
				t.Fatal("partial configuration must fail")
			}
		})
	}
	t.Run("Viper flag overrides environment", func(t *testing.T) {
		flags := pflag.NewFlagSet("mailing-config", pflag.ContinueOnError)
		config.SetFlags(flags)
		flag := flags.Lookup("ml-members")
		previousValue, previousChanged := flag.Value.String(), flag.Changed
		t.Cleanup(func() {
			flag.Value.Set(previousValue)
			flag.Changed = previousChanged
		})
		if err := flags.Parse([]string{"--ml-members=members-from-flag"}); err != nil {
			t.Fatal(err)
		}
		if cfg, err := load(); err != nil || cfg == nil || cfg.Members != "members-from-flag" {
			t.Fatal("Viper command line selection did not override APP_ML_MEMBERS")
		}
	})
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
	c, err := NewClient(&Config{Endpoint: s.URL, ApplicationKey: "fixture-key", ApplicationSecret: "fixture-secret", ConsumerKey: "fixture-consumer", Domain: "example.invalid"})
	if err != nil {
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
