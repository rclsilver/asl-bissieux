package smtp

import (
	"bytes"
	"encoding/base64"
	"io"
	"net/http"

	"github.com/sloonz/go-qprintable"
)

type MimeMessage interface {
	setAsPart() MimeMessage

	SetHeader(name, value string) MimeMessage
	Read(p []byte) (n int, err error)

	setEOL(eol string) MimeMessage
	EOL() string
}

type mimeMessage struct {
	// The transfer encoding for this message. General rules are:
	//  - message/rfc822, message/partial and message/external-body only accept 7bit
	//  - multipart/* only accept 7bit, 8bit and binary
	//  - you should not use "binary" and "8bit", since such messages will not
	//    be conform with SMTP
	//  - for encodings other than base64 and quoted-printable, it is your responsibility
	//    to ensure that the given data conforms to the encoding, and that data does not
	//    contain the multipart boundary in multipart parts
	// If you use NewTextMessage, NewBinaryMessage and NewMultipartMessage, you shouldn't
	// have to worry about this. It is wise not to modify it yourself, since defautlts
	// are standard compliants and works well with multipart messages
	TE TransferEncoding

	// For quoted-printable transfer-encoding, define the canonical form of the body for
	// ends of line encoding. Use BinaryEncoding to avoid any end of line conversion, but
	// please note that this is invalid for text/* entities if you want to be pedantic
	// (in practice, few MUA are perturbated by bad end of lines)
	QPEncoding *qprintable.Encoding

	// Headers of the message. They are stored in the http.CanonicalHeaderKey format.
	// Don't put content-transfer-encoding nor mime-version into this, it will be handled
	// internally.
	Headers map[string]string

	// End of line characters. Defaults to CRLF (as required by most standards), but you may
	// want change this to "\n" if you intend to write in a Maildir, which requires LF line
	// endings.
	eol string

	// The body of the message
	Body io.Reader

	isMultipartPart bool
	buf             *bytes.Buffer
	bodyReader      io.Reader
}

// New message containing text data. It will be encoded with quoted-printable encoding.
// You should use this for text/* media types.
func newTextMessage(qpEncoding *qprintable.Encoding, body io.Reader) MimeMessage {
	m := new(mimeMessage)
	m.TE = TE_qprintable
	m.QPEncoding = qpEncoding
	m.Body = body
	m.Headers = make(map[string]string)
	m.eol = "\r\n"
	return m
}

// New message containing binary data. It will be encoded with base64 encoding.
// You should use this for all media types but text/* and multipart/*
func newBinaryMessage(body io.Reader) MimeMessage {
	m := new(mimeMessage)
	m.TE = TE_base64
	m.Body = body
	m.Headers = make(map[string]string)
	m.eol = "\r\n"
	return m
}

func (m *mimeMessage) setAsPart() MimeMessage {
	m.isMultipartPart = true
	return m
}

// Set an header. val will be directly written ; to escape it, see EncodeWord.
// Returns self.
func (m *mimeMessage) SetHeader(name, val string) MimeMessage {
	m.Headers[http.CanonicalHeaderKey(name)] = val
	return m
}

// Read the MIME representation of the message (headers + body). You can do this
// only once, since after the first representation this will always return os.EOF.
// For base64 and quoted-printable encodings, also take care of encoding the body.
func (m *mimeMessage) Read(p []byte) (n int, err error) {
	// Write message header to buffer on first call
	// TODO: wrap headers ?
	if m.buf == nil {
		m.buf = bytes.NewBuffer(nil)
		if !m.isMultipartPart {
			m.buf.WriteString("MIME-Version: 1.0" + m.eol)
		}
		if m.TE != TE_7bit {
			if (m.TE == TE_8bit || m.TE == TE_binary) && m.isMultipartPart {
				return n, PartInvalidTransferEncoding
			} else {
				m.buf.WriteString("Content-Transfer-Encoding: " + string(m.TE) + m.eol)
			}
		}
		for name, val := range m.Headers {
			m.buf.WriteString(name + ": " + val + m.eol)
		}
		m.buf.WriteString(m.eol)
	}

	// Create body transform (transfer encoding)
	if m.bodyReader == nil {
		buf := bytes.NewBuffer(nil)
		if m.TE == TE_qprintable {
			m.bodyReader = &qprintableReader{m.Body, buf, qprintable.NewEncoderWithEOL(m.eol, m.QPEncoding, buf)}
		} else if m.TE == TE_base64 {
			m.bodyReader = &base64Reader{[]byte(m.eol), m.Body, buf, base64.NewEncoder(base64.StdEncoding, buf), 0, nil}
		} else {
			m.bodyReader = m.Body
		}
	}

	// Main loop
	for len(p) > n && err != io.EOF {
		if m.buf.Len() > 0 {
			nn, _ := m.buf.Read(p[n:])
			n += nn
		} else {
			nn, merr := m.bodyReader.Read(p[n:])
			err = merr
			n += nn
		}
	}

	return n, err
}

func (m *mimeMessage) setEOL(eol string) MimeMessage {
	m.eol = eol
	return m
}

func (m *mimeMessage) EOL() string {
	return m.eol
}
