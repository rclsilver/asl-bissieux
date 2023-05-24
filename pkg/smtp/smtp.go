package smtp

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"html/template"
	"net/smtp"
)

func Send(c context.Context, to string, subject, message, trackingToken string) error {
	body, err := getBody(subject, message, trackingToken)
	if err != nil {
		return err
	}

	headers := map[string]string{
		"From":         fmt.Sprintf("%q <%s>", cfg.From.Name, cfg.From.Address),
		"Reply-To":     cfg.From.Address,
		"To":           to,
		"Subject":      subject,
		"MIME-Version": "1.0",
		"Content-Type": `text/html; charset="utf-8"`,
	}

	msg := createMessage(headers, body)

	return sendEmail(c, to, msg)
}

func createMessage(headers map[string]string, message string) string {
	var result string

	for k, v := range headers {
		if v != "" {
			result += k + ": " + v + "\r\n"
		}
	}

	result += "\r\n"
	result += message

	return result
}

func sendEmail(c context.Context, to string, message string) error {
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
		"from":    cfg.From.Address,
		"subject": subject,
	}); err != nil {
		return "", err
	}

	return result.String(), nil
}
