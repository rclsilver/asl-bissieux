package smtp

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"html/template"
	"net/smtp"
)

func Send(c context.Context, to string, subject, message, trackingToken string, attachments ...*Attachment) error {
	body, err := getBody(subject, message, trackingToken)
	if err != nil {
		return err
	}

	msg := newMessage(subject, body)
	msg.AddTo(to)
	msg.Attach(attachments...)

	msgBytes, err := msg.ToBytes()
	if err != nil {
		return err
	}

	return sendEmail(c, to, msgBytes)
}

func sendEmail(c context.Context, to string, message []byte) error {
	clt, err := smtp.Dial(fmt.Sprintf("%s:%d", cfg.Host, cfg.Port))
	if err != nil {
		return err
	}
	defer clt.Close()

	if cfg.TLS {
		clt.StartTLS(&tls.Config{ServerName: cfg.Host})
	}

	if cfg.Username != "" {
		if err := clt.Auth(smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)); err != nil {
			return err
		}
	}

	if err := clt.Mail(cfg.From.Address); err != nil {
		return err
	}
	if err := clt.Rcpt(to); err != nil {
		return err
	}

	w, err := clt.Data()
	if err != nil {
		return err
	}
	defer w.Close()

	if _, err := w.Write([]byte(message)); err != nil {
		return err
	}

	return nil
}

func getTrackingURL(token string) (string, error) {
	t := template.New("")

	if _, err := t.Parse(cfg.TrackingURL); err != nil {
		return "", nil
	}

	var result bytes.Buffer

	if err := t.Execute(&result, map[string]string{"token": token}); err != nil {
		return "", err
	}

	return result.String(), nil
}

func getBody(subject, message, trackingToken string) (string, error) {
	trackingURL, err := getTrackingURL(trackingToken)
	if err != nil {
		return "", err
	}

	t := template.New("")

	if _, err := t.Parse(cfg.Template); err != nil {
		return "", err
	}

	var result bytes.Buffer

	if err := t.Execute(&result, map[string]any{
		"message": template.HTML(message),
		"tracker": template.HTML(`<img src="` + trackingURL + `" style="display: none" />`),
		"from":    cfg.ReplyTo.Address,
		"subject": subject,
	}); err != nil {
		return "", err
	}

	return result.String(), nil
}
