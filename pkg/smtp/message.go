package smtp

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"mime/multipart"
	"strings"
)

type Attachment struct {
	name        string
	contentType string
	content     []byte
}

func NewAttachment(name, contentType string, content []byte) *Attachment {
	return &Attachment{
		name:        name,
		contentType: contentType,
		content:     content,
	}
}

type Message struct {
	from    string
	replyTo string

	to  []string
	cc  []string
	bcc []string

	subject string
	body    string

	attachments []*Attachment
}

func newMessage(subject, body string) *Message {
	return &Message{
		from:    fmt.Sprintf("%q <%s>", cfg.From.Name, cfg.From.Address),
		replyTo: cfg.From.Address,
		subject: subject,
		body:    body,
	}
}

func (m *Message) AddTo(to ...string) {
	m.to = append(m.to, to...)
}

func (m *Message) AddCc(cc ...string) {
	m.cc = append(m.cc, cc...)
}

func (m *Message) AddBcc(bcc ...string) {
	m.bcc = append(m.bcc, bcc...)
}

func (m *Message) Attach(attachments ...*Attachment) {
	m.attachments = append(m.attachments, attachments...)
}

func (m *Message) ToBytes() ([]byte, error) {
	buffer := bytes.NewBuffer(nil)
	withAttachments := len(m.attachments) > 0

	// write the headers
	buffer.WriteString("MIME-Version: 1.0\n")
	buffer.WriteString(fmt.Sprintf("From: %s\n", m.from))
	buffer.WriteString(fmt.Sprintf("Reply-To: %s\n", m.replyTo))
	buffer.WriteString(fmt.Sprintf("To: %s\n", strings.Join(m.to, ",")))

	if len(m.cc) > 0 {
		buffer.WriteString(fmt.Sprintf("Cc: %s\n", strings.Join(m.cc, ",")))
	}

	if len(m.bcc) > 0 {
		buffer.WriteString(fmt.Sprintf("Bcc: %s\n", strings.Join(m.bcc, ",")))
	}

	buffer.WriteString(fmt.Sprintf("Subject: %s\n", m.subject))
	buffer.WriteString(fmt.Sprintf("Reply-To: %s\n", m.replyTo))

	writer := multipart.NewWriter(buffer)
	boundary := writer.Boundary()

	if withAttachments {
		buffer.WriteString(fmt.Sprintf("Content-Type: multipart/mixed; boundary=%s\n", boundary))
		buffer.WriteString(fmt.Sprintf("--%s\n", boundary))
	}

	buffer.WriteString(fmt.Sprintf("Content-Type: %s\n", `text/html; charset="utf-8"`))
	buffer.WriteString(m.body)

	if withAttachments {
		for _, attachment := range m.attachments {
			buffer.WriteString(fmt.Sprintf("\n\n--%s\n", boundary))
			buffer.WriteString(fmt.Sprintf("Content-Type: %s\n", attachment.contentType))
			buffer.WriteString("Content-Transfer-Encoding: base64\n")
			buffer.WriteString(fmt.Sprintf("Content-Disposition: attachment; filename=%s\n", attachment.name))

			b := make([]byte, base64.StdEncoding.EncodedLen(len(attachment.content)))
			base64.StdEncoding.Encode(b, attachment.content)
			buffer.Write(b)
			buffer.WriteString(fmt.Sprintf("\n--%s", boundary))
		}

		buffer.WriteString("--")
	}

	return buffer.Bytes(), nil
}
