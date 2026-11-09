package controllers

import (
	"fmt"
	"github.com/google/uuid"
	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/money"
	"testing"
	"time"
)

func TestDashboardRecoveryAndMonths(t *testing.T) {
	tx, _ := testdb.Open(t)
	budget := models.NewBudget("Explicit budget, not a year")
	user := auth.NewUser("dashboard@example.invalid", true, true, nil)
	tx.Create(budget)
	tx.Create(user)
	tx.Model(budget).Update("draft", false)
	var calls []*models.Cotisation
	for i := 1; i <= 3; i++ {
		u := models.NewUnit(i, fmt.Sprintf("Fixture %d", i), 1)
		if err := tx.Create(u).Error; err != nil {
			t.Fatal(err)
		}
		c := models.NewCotisation(budget.ID, u.ID, money.Euros(100))
		if err := tx.Create(c).Error; err != nil {
			t.Fatal(err)
		}
		calls = append(calls, c)
	}
	member := models.NewMember("Shared", "Member", "", "", " ")
	tx.Create(member)
	for _, c := range calls[:2] {
		tx.Exec("INSERT INTO member_unit(member_id,unit_id) VALUES (?,?)", member.ID, c.UnitID)
	}
	coowner := models.NewMember("Coowner", "Member", "", "contact@example.invalid", "")
	tx.Create(coowner)
	tx.Exec("INSERT INTO member_unit(member_id,unit_id) VALUES (?,?)", coowner.ID, calls[0].UnitID)
	parse := func(s string) time.Time {
		v, err := time.Parse(time.RFC3339, s)
		if err != nil {
			t.Fatal(err)
		}
		return v
	}
	p := models.NewPayment(calls[1].ID, user.ID, parse("2026-01-31T23:30:00Z"), money.Euros(25), "February in Paris")
	for _, row := range []*models.Payment{models.NewPayment(calls[0].ID, user.ID, parse("2025-12-31T23:30:00Z"), money.Euros(150), "January in Paris"), models.NewPayment(calls[0].ID, user.ID, parse("2024-06-01T00:00:00Z"), money.Euros(10), "Earlier period"), p} {
		if err := tx.Create(row).Error; err != nil {
			t.Fatal(err)
		}
	}
	in := FinancialInput{ID: uuid.NewString(), Kind: "refund", Amount: money.Euros(20), Date: "2026-03-01", Reason: "Fixture"}
	preview, err := PreviewFinancialEntry(tx, budget.ID, calls[0].ID, in)
	if err != nil {
		t.Fatal(err)
	}
	in.Version = preview.Version
	if _, err := CreateFinancialEntry(tx, budget.ID, calls[0].ID, user.ID, in); err != nil {
		t.Fatal(err)
	}
	in = FinancialInput{ID: uuid.NewString(), Kind: "adjustment", Amount: money.Euros(-20), Date: "2026-03-01", Reason: "Fixture reduction"}
	preview, err = PreviewFinancialEntry(tx, budget.ID, calls[2].ID, in)
	if err != nil {
		t.Fatal(err)
	}
	in.Version = preview.Version
	if _, err := CreateFinancialEntry(tx, budget.ID, calls[2].ID, user.ID, in); err != nil {
		t.Fatal(err)
	}
	dashboard, err := GetBudgetDashboard(tx, budget.ID, 2026)
	if err != nil {
		t.Fatal(err)
	}
	r := dashboard.Recovery
	if r.Lots != 3 || r.Settled != 1 || r.Overpaid != 1 || r.Partial != 1 || r.Unpaid != 1 || !r.Called.Equal(money.Euros(280)) || !r.Paid.Equal(money.Euros(165)) || !r.Remaining.Equal(money.Euros(155)) || !r.Surplus.Equal(money.Euros(40)) || r.Rate == nil || *r.Rate != 44.64 {
		t.Fatalf("recovery: %+v", r)
	}
	if len(dashboard.Months) != 12 || !dashboard.Months[0].Payments.Equal(money.Euros(150)) || !dashboard.Months[1].Payments.Equal(money.Euros(25)) || !dashboard.Months[2].Net.Equal(money.Euros(-20)) || !dashboard.Months[11].Cumulative.Equal(money.Euros(155)) {
		t.Fatalf("monthly calendar: %+v", dashboard.Months)
	}
	if len(dashboard.Years) < 2 {
		t.Fatal("outside-period payment year missing")
	}
	tx.Model(p).Update("date", parse("2027-02-01T00:00:00Z"))
	dashboard, err = GetBudgetDashboard(tx, budget.ID, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if !dashboard.Months[11].Cumulative.Equal(money.Euros(130)) {
		t.Fatal("payment date correction ignored")
	}
	tx.Delete(p)
	dashboard, err = GetBudgetDashboard(tx, budget.ID, 2027)
	if err != nil {
		t.Fatal(err)
	}
	if !dashboard.Months[11].Cumulative.IsZero() || dashboard.Recovery.Partial != 0 || dashboard.Recovery.Unpaid != 2 {
		t.Fatal("payment deletion ignored")
	}
	draft := models.NewBudget("Draft")
	tx.Create(draft)
	tx.Create(models.NewExpense(draft.ID, "Planned", money.Euros(300)))
	dashboard, err = GetBudgetDashboard(tx, draft.ID, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if dashboard.Recovery.Rate != nil || dashboard.Budget.Preview == nil || !dashboard.Budget.Preview.Ready {
		t.Fatal("draft forecast mixed with calls")
	}
}

func TestDashboardDirectoryAndEmailSummary(t *testing.T) {
	tx, _ := testdb.Open(t)
	m := models.NewMember("Missing", "Email", "", " \t ", "")
	tx.Create(m)
	u := models.NewUnit(1, "Fixture", 0)
	tx.Create(u)
	archived := models.NewMember("Archived", "Email", "", "", "")
	tx.Create(archived)
	tx.Delete(archived)
	tx.Exec("INSERT INTO member_unit(member_id,unit_id) VALUES (?,?)", archived.ID, u.ID)
	quality, err := GetDirectoryQuality(tx)
	if err != nil {
		t.Fatal(err)
	}
	if quality.MissingEmail != 1 || quality.NoMember != 1 || quality.InvalidShares != 1 {
		t.Fatalf("directory: %+v", quality)
	}
	tx.Exec("INSERT INTO member_unit(member_id,unit_id) VALUES (?,?)", m.ID, u.ID)
	quality, err = GetDirectoryQuality(tx)
	if err != nil || quality.NoMember != 0 {
		t.Fatal("active member ignored")
	}
	template := models.NewEmailTemplate("Fixture", "Subject", "Body never needed")
	tx.Create(template)
	for i := 0; i < 7; i++ {
		campaign := models.NewEmailCampaign("Fixture campaign", template, map[string]any{})
		tx.Create(campaign)
		email := models.NewEmail(campaign, "private@example.invalid", map[string]any{})
		email.State = []models.EmailState{models.Waiting, models.Sending, models.Sent, models.Read, models.Error, models.Unknown, models.Error}[i]
		tx.Create(email)
		if i == 6 {
			tx.Delete(campaign)
		}
	}
	summary, err := GetEmailDashboard(tx)
	if err != nil {
		t.Fatal(err)
	}
	c := summary.Counts
	if summary.Campaigns != 6 || len(summary.Recent) != 5 || c.Total != 6 || c.Successful != 2 || c.Waiting != 1 || c.Sending != 1 || c.Error != 1 || c.Unknown != 1 {
		t.Fatalf("emails: %+v", summary)
	}
	for state, want := range map[string]int64{"WAITING": 1, "SENDING": 1, "SUCCESSFUL": 2, "ERROR": 1, "UNKNOWN": 1} {
		page, err := ListEmailCampaignPage(tx, CampaignPageOptions{PageSize: 1}, state)
		if err != nil || page.Total != want {
			t.Fatalf("filtered campaign %s: %+v %v", state, page, err)
		}
	}
	var unknown models.Email
	if err := tx.First(&unknown, "state = ?", models.Unknown).Error; err != nil {
		t.Fatal(err)
	}
	var campaign models.EmailCampaign
	tx.First(&campaign, "id = ?", unknown.EmailCampaignID)
	legacy := models.NewEmail(&campaign, "legacy@example.invalid", map[string]any{})
	legacy.State = "LEGACY_UNKNOWN"
	if err := tx.Create(legacy).Error; err != nil {
		t.Fatal(err)
	}
	page, err := ListEmailPage(tx, campaign.ID, EmailPageOptions{State: models.Unknown})
	if err != nil || page.Total != 2 {
		t.Fatalf("unknown states missing from detail: %+v %v", page, err)
	}
	summary, err = GetEmailDashboard(tx)
	if err != nil || summary.Counts.Unknown != page.Total {
		t.Fatal("summary and filtered details differ for unknown states")
	}

}
