package controllers

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
)

func TestPagedEmailHistory(t *testing.T) {
	conn, _ := testdb.Open(t)
	template := models.NewEmailTemplate("Fixture", "{{.name}} / {{.shared}}", "PRIVATE_BODY {{.name}}")
	if err := conn.Create(template).Error; err != nil {
		t.Fatal(err)
	}
	campaign := models.NewEmailCampaign("Campaign", template, map[string]any{"shared": "campaign"})
	if err := conn.Create(campaign).Error; err != nil {
		t.Fatal(err)
	}
	states := []models.EmailState{models.Waiting, models.Sending, models.Unknown, models.Sent, models.Error, models.Read}
	var rows []*models.Email
	for i := 0; i < 101; i++ {
		row := models.NewEmail(campaign, fmt.Sprintf("person%03d@example.invalid", i), map[string]any{
			"name": fmt.Sprintf("Name %03d", i), "shared": "row", "private": "PRIVATE_CONTEXT"})
		row.CreatedAt = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
		row.State = states[i%len(states)]
		row.Subject = "Stored subject"
		row.Message = "PRIVATE_BODY"
		if row.State == models.Error {
			row.Error = "Private SMTP detail"
		}
		rows = append(rows, row)
	}
	if err := conn.Create(&rows).Error; err != nil {
		t.Fatal(err)
	}
	if err := conn.Delete(rows[100]).Error; err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	previous := ""
	for page := 1; page <= 4; page++ {
		result, err := ListEmailPage(conn, campaign.ID, EmailPageOptions{PageOptions: PageOptions{Page: page}})
		if err != nil {
			t.Fatal(err)
		}
		if result.Total != 100 || result.PageSize != 25 || len(result.Items) != 25 {
			t.Fatalf("page %+v", result)
		}
		for _, row := range result.Items {
			if seen[row.ID] || (previous != "" && row.ID >= previous) {
				t.Fatal("duplicate or unstable order")
			}
			seen[row.ID] = true
			previous = row.ID
		}
		payload, _ := json.Marshal(result)
		for _, secret := range []string{"PRIVATE_", "Private SMTP", "message", "data", "attachments"} {
			if strings.Contains(string(payload), secret) {
				t.Fatalf("listing exposed %s", secret)
			}
		}
	}
	filtered, err := ListEmailPage(conn, campaign.ID, EmailPageOptions{PageOptions: PageOptions{Query: "PERSON000@", Page: 99}, State: models.Waiting})
	if err != nil || filtered.Total != 1 || filtered.Page != 1 || filtered.Items[0].Subject != "Name 000 / campaign" {
		t.Fatalf("filtered %+v: %v", filtered, err)
	}
	full, err := GetEmail(conn, rows[0].ID, false)
	if err != nil || full.Subject != filtered.Items[0].Subject {
		t.Fatalf("preview differs: %+v %v", full, err)
	}
	details, err := GetEmailStatus(conn, rows[4].ID)
	if err != nil || details.Error != "Private SMTP detail" || details.State != models.Error {
		t.Fatalf("details %+v %v", details, err)
	}
	literal := models.NewEmail(campaign, "literal%_target@example.invalid", map[string]any{"name": "Literal"})
	if err := conn.Create(literal).Error; err != nil {
		t.Fatal(err)
	}
	found, err := ListEmailPage(conn, campaign.ID, EmailPageOptions{PageOptions: PageOptions{Query: "%_target", Sort: "to", Direction: "asc"}})
	if err != nil || found.Total != 1 || found.Items[0].ID != literal.ID {
		t.Fatalf("literal %+v: %v", found, err)
	}
	empty, err := ListEmailPage(conn, campaign.ID, EmailPageOptions{PageOptions: PageOptions{Query: "no-such-recipient"}})
	if err != nil || empty.Total != 0 || len(empty.Items) != 0 || empty.Page != 1 {
		t.Fatalf("empty %+v: %v", empty, err)
	}
	// Rendering the page never renders the message body.
	if err := conn.Model(template).Update("message", "{{").Error; err != nil {
		t.Fatal(err)
	}
	page, err := ListEmailPage(conn, campaign.ID, EmailPageOptions{PageOptions: PageOptions{Query: "person000@"}})
	if err != nil || page.Items[0].HasError || page.Items[0].Subject != "Name 000 / campaign" {
		t.Fatalf("body rendered in listing: %+v %v", page, err)
	}
	if _, err := GetEmail(conn, rows[0].ID, false); err == nil {
		t.Fatal("full preview ignored invalid body")
	}
	if err := conn.Model(template).Update("subject", "{{").Error; err != nil {
		t.Fatal(err)
	}
	page, err = ListEmailPage(conn, campaign.ID, EmailPageOptions{PageOptions: PageOptions{Query: "person000@"}})
	if err != nil || !page.Items[0].HasError || page.Items[0].Subject != "" {
		t.Fatalf("subject failure hid page: %+v %v", page, err)
	}
	if err := conn.Delete(campaign).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := ListEmailPage(conn, campaign.ID, EmailPageOptions{}); err == nil {
		t.Fatal("deleted campaign still visible")
	}
}

func TestEmailPageRejectsInvalidOptions(t *testing.T) {
	for _, options := range []EmailPageOptions{
		{PageOptions: PageOptions{PageSize: 101}}, {PageOptions: PageOptions{Page: -1}},
		{PageOptions: PageOptions{Sort: "subject"}}, {PageOptions: PageOptions{Direction: "sideways"}},
		{State: "INVALID"}, {PageOptions: PageOptions{Query: strings.Repeat("é", 201)}},
	} {
		if _, err := ListEmailPage(nil, uuid.NewString(), options); err == nil {
			t.Fatalf("accepted %+v", options)
		}
	}
	if _, err := ListEmailPage(nil, "not-a-uuid", EmailPageOptions{}); err == nil {
		t.Fatal("invalid campaign ID")
	}
	if _, err := GetEmailStatus(nil, "not-a-uuid"); err == nil {
		t.Fatal("invalid email ID")
	}
}
