package smtp

import (
	"bytes"
	"fmt"
	"io"
	"strings"

	message "github.com/sloonz/go-mime-message"
	"github.com/sloonz/go-qprintable"
	"jaytaylor.com/html2text"
)

type Attachment struct {
	name        string
	contentType string
	content     []byte
	inline      bool
}

func NewAttachment(name, contentType string, content []byte, inline bool) *Attachment {
	return &Attachment{
		name:        name,
		contentType: contentType,
		content:     content,
		inline:      inline,
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
		replyTo: fmt.Sprintf("%q <%s>", cfg.ReplyTo.Name, cfg.ReplyTo.Address),
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
	// build the body (plain + html / alternative)
	body := newMultipartMessage("alternative", "")

	// add the text part
	plain, err := html2text.FromString(m.body)
	if err != nil {
		return nil, err
	}
	text := newTextMessage(qprintable.UnixTextEncoding, strings.NewReader(plain+body.eol))
	text.SetHeader("Content-Type", `text/plain; charset="UTF-8"`)
	body.AddPart(text)

	// add the html part
	html := newTextMessage(qprintable.UnixTextEncoding, strings.NewReader(m.body+body.eol))
	html.SetHeader("Content-Type", `text/html; charset="UTF-8"`)
	body.AddPart(html)

	withAttachments := len(m.attachments) > 0
	withInlineAttachments := false

	for _, attachment := range m.attachments {
		if attachment.inline {
			withInlineAttachments = true
		}
	}

	var envelope *multipartMessage
	var bodyEnvelope *multipartMessage

	if withAttachments {
		envelope = newMultipartMessage("mixed", "")

		if withInlineAttachments {
			bodyEnvelope = newMultipartMessage("related", "")
			bodyEnvelope.AddPart(body)
			envelope.AddPart(bodyEnvelope)
		} else {
			envelope.AddPart(body)
		}

		for _, attachment := range m.attachments {
			att := newBinaryMessage(bytes.NewReader(attachment.content))
			att.SetHeader("Content-Type", fmt.Sprintf("%s; name=%q", attachment.contentType, attachment.name))
			att.SetHeader("Content-Disposition", fmt.Sprintf("attachment; name=%q", attachment.name))
			att.SetHeader("X-Attachment-Id", attachment.name)
			att.SetHeader("Content-ID", "<"+attachment.name+">")

			if attachment.inline {
				bodyEnvelope.AddPart(att)
			} else {
				envelope.AddPart(att)
			}
		}
	} else {
		envelope = body
	}

	// set headers
	envelope.SetHeader("From", m.from)
	envelope.SetHeader("Reply-To", m.replyTo)
	envelope.SetHeader("To", strings.Join(m.to, ","))

	if len(m.cc) > 0 {
		envelope.SetHeader("Cc", strings.Join(m.cc, ","))
	}

	if len(m.bcc) > 0 {
		envelope.SetHeader("Bcc", strings.Join(m.bcc, ","))
	}

	envelope.SetHeader("Subject", message.EncodeWord(m.subject))

	return io.ReadAll(envelope)
}
