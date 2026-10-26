package controllers

import (
	"bytes"
	"testing"

	"github.com/rclsilver/asl-bissieux/internal/testdb"
)

func TestAttachmentContentOnlyLoadedForDownloadAndDelivery(t *testing.T) {
	conn, _ := testdb.Open(t)
	email := emailFixture(t, conn)
	campaign, err := GetEmailCampaign(conn, email.EmailCampaignID)
	if err != nil {
		t.Fatal(err)
	}
	content := []byte("fictitious attachment content")
	attachment, err := AddAttachment(conn, campaign.EmailTemplateID, "fixture.txt", false, "text/plain", content)
	if err != nil {
		t.Fatal(err)
	}
	listed, err := ListAttachments(conn, campaign.EmailTemplateID)
	if err != nil || len(listed) != 1 {
		t.Fatalf("list: %v %v", listed, err)
	}
	if len(listed[0].Content) != 0 || listed[0].Size != len(content) {
		t.Fatal("list loaded content or lost metadata")
	}
	templates, err := ListEmailTemplates(conn)
	if err != nil || len(templates) != 1 || len(templates[0].Attachments) != 1 || len(templates[0].Attachments[0].Content) != 0 {
		t.Fatalf("template list loaded attachment content: %v", err)
	}
	preview, err := GetEmail(conn, email.ID, false)
	if err != nil || len(preview.EmailCampaign.EmailTemplate.Attachments) != 1 || len(preview.EmailCampaign.EmailTemplate.Attachments[0].Content) != 0 {
		t.Fatalf("preview loaded attachment content: %v", err)
	}
	download, err := GetAttachment(conn, campaign.EmailTemplateID, attachment.ID)
	if err != nil || !bytes.Equal(download.Content, content) {
		t.Fatalf("download lost content: %v", err)
	}
	delivery, err := getEmail(conn, email.ID, false, true)
	if err != nil || !bytes.Equal(delivery.EmailCampaign.EmailTemplate.Attachments[0].Content, content) {
		t.Fatalf("delivery lost content: %v", err)
	}
	if err := DeleteAttachment(conn, campaign.EmailTemplateID, attachment.ID); err != nil {
		t.Fatal(err)
	}
	listed, err = ListAttachments(conn, campaign.EmailTemplateID)
	if err != nil || len(listed) != 0 {
		t.Fatalf("delete failed: %v", err)
	}
}
