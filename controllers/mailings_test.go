package controllers

import (
	"context"
	"errors"
	"testing"

	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/mailings"
)

type mailingFake struct {
	data    map[string][]string
	pending map[string][]int64
	calls   int
	fail    bool
	queued  bool
}

func (f *mailingFake) Subscribers(_ context.Context, l string) ([]string, error) {
	return append([]string{}, f.data[l]...), nil
}
func (f *mailingFake) Pending(_ context.Context, l string) ([]int64, error) { return f.pending[l], nil }
func (f *mailingFake) Add(_ context.Context, l, e string) error {
	f.calls++
	if f.fail {
		return errors.New("private provider error")
	}
	if f.queued {
		f.pending[l] = []int64{123}
		return nil
	}
	f.data[l] = append(f.data[l], e)
	return nil
}
func (f *mailingFake) Remove(_ context.Context, l, e string) error {
	f.calls++
	if f.fail {
		return errors.New("private provider error")
	}
	if f.queued {
		f.pending[l] = []int64{123}
		return nil
	}
	for i, email := range f.data[l] {
		if email == e {
			f.data[l] = append(f.data[l][:i], f.data[l][i+1:]...)
			break
		}
	}
	return nil
}
func TestMailingSynchronization(t *testing.T) {
	tx, _ := testdb.Open(t)
	member := models.NewMember("Alice", "Fixture", "", "alice@example.invalid", "")
	member.Bureau = true
	if err := tx.Create(member).Error; err != nil {
		t.Fatal(err)
	}
	cfg := &mailings.Config{Domain: "example.invalid", Members: "membres", Bureau: "bureau"}
	oldLoad, oldNew := loadMailingConfig, newMailingProvider
	defer func() { loadMailingConfig = oldLoad; newMailingProvider = oldNew }()
	loadMailingConfig = func() (*mailings.Config, error) { return cfg, nil }
	provider := &mailingFake{data: map[string][]string{"membres": {"former@example.invalid"}}, pending: map[string][]int64{}}
	newMailingProvider = func(*mailings.Config) (mailings.Provider, error) { return provider, nil }
	plan, err := PreviewMailingLists(tx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := SyncMailingLists(tx, "stale"); err == nil || provider.calls != 0 {
		t.Fatal("stale preview caused writes")
	}
	result, err := SyncMailingLists(tx, plan.Token)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Verified || result.Partial || provider.calls != 3 {
		t.Fatalf("not verified: %+v calls%d", result, provider.calls)
	}
	again, err := PreviewMailingLists(tx)
	if err != nil {
		t.Fatal(err)
	}
	if again.CanApply {
		t.Fatal("synchronized lists should have no changes")
	}
	if _, err := SyncMailingLists(tx, again.Token); err == nil || provider.calls != 3 {
		t.Fatal("unnecessary repeat writes")
	}
	// Updating source membership invalidates an already reviewed token.
	if err := tx.Model(member).Update("bureau", false).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := SyncMailingLists(tx, again.Token); err == nil {
		t.Fatal("source changes accepted old preview")
	}
	provider.data = map[string][]string{}
	provider.queued = true
	provider.calls = 0
	plan, err = PreviewMailingLists(tx)
	if err != nil {
		t.Fatal(err)
	}
	result, err = SyncMailingLists(tx, plan.Token)
	if err != nil {
		t.Fatal(err)
	}
	if result.Verified || result.Plan.CanApply || len(result.Plan.Lists[0].PendingTasks) == 0 {
		t.Fatal("queued tasks falsely reported as completed")
	}
	calls := provider.calls
	if _, err := SyncMailingLists(tx, result.Plan.Token); err == nil || provider.calls != calls {
		t.Fatal("duplicated pending request")
	}
	provider.pending = map[string][]int64{}
	provider.queued = false
	provider.fail = true
	plan, err = PreviewMailingLists(tx)
	if err != nil {
		t.Fatal(err)
	}
	result, err = SyncMailingLists(tx, plan.Token)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Partial || result.Verified {
		t.Fatal("provider failure hidden")
	}
}
