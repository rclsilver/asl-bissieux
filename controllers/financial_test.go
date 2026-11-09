package controllers

import (
	"github.com/google/uuid"
	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/money"
	"sync"
	"testing"
	"time"
)

func TestFinancialLedgerIntegration(t *testing.T) {
	conn, _ := testdb.Open(t)
	b := models.NewBudget("Published ledger fixture")
	u := auth.NewUser("ledger@example.invalid", true, true, nil)
	lot := models.NewUnit(1, "Fixture", 1)
	for _, r := range []any{b, u, lot} {
		if err := conn.Create(r).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err := conn.Model(b).Update("draft", false).Error; err != nil {
		t.Fatal(err)
	}
	c := models.NewCotisation(b.ID, lot.ID, money.Euros(100))
	if err := conn.Create(c).Error; err != nil {
		t.Fatal(err)
	}
	p := models.NewPayment(c.ID, u.ID, time.Now(), money.Euros(150), "Fixture")
	if err := conn.Create(p).Error; err != nil {
		t.Fatal(err)
	}
	input := func(kind, amount string) FinancialInput {
		return FinancialInput{ID: uuid.NewString(), Kind: kind, Amount: money.MustParse(amount), Date: "2026-10-21", Reason: "Fixture reason", Reference: "Fixture ref"}
	}
	preview := func(in FinancialInput) FinancialInput {
		t.Helper()
		p, err := PreviewFinancialEntry(conn, b.ID, c.ID, in)
		if err != nil {
			t.Fatal(err)
		}
		in.Version = p.Version
		return in
	}
	save := func(in FinancialInput) *models.FinancialEntry {
		t.Helper()
		r, err := CreateFinancialEntry(conn, b.ID, c.ID, u.ID, preview(in))
		if err != nil {
			t.Fatal(err)
		}
		return r
	}
	for _, amount := range []string{"0", "-1", "50.01", "1.001"} {
		if _, err := PreviewFinancialEntry(conn, b.ID, c.ID, input("refund", amount)); err == nil {
			t.Fatalf("invalid refund %s accepted", amount)
		}
	}
	first := save(input("refund", "20"))
	save(input("refund", "30"))
	rows, err := ListCotisations(conn, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !rows[0].Paid.Equal(money.Euros(100)) || !rows[0].Refunded.Equal(money.Euros(50)) || rows[0].PaymentState != 1 {
		t.Fatalf("partial/full refund totals: %+v", rows[0])
	}
	if _, err := PreviewFinancialEntry(conn, b.ID, c.ID, input("refund", "0.01")); err == nil {
		t.Fatal("excess refund accepted")
	}
	if err := GuardPaymentReduction(conn, c.ID, money.Euros(101)); err == nil {
		t.Fatal("refunded payment deletion accepted")
	}
	if err := GuardPaymentReduction(conn, c.ID, money.Euros(100)); err != nil {
		t.Fatal(err)
	}
	reverse := input("refund", "0")
	reverse.ReversesID = first.ID
	save(reverse)
	if _, err := PreviewFinancialEntry(conn, b.ID, c.ID, reverse); err == nil {
		t.Fatal("duplicate reversal accepted")
	}
	decrease := save(input("adjustment", "-25"))
	save(input("refund", "45"))
	if _, err := PreviewFinancialEntry(conn, b.ID, c.ID, input("adjustment", "-75.01")); err == nil {
		t.Fatal("negative called accepted")
	}
	undo := input("adjustment", "0")
	undo.ReversesID = decrease.ID
	save(undo)
	var original models.Cotisation
	conn.First(&original, "id = ?", c.ID)
	if !original.Amount.Equal(money.Euros(100)) {
		t.Fatal("initial call changed")
	}
	if err := conn.Model(&models.FinancialEntry{}).Where("id = ?", first.ID).Update("reason", "changed").Error; err == nil {
		t.Fatal("immutable entry updated")
	}
	if err := conn.Delete(first).Error; err == nil {
		t.Fatal("immutable entry deleted")
	}
	stale := preview(input("adjustment", "10"))
	save(input("adjustment", "1"))
	if _, err := CreateFinancialEntry(conn, b.ID, c.ID, u.ID, stale); err == nil {
		t.Fatal("stale preview accepted")
	}
	// Two commits of the same preview cannot both apply, even concurrently.
	concurrent := preview(input("adjustment", "5"))
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := CreateFinancialEntry(conn, b.ID, c.ID, u.ID, concurrent)
			results <- err
		}()
	}
	wg.Wait()
	close(results)
	success := 0
	for err := range results {
		if err == nil {
			success++
		}
	}
	if success != 1 {
		t.Fatalf("duplicate applied %d times", success)
	}
	budget, err := GetBudget(conn, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !budget.Called.Equal(money.Euros(106)) || !budget.Paid.Equal(money.Euros(75)) || !budget.Refunded.Equal(money.Euros(75)) || !budget.GrossPaid.Equal(money.Euros(150)) {
		t.Fatalf("budget totals: %+v", budget)
	}
}
