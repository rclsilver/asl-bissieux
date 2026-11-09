package mailings

import (
	"context"
	"encoding/json"
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
	if len(invalid.Invalid) != 2 || invalid.CanApply != (len(invalid.Lists[0].Add)+len(invalid.Lists[0].Remove)+len(invalid.Lists[1].Add)+len(invalid.Lists[1].Remove) > 0) {
		t.Fatal("incomplete records must be reported without blocking synchronization")
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
	// IAM service account replaces the legacy triplet; mixing both is rejected.
	for _, name := range []string{"OVH_APPLICATION_KEY", "OVH_APPLICATION_SECRET", "OVH_CONSUMER_KEY"} {
		t.Setenv(name, "")
	}
	t.Setenv("OVH_CLIENT_ID", "fixture-client")
	t.Setenv("OVH_CLIENT_SECRET", "DO-NOT-LEAK")
	if cfg, err := load(); err != nil || cfg == nil || !cfg.UsesOAuth2() || cfg.ClientID != "fixture-client" {
		t.Fatalf("IAM configuration not loaded: %v", err)
	}
	t.Setenv("OVH_CONSUMER_KEY", "fixture-consumer")
	if cfg, err := load(); cfg != nil || err == nil || strings.Contains(err.Error(), "DO-NOT-LEAK") {
		t.Fatal("mixed IAM and legacy credentials must be rejected")
	}
	t.Setenv("OVH_CONSUMER_KEY", "")
	t.Setenv("OVH_CLIENT_SECRET", "")
	if cfg, err := load(); cfg != nil || err == nil {
		t.Fatal("incomplete IAM credentials must be rejected")
	}
	t.Setenv("OVH_CLIENT_ID", "")
	t.Setenv("OVH_CLIENT_SECRET", "")
	for name, value := range values {
		t.Setenv(name, value)
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

func TestOVHClientBureauAsRedirections(t *testing.T) {
	calls := []string{}
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/auth/time" {
			fmt.Fprintf(w, "%d", time.Now().Unix())
			return
		}
		calls = append(calls, r.Method+" "+r.URL.Path+"?"+r.URL.RawQuery)
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/email/domain/example.invalid/task/redirection":
			fmt.Fprint(w, `[7]`)
		case r.Method == http.MethodGet && r.URL.Path == "/email/domain/example.invalid/redirection":
			if r.URL.Query().Get("from") != "bureau@example.invalid" {
				t.Error("wrong redirection source filter")
			}
			fmt.Fprint(w, `["11","12"]`)
		case r.Method == http.MethodGet && strings.Contains(r.URL.Path, "/mailingList/"):
			fmt.Fprint(w, `["member@example.invalid"]`)
		case r.Method == http.MethodGet:
			fmt.Fprint(w, `{"id":"11","from":"bureau@example.invalid","to":"alice@example.invalid"}`)
		case r.Method == http.MethodPost:
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body["from"] != "bureau@example.invalid" || body["to"] != "bob@example.invalid" || body["localCopy"] != false {
				t.Errorf("unexpected redirection body %v %v", body, err)
			}
			fmt.Fprint(w, `{"id":1}`)
		default:
			fmt.Fprint(w, `{"id":2}`)
		}
	}))
	defer s.Close()
	c, err := NewClient(&Config{Endpoint: s.URL, ApplicationKey: "k", ApplicationSecret: "s", ConsumerKey: "c", Domain: "example.invalid", Members: "membres", Bureau: "bureau", BureauType: BureauRedirection})
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	subs, err := c.Subscribers(ctx, "bureau")
	if err != nil || len(subs) != 2 || subs[0] != "alice@example.invalid" {
		t.Fatalf("redirection subscribers %v: %v", subs, err)
	}
	if err := c.Add(ctx, "bureau", "bob@example.invalid"); err != nil {
		t.Fatal(err)
	}
	if err := c.Remove(ctx, "bureau", "alice@example.invalid"); err != nil {
		t.Fatal(err)
	}
	if ids, err := c.Pending(ctx, "bureau"); err != nil || len(ids) != 1 || ids[0] != 7 {
		t.Fatalf("pending redirection tasks %v: %v", ids, err)
	}
	// Membres stays a mailing list even when Bureau uses redirections.
	if _, err := c.Subscribers(ctx, "membres"); err != nil {
		t.Fatal(err)
	}
	want := []string{
		"GET /email/domain/example.invalid/redirection?from=bureau%40example.invalid",
		"GET /email/domain/example.invalid/redirection/11?",
		"GET /email/domain/example.invalid/redirection/12?",
		"POST /email/domain/example.invalid/redirection?",
		"GET /email/domain/example.invalid/redirection?from=bureau%40example.invalid&to=alice%40example.invalid",
		"DELETE /email/domain/example.invalid/redirection/11?",
		"DELETE /email/domain/example.invalid/redirection/12?",
		"GET /email/domain/example.invalid/task/redirection?account=bureau",
		"GET /email/domain/example.invalid/mailingList/membres/subscriber?",
	}
	if strings.Join(calls, "\n") != strings.Join(want, "\n") {
		t.Fatalf("unexpected routes:\n%s", strings.Join(calls, "\n"))
	}
}

func TestBureauTypeConfiguration(t *testing.T) {
	previous := targets
	t.Cleanup(func() { targets = previous })
	for name, value := range map[string]string{"OVH_ENDPOINT": "ovh-eu", "OVH_CLIENT_ID": "id", "OVH_CLIENT_SECRET": "secret", "OVH_APPLICATION_KEY": "", "OVH_APPLICATION_SECRET": "", "OVH_CONSUMER_KEY": "", "APP_ML_DOMAIN": "example.invalid", "APP_ML_MEMBERS": "membres", "APP_ML_BUREAU": "bureau"} {
		t.Setenv(name, value)
	}
	for _, tc := range []struct {
		value string
		ok    bool
	}{{"", true}, {"mailing-list", true}, {"redirection", true}, {"forward", false}} {
		t.Setenv("APP_ML_BUREAU_TYPE", tc.value)
		if err := config.Load(); err != nil {
			t.Fatal(err)
		}
		cfg, err := LoadConfig()
		if (err == nil) != tc.ok || (tc.ok && cfg.UsesRedirection() != (tc.value == "redirection")) {
			t.Fatalf("bureau type %q: cfg=%v err=%v", tc.value, cfg, err)
		}
	}
}

func TestMainAddressIsInBothGroups(t *testing.T) {
	cfg := &Config{Domain: "example.invalid", Members: "membres", Bureau: "bureau", MainAddress: "not-an-address"}
	if cfg.validMainAddress() {
		t.Fatal("invalid main address accepted")
	}
	cfg.MainAddress = "Asl@Example.invalid"
	if !cfg.validMainAddress() {
		t.Fatal("valid main address rejected")
	}
	members := []Member{{ID: "1", Email: "alice@example.invalid", Bureau: true}, {ID: "2", Email: "asl@example.invalid"}}
	p := BuildPlan(cfg, members, map[string][]string{"membres": {"asl@example.invalid"}, "bureau": {}})
	if strings.Join(p.Lists[0].Expected, ",") != "alice@example.invalid,asl@example.invalid" || strings.Join(p.Lists[1].Expected, ",") != "alice@example.invalid,asl@example.invalid" {
		t.Fatalf("main address missing or duplicated: %+v", p.Lists)
	}
	if len(p.Lists[0].Remove) != 0 || strings.Join(p.Lists[1].Add, ",") != "alice@example.invalid,asl@example.invalid" {
		t.Fatalf("unexpected changes: %+v", p.Lists)
	}
}
