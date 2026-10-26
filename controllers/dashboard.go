package controllers

import (
	"database/sql"

	"github.com/juju/errors"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/money"
	"gorm.io/gorm"
)

func GetBudgetDashboard(tx *gorm.DB, budgetID string, year int) (*models.BudgetDashboard, error) {
	var currentYear int
	if err := tx.Raw("SELECT EXTRACT(YEAR FROM NOW() AT TIME ZONE 'Europe/Paris')::int").Scan(&currentYear).Error; err != nil {
		return nil, err
	}
	if year == 0 {
		year = currentYear
	}
	if year < 1 || year > 9999 {
		return nil, errors.NewBadRequest(nil, "Choisis une année comprise entre 1 et 9999.")
	}
	result := &models.BudgetDashboard{Year: year, Timezone: "Europe/Paris", Months: make([]models.MonthlyCollection, 12), Years: []int{}}
	err := tx.Transaction(func(tx *gorm.DB) error {
		var err error
		result.Budget, err = GetBudget(tx, budgetID)
		if err != nil {
			return err
		}
		result.Cotisations, err = ListCotisations(tx, budgetID)
		if err != nil {
			return err
		}
		result.Recovery = SummarizeRecovery(result.Cotisations)
		// Calendar dates are interpreted in the same explicit business timezone.
		// Date-only refunds already use that business date; no UTC shift is applied.
		var totals []struct {
			PeriodMonth       int
			Payments, Refunds money.Amount
		}
		if err := tx.Raw(`SELECT period_month, SUM(payments) payments, SUM(refunds) refunds FROM (
   SELECT EXTRACT(MONTH FROM p.date AT TIME ZONE 'Europe/Paris')::int AS period_month,SUM(p.amount) payments,0::numeric refunds
   FROM payment p JOIN cotisation c ON c.id=p.cotisation_id AND c.deleted_at IS NULL
   WHERE c.budget_id=? AND p.deleted_at IS NULL AND EXTRACT(YEAR FROM p.date AT TIME ZONE 'Europe/Paris')=? GROUP BY 1
   UNION ALL
   SELECT EXTRACT(MONTH FROM e.date)::int AS period_month,0::numeric payments,SUM(e.amount) refunds
   FROM financial_entry e JOIN cotisation c ON c.id=e.cotisation_id AND c.deleted_at IS NULL
   WHERE c.budget_id=? AND e.kind='refund' AND EXTRACT(YEAR FROM e.date)=? GROUP BY 1
  ) movements GROUP BY period_month`, budgetID, year, budgetID, year).Scan(&totals).Error; err != nil {
			return err
		}
		cumulative := money.Euros(0)
		for i := range result.Months {
			row := models.MonthlyCollection{Month: i + 1}
			for _, t := range totals {
				if t.PeriodMonth == i+1 {
					row.Payments = t.Payments
					row.Refunds = t.Refunds
					break
				}
			}
			row.Net = money.Of(row.Payments.Sub(row.Refunds.Decimal))
			cumulative = cumulative.Add(row.Net)
			row.Cumulative = cumulative
			result.Months[i] = row
		}
		return tx.Raw(`SELECT DISTINCT period_year FROM (
   SELECT EXTRACT(YEAR FROM p.date AT TIME ZONE 'Europe/Paris')::int AS period_year FROM payment p JOIN cotisation c ON c.id=p.cotisation_id AND c.deleted_at IS NULL WHERE c.budget_id=? AND p.deleted_at IS NULL
   UNION SELECT EXTRACT(YEAR FROM e.date)::int AS period_year FROM financial_entry e JOIN cotisation c ON c.id=e.cotisation_id AND c.deleted_at IS NULL WHERE c.budget_id=? AND e.kind='refund'
   UNION SELECT ?::int AS period_year UNION SELECT ?::int AS period_year
  ) periods WHERE period_year BETWEEN 1 AND 9999 ORDER BY period_year DESC`, budgetID, budgetID, currentYear, year).Scan(&result.Years).Error
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	return result, err
}

// Each lot's surplus stays separate; it never covers another lot's shortfall.
// The recovery rate measures calls actually covered, so surplus cannot inflate it.
func SummarizeRecovery(rows []*models.CotisationResult) models.RecoverySummary {
	result := models.RecoverySummary{}
	seen := map[string]bool{}
	for _, r := range rows {
		if seen[r.UnitID] {
			continue
		}
		seen[r.UnitID] = true
		result.Lots++
		result.Called = result.Called.Add(r.Amount)
		result.Paid = result.Paid.Add(r.Paid)
		result.Refunded = result.Refunded.Add(r.Refunded)
		remaining := money.Of(r.Amount.Sub(r.Paid.Decimal))
		if remaining.IsPositive() {
			result.Remaining = result.Remaining.Add(remaining)
			if r.Paid.IsPositive() {
				result.Partial++
			} else {
				result.Unpaid++
			}
		} else {
			result.Settled++
			if remaining.IsNegative() {
				result.Overpaid++
				result.Surplus = result.Surplus.Add(money.Of(remaining.Neg()))
			}
		}
		covered := r.Paid
		if covered.Cmp(r.Amount) > 0 {
			covered = r.Amount
		}
		if covered.IsPositive() {
			result.Covered = result.Covered.Add(covered)
		}
	}
	if result.Called.IsPositive() {
		rate, _ := result.Covered.Div(result.Called.Decimal).Mul(money.Euros(100).Decimal).Round(2).Float64()
		result.Rate = &rate
	}
	return result
}

func GetDirectoryQuality(tx *gorm.DB) (*models.DirectoryQuality, error) {
	var result models.DirectoryQuality
	err := tx.Raw(`SELECT
  (SELECT COUNT(*) FROM member WHERE deleted_at IS NULL AND (email IS NULL OR email ~ '^[[:space:]]*$')) missing_email,
  (SELECT COUNT(*) FROM unit u WHERE u.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM member_unit mu JOIN member m ON m.id=mu.member_id AND m.deleted_at IS NULL WHERE mu.unit_id=u.id)) no_member,
  (SELECT COUNT(*) FROM unit WHERE deleted_at IS NULL AND (share IS NULL OR share<=0)) invalid_shares`).Scan(&result).Error
	return &result, err
}

func GetEmailDashboard(tx *gorm.DB) (*models.EmailDashboard, error) {
	result := &models.EmailDashboard{}
	err := tx.Transaction(func(tx *gorm.DB) error {
		if err := tx.Table("email e").Joins("JOIN email_campaign c ON c.id=e.email_campaign_id AND c.deleted_at IS NULL").Where("e.deleted_at IS NULL").Select(`COUNT(*) total,
   COUNT(*) FILTER(WHERE e.state='WAITING') waiting,
   COUNT(*) FILTER(WHERE e.state='SENDING') sending,
   COUNT(*) FILTER(WHERE e.state IN ('SENT','READ')) successful,
   COUNT(*) FILTER(WHERE e.state='ERROR') error,
   COUNT(*) FILTER(WHERE e.state NOT IN ('WAITING','SENDING','SENT','READ','ERROR')) unknown`).Scan(&result.Counts).Error; err != nil {
			return err
		}
		page, err := ListEmailCampaignPage(tx, CampaignPageOptions{Page: 1, PageSize: 5})
		if err != nil {
			return err
		}
		result.Recent = page.Items
		result.Campaigns = page.Total
		return nil
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	return result, err
}
