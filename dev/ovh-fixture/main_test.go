package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/rclsilver/asl-bissieux/controllers"
	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/config"
)

func completeTasks(f *fixture) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for i := range f.tasks {
		f.tasks[i].ready = time.Time{}
	}
}

func TestFixtureQueuesAndIsolatesLists(t *testing.T) {
	f := newFixture(time.Hour)
	call := func(method, path, body string) string {
		t.Helper()
		w := httptest.NewRecorder()
		f.ServeHTTP(w, httptest.NewRequest(method, path, strings.NewReader(body)))
		if w.Code != http.StatusOK {
			t.Fatalf("%s %s: %d", method, path, w.Code)
		}
		return strings.TrimSpace(w.Body.String())
	}
	const base = "/email/domain/example.invalid/"
	call("POST", base+"mailingList/membres/subscriber", `{"email":"alice@example.invalid"}`)
	call("DELETE", base+"mailingList/bureau/subscriber/ancien-bureau@example.invalid", "")
	if call("GET", base+"task/mailinglist?account=membres", "") != "[1]" || call("GET", base+"task/mailinglist?account=bureau", "") != "[2]" {
		t.Fatal("pending tasks must be scoped by list")
	}
	if strings.Contains(call("GET", base+"mailingList/membres/subscriber", ""), "alice") {
		t.Fatal("queued operation completed early")
	}
	completeTasks(f)
	if call("GET", base+"task/mailinglist?account=membres", "") != "[]" || call("GET", base+"mailingList/bureau/subscriber", "") != "[]" || !strings.Contains(call("GET", base+"mailingList/membres/subscriber", ""), "alice") {
		t.Fatal("completed operations were not reflected in subscriber lists")
	}
	call("POST", base+"mailingList/membres/subscriber", `{"email":"alice@example.invalid"}`)
	completeTasks(f)
	if strings.Count(call("GET", base+"mailingList/membres/subscriber", ""), "alice") != 1 {
		t.Fatal("duplicate subscriber")
	}
	for _, path := range []string{"/email/domain/real.example/mailingList/membres/subscriber", base + "mailingList/unknown/subscriber", base + "task/mailinglist?account=unknown"} {
		w := httptest.NewRecorder()
		f.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != http.StatusNotFound {
			t.Fatal("unexpected fixture resource accepted")
		}
	}
}

// Opt-in contract test against a disposable, separately started Smocker. Never
// reset the developer's active Smocker or point this test at an OVH endpoint.
func TestSynchronizationThroughSmocker(t *testing.T) {
	if os.Getenv("TEST_SMOCKER") != "1" {
		t.Skip("set TEST_SMOCKER=1 with disposable Smocker on 8280/8281 and TEST_DATABASE_URL")
	}
	tx, _ := testdb.Open(t)
	f := newFixture(time.Hour)
	upstream := httptest.NewServer(f)
	defer upstream.Close()
	admin := "http://127.0.0.1:8281"
	client := &http.Client{Timeout: 10 * time.Second}
	request := func(method, path string, body []byte) []byte {
		t.Helper()
		r, err := http.NewRequest(method, admin+path, bytes.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		r.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(r)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		data, err := io.ReadAll(resp.Body)
		if err != nil || resp.StatusCode != 200 {
			t.Fatalf("Smocker %s: status %d error %v", path, resp.StatusCode, err)
		}
		return data
	}
	request("POST", "/reset", nil)
	t.Cleanup(func() { request("POST", "/reset", nil) })
	mocks, err := os.ReadFile("../smocker/ovh.json")
	if err != nil {
		t.Fatal(err)
	}
	request("POST", "/mocks", []byte(strings.ReplaceAll(string(mocks), "OVH_FIXTURE_URL", upstream.URL)))
	for name, value := range map[string]string{
		"OVH_ENDPOINT": "http://127.0.0.1:8280", "OVH_APPLICATION_KEY": "smocker-development-key", "OVH_APPLICATION_SECRET": "smocker-development-secret", "OVH_CONSUMER_KEY": "smocker-development-consumer",
		"APP_ML_DOMAIN": "example.invalid", "APP_ML_MEMBERS": "membres", "APP_ML_BUREAU": "bureau",
	} {
		t.Setenv(name, value)
	}
	if err := config.Load(); err != nil {
		t.Fatal(err)
	}
	alice := models.NewMember("Alice", "Fixture", "", "alice@example.invalid", "")
	alice.Bureau = true
	bob := models.NewMember("Bob", "Fixture", "", "bob@example.invalid", "")
	if err := tx.Create(alice).Error; err != nil {
		t.Fatal(err)
	}
	if err := tx.Create(bob).Error; err != nil {
		t.Fatal(err)
	}
	plan, err := controllers.PreviewMailingLists(tx)
	if err != nil {
		t.Fatal(err)
	}
	if !plan.CanApply || len(plan.Lists[0].Add) != 2 || len(plan.Lists[0].Remove) != 1 || len(plan.Lists[1].Add) != 1 || len(plan.Lists[1].Remove) != 1 {
		t.Fatal("unexpected initial difference through Smocker")
	}
	if _, err := controllers.SyncMailingLists(tx, "obsolete"); err == nil {
		t.Fatal("obsolete confirmation accepted")
	}
	result, err := controllers.SyncMailingLists(tx, plan.Token)
	if err != nil {
		t.Fatal(err)
	}
	if result.Verified || result.Partial || result.Plan.CanApply || len(result.Plan.Lists[0].PendingTasks) != 3 || len(result.Plan.Lists[1].PendingTasks) != 2 {
		t.Fatal("asynchronous tasks falsely reported as complete")
	}
	if _, err := controllers.SyncMailingLists(tx, result.Plan.Token); err == nil {
		t.Fatal("pending writes repeated")
	}
	completeTasks(f)
	plan, err = controllers.PreviewMailingLists(tx)
	if err != nil {
		t.Fatal(err)
	}
	if plan.CanApply || strings.Join(plan.Lists[0].Current, ",") != "alice@example.invalid,bob@example.invalid" || strings.Join(plan.Lists[1].Current, ",") != "alice@example.invalid" || len(plan.Lists[0].PendingTasks)+len(plan.Lists[1].PendingTasks) != 0 {
		t.Fatal("post-task readback did not match both groups")
	}
	if _, err := controllers.SyncMailingLists(tx, plan.Token); err == nil {
		t.Fatal("idempotent lists wrote again")
	}
	if err := tx.Model(alice).Update("bureau", false).Error; err != nil {
		t.Fatal(err)
	}
	if err := tx.Model(bob).Update("email", "robert@example.invalid").Error; err != nil {
		t.Fatal(err)
	}
	plan, err = controllers.PreviewMailingLists(tx)
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Lists[0].Add) != 1 || len(plan.Lists[0].Remove) != 1 || len(plan.Lists[1].Remove) != 1 {
		t.Fatal("member changes not reflected")
	}
	// Also verify a response that can already be confirmed by immediate readback.
	f.mu.Lock()
	f.delay = 0
	f.mu.Unlock()
	result, err = controllers.SyncMailingLists(tx, plan.Token)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Verified || result.Partial {
		t.Fatal("completed writes were not reported as verified")
	}
	completeTasks(f)
	plan, err = controllers.PreviewMailingLists(tx)
	if err != nil || plan.CanApply || len(plan.Lists[1].Current) != 0 || strings.Join(plan.Lists[0].Current, ",") != "alice@example.invalid,robert@example.invalid" {
		t.Fatal("updated source not synchronized")
	}
	var history []struct {
		Request  struct{ Method, Path string }
		Response struct{ Status int }
	}
	if err := json.Unmarshal(request("GET", "/history", nil), &history); err != nil {
		t.Fatal(err)
	}
	writes := 0
	for _, h := range history {
		if h.Response.Status != 200 {
			t.Fatalf("Smocker request %s %s failed: %d", h.Request.Method, h.Request.Path, h.Response.Status)
		}
		if h.Request.Method != "GET" {
			writes++
		}
	}
	if writes != 8 {
		t.Fatalf("unexpected write count %d", writes)
	}
	// A later Smocker override must exercise the real client's error path too.
	request("POST", "/mocks", []byte(`[{"request":{"method":"GET","path":"/email/domain/example.invalid/task/mailinglist"},"response":{"status":503,"body":"{}"}}]`))
	if _, err := controllers.PreviewMailingLists(tx); err == nil {
		t.Fatal("Smocker failure hidden")
	}
}
