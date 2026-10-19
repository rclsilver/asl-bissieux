package controllers

import (
	"testing"
	"time"

	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/money"
)

func TestBudgetRecipientsIntegration(t *testing.T) {
	conn, _ := testdb.Open(t)
	budget := models.NewBudget("Recipient test")
	user := auth.NewUser("operator@example.invalid", true, true, nil)
	if err := conn.Create(budget).Error; err != nil {
		t.Fatal(err)
	}
	if err := conn.Create(user).Error; err != nil {
		t.Fatal(err)
	}
	var units []*models.Unit
	for i, amount := range []int64{0, 25, 50, 100, 120} {
		unit := models.NewUnit(i+1, "Test address "+string(rune('A'+i)), 1)
		if err := conn.Create(unit).Error; err != nil {
			t.Fatal(err)
		}
		units = append(units, unit)
		cotisation := models.NewCotisation(budget.ID, unit.ID, money.Euros(100))
		if err := conn.Create(cotisation).Error; err != nil {
			t.Fatal(err)
		}
		if amount > 0 {
			if err := conn.Create(models.NewPayment(cotisation.ID, user.ID, time.Now(), money.Euros(amount), "test")).Error; err != nil {
				t.Fatal(err)
			}
		}
	}
	multi := models.NewMember("Alice", "Multi", "", "multi@example.invalid", "")
	coowner := models.NewMember("Bob", "Coowner", "", "coowner@example.invalid", "")
	paid := models.NewMember("Camille", "Paid", "", "paid@example.invalid", "")
	withoutEmail := models.NewMember("Dana", "No email", "", "", "")
	for _, member := range []*models.Member{multi, coowner, paid, withoutEmail} {
		if err := conn.Create(member).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err := conn.Model(multi).Association("Units").Append(units[0], units[1]); err != nil {
		t.Fatal(err)
	}
	if err := conn.Model(coowner).Association("Units").Append(units[1]); err != nil {
		t.Fatal(err)
	}
	if err := conn.Model(paid).Association("Units").Append(units[2], units[3], units[4]); err != nil {
		t.Fatal(err)
	}
	if err := conn.Model(withoutEmail).Association("Units").Append(units[4]); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name            string
		doing, paid     bool
		paidCotisations int
	}{
		{"below half only", false, false, 0},
		{"include in progress", true, false, 1},
		{"include paid but not in progress", false, true, 2},
		{"all", true, true, 3},
	} {
		t.Run(tc.name, func(t *testing.T) {
			template := models.NewEmailTemplate(tc.name, "{{.member.first_name}}", "{{range .cotisations}}Lot {{.unit.number}} {{end}}")
			if err := conn.Create(template).Error; err != nil {
				t.Fatal(err)
			}
			if err := SendBudgetEmail(conn, budget.ID, template.ID, map[string]any{}, tc.doing, tc.paid); err != nil {
				t.Fatal(err)
			}
			var campaign models.EmailCampaign
			if err := conn.Where("email_template_id = ?", template.ID).First(&campaign).Error; err != nil {
				t.Fatal(err)
			}
			rows, err := ListEmails(conn, campaign.ID)
			if err != nil {
				t.Fatal(err)
			}
			expected := map[string]int{"multi@example.invalid": 2, "coowner@example.invalid": 1}
			if tc.paidCotisations > 0 {
				expected["paid@example.invalid"] = tc.paidCotisations
			}
			if len(rows) != len(expected) {
				t.Fatalf("got %d emails, expected %d", len(rows), len(expected))
			}
			for _, email := range rows {
				count, exists := expected[email.To]
				if !exists {
					t.Fatalf("duplicate or unexpected recipient: %s", email.To)
				}
				cotisations, ok := email.Data["cotisations"].([]interface{})
				if !ok || len(cotisations) != count {
					t.Fatalf("%s: got %v cotisations, expected %d", email.To, email.Data["cotisations"], count)
				}
				delete(expected, email.To)
			}
		})
	}
}
