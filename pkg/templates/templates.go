package templates

import (
	"bytes"
	"encoding/json"
	"text/template"

	"github.com/Masterminds/sprig/v3"
	"github.com/juju/errors"
)

type Template struct {
	data map[string]any
}

func NewTemplate(data map[string]any) (*Template, error) {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, errors.Annotate(err, "unable to marshal the data")
	}

	var context map[string]any
	if err := json.Unmarshal(jsonBytes, &context); err != nil {
		return nil, errors.Annotate(err, "unable to unmarshal the data")
	}

	return &Template{
		data: data,
	}, nil
}

func (t *Template) Execute(fmt string) ([]byte, error) {
	tmpl := template.New("")
	tmpl.Option("missingkey=error")
	tmpl.Funcs(sprig.TxtFuncMap())

	if _, err := tmpl.Parse(fmt); err != nil {
		return nil, errors.Annotate(err, "unable to parse the template")
	}

	var content bytes.Buffer
	if err := tmpl.Execute(&content, t.data); err != nil {
		return nil, errors.Annotate(err, "unable to execute the template")
	}

	return content.Bytes(), nil
}
