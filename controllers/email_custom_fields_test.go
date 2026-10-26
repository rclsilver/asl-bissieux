package controllers

import (
	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"testing"
)

func TestEmailTemplateCustomFieldsFollowSavedContent(t *testing.T) {
	db, _ := testdb.Open(t)
	row, err := CreateEmailTemplate(db, "Custom", "{{.date_limite}}", "{{range .cotisations}}{{.remaining}}{{end}}{{.sender.name}}")
	if err != nil {
		t.Fatal(err)
	}
	if len(row.CustomFields.Fields) != 2 {
		t.Fatalf("create metadata: %+v", row.CustomFields)
	}
	loaded, err := GetEmailTemplate(db, row.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(loaded.CustomFields.Fields) != 2 {
		t.Fatalf("get metadata: %+v", loaded.CustomFields)
	}
	if _, err := UpdateEmailTemplate(db, row.ID, "Updated", "{{.reference}}", "Message fixe"); err != nil {
		t.Fatal(err)
	}
	all, err := ListEmailTemplates(db)
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 1 || len(all[0].CustomFields.Fields) != 1 || all[0].CustomFields.Fields[0].Name != "reference" {
		t.Fatalf("list/update metadata: %+v", all)
	}
	if db.Migrator().HasColumn("email_template", "custom_fields") {
		t.Fatal("derived metadata must not be persisted")
	}
}
