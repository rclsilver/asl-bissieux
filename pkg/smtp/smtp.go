package smtp

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"html/template"
	"net"
	"net/smtp"
	"net/textproto"
	"time"
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

// DeliveryError indicates that SMTP may have accepted the message. Retrying
// such an error requires checking delivery first.
type DeliveryError struct{ Err error }

func (e *DeliveryError) Error() string { return fmt.Sprintf("delivery uncertain: %v", e.Err) }
func (e *DeliveryError) Unwrap() error { return e.Err }

func IsDeliveryUncertain(err error) bool {
	var deliveryErr *DeliveryError
	return errors.As(err, &deliveryErr)
}

func sendEmail(c context.Context, to string, message []byte) error {
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	ctx, cancel := context.WithTimeout(c, timeout)
	defer cancel()
	conn, err := (&net.Dialer{}).DialContext(ctx, "tcp", net.JoinHostPort(cfg.Host, fmt.Sprint(cfg.Port)))
	if err != nil {
		return err
	}
	defer conn.Close()
	deadline, _ := ctx.Deadline()
	if err := conn.SetDeadline(deadline); err != nil {
		return err
	}
	finished := make(chan struct{})
	defer close(finished)
	go func() {
		select {
		case <-ctx.Done():
			conn.Close()
		case <-finished:
		}
	}()
	clt, err := smtp.NewClient(conn, cfg.Host)
	if err != nil {
		return err
	}
	defer clt.Close()

	if cfg.TLS {
		if err := clt.StartTLS(&tls.Config{ServerName: cfg.Host, MinVersion: tls.VersionTLS12}); err != nil {
			return err
		}
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
	if _, err := w.Write([]byte(message)); err != nil {
		return &DeliveryError{Err: err}
	}
	if err := w.Close(); err != nil {
		var smtpErr *textproto.Error
		if errors.As(err, &smtpErr) && smtpErr.Code >= 400 {
			return err // The server explicitly refused the message.
		}
		return &DeliveryError{Err: err}
	}
	return nil // Success is reported only after the final SMTP acknowledgement.
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
