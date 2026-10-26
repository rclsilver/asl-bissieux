package controllers

import (
	"reflect"
	"testing"

	"github.com/juju/errors"
	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/money"
)

func TestBudgetEmailValidationKeepsSourceData(t *testing.T) {
	data := map[string]any{"member": map[string]any{"first_name": "Alice"}}
	extra := map[string]any{"sender": map[string]any{"name": "ASL"}}
	template := models.NewEmailTemplate("Mutable", `{{$_ := set .member "first_name" "Changed"}}{{.member.first_name}}`, `{{$_ := set .sender "name" "Changed"}}{{.sender.name}}`)
	if err := validateBudgetEmailTemplate(template, data, extra); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(data, map[string]any{"member": map[string]any{"first_name": "Alice"}}) || !reflect.DeepEqual(extra, map[string]any{"sender": map[string]any{"name": "ASL"}}) {
		t.Fatalf("validation mutated source contexts: %+v / %+v", data, extra)
	}
}

func TestInvalidRecipientPreventsCampaignCreation(t *testing.T) {
	conn, _ := testdb.Open(t)
	budget := models.NewBudget("All recipients validated")
	if err := conn.Create(budget).Error; err != nil {
		t.Fatal(err)
	}
	member := models.NewMember("Alice", "Multi", "", "alice@example.invalid", "")
	coowner := models.NewMember("Bob", "Single", "", "bob@example.invalid", "")
	for _, row := range []*models.Member{member, coowner} {
		if err := conn.Create(row).Error; err != nil {
			t.Fatal(err)
		}
	}
	for index := 1; index <= 2; index++ {
		unit := models.NewUnit(index, string(rune('A'+index)), 1)
		if err := conn.Create(unit).Error; err != nil {
			t.Fatal(err)
		}
		if err := conn.Model(member).Association("Units").Append(unit); err != nil {
			t.Fatal(err)
		}
		if index == 1 {
			if err := conn.Model(coowner).Association("Units").Append(unit); err != nil {
				t.Fatal(err)
			}
		}
		if err := conn.Create(models.NewCotisation(budget.ID, unit.ID, money.Euros(100))).Error; err != nil {
			t.Fatal(err)
		}
	}
	template := models.NewEmailTemplate("Second lot required", "Bonjour {{.member.first_name}}", "{{(index .cotisations 1).unit.number}}")
	if err := conn.Create(template).Error; err != nil {
		t.Fatal(err)
	}
	// Alice is a valid representative, but Bob has only one cotisation.
	if _, err := PreviewBudgetEmail(conn, budget.ID, template.ID, member.ID, map[string]any{}, BudgetEmailRecipientFilter{}); err != nil {
		t.Fatal(err)
	}
	if err := SendBudgetEmail(conn, budget.ID, template.ID, map[string]any{}, false, false); !errors.IsBadRequest(err) {
		t.Fatalf("invalid coowner context must reject preparation: %v", err)
	}
	for _, model := range []any{&models.EmailCampaign{}, &models.Email{}} {
		var count int64
		if err := conn.Model(model).Count(&count).Error; err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatalf("validation created rows for %T: %d", model, count)
		}
	}
}
