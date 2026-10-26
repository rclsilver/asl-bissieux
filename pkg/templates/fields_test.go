package templates

import (
	"reflect"
	"testing"
)

func TestDescribeFields(t *testing.T) {
	cases := []struct {
		name, source string
		fields       []CustomField
		advanced     bool
	}{
		{"simple and duplicate", "{{.date_limite}} {{.reference}} {{.date_limite}}", []CustomField{{"date_limite", false}, {"reference", false}}, false},
		{"automatic and local range", "{{.member.first_name}}{{range .cotisations}}{{.remaining}}{{$.date_limite}}{{end}}", []CustomField{{"date_limite", false}}, false},
		{"with local and else root", "{{with .member}}{{.first_name}}{{$.reference}}{{else}}{{.autre}}{{end}}", []CustomField{{"autre", false}, {"reference", false}}, false},
		{"if preserves root", "{{if .active}}{{.date}}{{else}}{{.other}}{{end}}", []CustomField{{"active", false}, {"date", false}, {"other", false}}, false},
		{"complex and aliases", "{{$sender := .sender}}{{.sender.name}}{{range .days}}{{.label}}{{end}}", []CustomField{{"days", true}, {"sender", true}}, false},
		{"literal and dynamic index", "{{index . \"date_limite\"}}{{index . .key}}", []CustomField{{"date_limite", false}, {"key", false}}, true},
		{"named root template", "{{define \"part\"}}{{.reference}}{{end}}{{template \"part\" .}}", []CustomField{{"reference", false}}, false},
		{"named local template", "{{define \"part\"}}{{.first_name}}{{end}}{{template \"part\" .member}}", []CustomField{}, false},
		{"root with", "{{with $}}{{.reference}}{{end}}", []CustomField{{"reference", false}}, false},
		{"invalid syntax", "{{if}}", []CustomField{}, true},
		{"no execution", "{{fail \"must not execute\"}}{{.reference}}", []CustomField{{"reference", false}}, false},
		{"root alias", "{{$root := .}}{{$root.date_limite}}", []CustomField{{"date_limite", false}}, false},
		{"local aliases", "{{range $i, $c := .cotisations}}{{$c.remaining}}{{$.date_limite}}{{end}}", []CustomField{{"date_limite", false}}, false},
		{"map alias", "{{$sender := .sender}}{{$sender.name}}", []CustomField{{"sender", true}}, false},
		{"named local dollar", "{{define \"part\"}}{{$.first_name}}{{end}}{{template \"part\" .member}}", []CustomField{}, false},
		{"numeric index", "{{index .days 0}}", []CustomField{{"days", true}}, true},
		{"computed Sprig key", "{{dig \"date_limite\" \"default\" .}}", []CustomField{}, true},
		{"literal key with outer spaces", "{{index . \" date_limite \"}}", []CustomField{}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := DescribeFields(c.source)
			if !reflect.DeepEqual(got.Fields, c.fields) || got.Advanced != c.advanced {
				t.Fatalf("got %+v, want %+v / %v", got, c.fields, c.advanced)
			}
		})
	}
}
