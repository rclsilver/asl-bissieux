package controllers

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
)

func TestEmailCampaignPagination(t *testing.T) {
	conn, _ := testdb.Open(t)
	template := models.NewEmailTemplate("Fixture", "Subject", "PRIVATE_BODY_"+strings.Repeat("x", 1024))
	if err := conn.Create(template).Error; err != nil {
		t.Fatal(err)
	}
	created := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	rows := make([]*models.EmailCampaign, 123)
	for i := range rows {
		rows[i] = models.NewEmailCampaign(fmt.Sprintf("Campaign %03d", i), template, map[string]any{"private": "PRIVATE_CONTEXT"})
		rows[i].CreatedAt = created
	}
	if err := conn.Create(&rows).Error; err != nil {
		t.Fatal(err)
	}
	target := rows[0]
	states := []models.EmailState{models.Waiting, models.Sending, models.Unknown, models.Sent, models.Error, models.Read}
	emails := make([]*models.Email, 1000)
	for i := range emails {
		emails[i] = models.NewEmail(target, "PRIVATE_RECIPIENT@example.invalid", map[string]any{"private": strings.Repeat("x", 1024)})
		emails[i].Message = "PRIVATE_BODY_" + strings.Repeat("x", 1024)
		emails[i].State = states[i%len(states)]
	}
	if err := conn.Create(&emails).Error; err != nil {
		t.Fatal(err)
	}
	if err := conn.Delete(emails[0]).Error; err != nil {
		t.Fatal(err)
	}
	if err := conn.Delete(rows[122]).Error; err != nil {
		t.Fatal(err)
	}

	first, err := ListEmailCampaignPage(conn, CampaignPageOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if first.Total != 122 || first.Page != 1 || first.PageSize != 25 || len(first.Items) != 25 {
		t.Fatalf("page %+v", first)
	}
	seen := map[string]bool{}
	previous := ""
	for page := 1; page <= 5; page++ {
		result, err := ListEmailCampaignPage(conn, CampaignPageOptions{Page: page})
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range result.Items {
			if seen[item.ID] || (previous != "" && item.ID >= previous) {
				t.Fatal("duplicate or unstable equal-date ordering")
			}
			seen[item.ID] = true
			previous = item.ID
		}
	}
	if len(seen) != 122 {
		t.Fatalf("lost campaigns: %d", len(seen))
	}
	filtered, err := ListEmailCampaignPage(conn, CampaignPageOptions{Query: "cAmPaIgN 000", Page: 999})
	if err != nil {
		t.Fatal(err)
	}
	if filtered.Total != 1 || filtered.Page != 1 || len(filtered.Items) != 1 {
		t.Fatalf("filtered %+v", filtered)
	}
	counts := filtered.Items[0].Counts
	if counts.Total != 999 || counts.Waiting != 166 || counts.Sending != 167 || counts.Unknown != 167 || counts.Successful != 333 || counts.Error != 166 {
		t.Fatalf("counts %+v", counts)
	}
	if counts.Waiting+counts.Sending+counts.Successful+counts.Error+counts.Unknown != counts.Total {
		t.Fatal("states counted more than once")
	}
	literal := models.NewEmailCampaign("Literal 100%_safe", template, map[string]any{})
	if err := conn.Create(literal).Error; err != nil {
		t.Fatal(err)
	}
	for _, term := range []string{"100%_", "Literal 100%_safe"} {
		result, err := ListEmailCampaignPage(conn, CampaignPageOptions{Query: term})
		if err != nil || result.Total != 1 || result.Items[0].ID != literal.ID {
			t.Fatalf("literal search %+v: %v", result, err)
		}
	}
	empty, err := ListEmailCampaignPage(conn, CampaignPageOptions{Query: "no such campaign"})
	if err != nil || empty.Total != 0 || empty.Page != 1 || len(empty.Items) != 0 {
		t.Fatalf("empty %+v: %v", empty, err)
	}
	bounded, err := ListEmailCampaignPage(conn, CampaignPageOptions{PageSize: 100})
	if err != nil || len(bounded.Items) != 100 {
		t.Fatalf("bound %+v: %v", bounded, err)
	}
	sorted, err := ListEmailCampaignPage(conn, CampaignPageOptions{Sort: "title", Direction: "asc", PageSize: 10})
	if err != nil || sorted.Items[0].Title != "Campaign 000" {
		t.Fatalf("title sort %+v: %v", sorted, err)
	}
	payload, err := json.Marshal(filtered)
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{"PRIVATE_", "attachments", "template_id", "message", "data", "@example.invalid"} {
		if strings.Contains(string(payload), forbidden) {
			t.Fatalf("private detail in summary: %s", forbidden)
		}
	}
	var oldRows []*models.EmailCampaign
	start := time.Now()
	if err := conn.Preload("EmailTemplate").Preload("Emails").Find(&oldRows).Error; err != nil {
		t.Fatal(err)
	}
	oldJSON, _ := json.Marshal(oldRows)
	t.Logf("representative fixture: %d campaigns, %d emails; old full payload=%d bytes in %s, one campaign summary=%d bytes", len(oldRows), len(emails), len(oldJSON), time.Since(start), len(payload))
	if len(oldJSON) < 100*len(payload) {
		t.Fatal("fixture does not exercise large message payloads")
	}
}

func TestCampaignPageRejectsUnboundedOrUnsafeOptions(t *testing.T) {
	for _, options := range []CampaignPageOptions{
		{Page: -1}, {Page: 1000001}, {PageSize: -1}, {PageSize: 101},
		{Sort: "title; DROP TABLE email"}, {Direction: "desc; DELETE FROM email"}, {Query: strings.Repeat("é", 201)},
	} {
		if _, err := ListEmailCampaignPage(nil, options); err == nil {
			t.Fatalf("accepted %+v", options)
		}
	}
}
