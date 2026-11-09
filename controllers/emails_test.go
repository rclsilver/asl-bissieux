package controllers

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"net/textproto"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/juju/errors"
	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/config"
	"gorm.io/gorm"
)

type deliverySMTP struct {
	mode     atomic.Value
	received atomic.Int32
	arrived  chan struct{}
	release  chan struct{}
	done     chan struct{}
}

func smtpForDelivery(t *testing.T) *deliverySMTP {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	s := &deliverySMTP{arrived: make(chan struct{}, 20), release: make(chan struct{}), done: make(chan struct{})}
	s.mode.Store("accept")
	var workers sync.WaitGroup
	workers.Add(1)
	go func() {
		defer workers.Done()
		for {
			client, err := listener.Accept()
			if err != nil {
				return
			}
			workers.Add(1)
			go func() {
				defer workers.Done()
				defer client.Close()
				client.SetDeadline(time.Now().Add(3 * time.Second))
				mode := s.mode.Load().(string)
				fmt.Fprint(client, "220 localhost simulated SMTP\r\n")
				reader := bufio.NewReader(client)
				for {
					line, err := reader.ReadString('\n')
					if err != nil {
						return
					}
					switch {
					case strings.HasPrefix(line, "EHLO"), strings.HasPrefix(line, "HELO"), strings.HasPrefix(line, "MAIL FROM:"):
						fmt.Fprint(client, "250 OK\r\n")
					case strings.HasPrefix(line, "RCPT TO:"):
						if mode == "reject" {
							fmt.Fprint(client, "550 recipient rejected\r\n")
							return
						}
						fmt.Fprint(client, "250 OK\r\n")
					case strings.TrimSpace(line) == "DATA":
						fmt.Fprint(client, "354 send message\r\n")
						if _, err := textproto.NewReader(reader).ReadDotBytes(); err != nil {
							return
						}
						s.received.Add(1)
						select {
						case s.arrived <- struct{}{}:
						default:
						}
						if mode == "hold" {
							select {
							case <-s.release:
							case <-s.done:
								return
							}
						}
						if mode == "drop" {
							return
						}
						if mode == "reject-data" {
							fmt.Fprint(client, "550 message rejected\r\n")
							return
						}
						fmt.Fprint(client, "250 accepted\r\n")
						return
					default:
						fmt.Fprint(client, "500 unsupported\r\n")
						return
					}
				}
			}()
		}
	}()
	t.Cleanup(func() { close(s.done); listener.Close(); workers.Wait() })
	t.Setenv("APP_SMTP_HOST", "127.0.0.1")
	t.Setenv("APP_SMTP_PORT", strconv.Itoa(listener.Addr().(*net.TCPAddr).Port))
	t.Setenv("APP_SMTP_TIMEOUT", "2s")
	t.Setenv("APP_SMTP_TEMPLATE", "{{.message}}")
	if err := config.Load(); err != nil {
		t.Fatal(err)
	}
	return s
}

func emailFixture(t *testing.T, conn *gorm.DB) *models.Email {
	t.Helper()
	template := models.NewEmailTemplate("Delivery test", "Test subject", "Test message")
	if err := conn.Create(template).Error; err != nil {
		t.Fatal(err)
	}
	campaign := models.NewEmailCampaign("Delivery test", template, map[string]any{})
	if err := conn.Create(campaign).Error; err != nil {
		t.Fatal(err)
	}
	email := models.NewEmail(campaign, "recipient@example.invalid", map[string]any{})
	if err := conn.Create(email).Error; err != nil {
		t.Fatal(err)
	}
	return email
}

func waitEmailState(t *testing.T, conn *gorm.DB, id string, expected models.EmailState) {
	t.Helper()
	deadline := time.After(4 * time.Second)
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()
	for {
		var email models.Email
		if err := conn.First(&email, "id = ?", id).Error; err != nil {
			t.Fatal(err)
		}
		if email.State == expected {
			return
		}
		select {
		case <-deadline:
			t.Fatalf("email state=%s, expected=%s, error=%s", email.State, expected, email.Error)
		case <-ticker.C:
		}
	}
}

func TestEmailDeliveryIntegration(t *testing.T) {
	conn, pool := testdb.Open(t)
	ctx := context.Background()
	t.Run("synchronous send waits for SMTP acceptance", func(t *testing.T) {
		s := smtpForDelivery(t)
		email := emailFixture(t, conn)
		if err := SendEmail(ctx, conn, email.ID, true); err != nil {
			t.Fatal(err)
		}
		waitEmailState(t, conn, email.ID, models.Sent)
		if s.received.Load() != 1 {
			t.Fatal("SMTP did not receive exactly one message")
		}
		if err := SendEmail(ctx, conn, email.ID, true); !errors.IsBadRequest(err) {
			t.Fatalf("sent email can be resent: %v", err)
		}
	})
	t.Run("asynchronous work survives request cancellation and finishes", func(t *testing.T) {
		s := smtpForDelivery(t)
		s.mode.Store("hold")
		email := emailFixture(t, conn)
		requestCtx, cancel := context.WithCancel(ctx)
		if err := SendEmail(requestCtx, conn, email.ID, false); err != nil {
			t.Fatal(err)
		}
		cancel()
		select {
		case <-s.arrived:
		case <-time.After(3 * time.Second):
			t.Fatal("async send did not start")
		}
		waitEmailState(t, conn, email.ID, models.Sending)
		if err := MarkAsError(ctx, conn, email.ID); !errors.IsBadRequest(err) {
			t.Fatalf("in-flight email can be reset: %v", err)
		}
		if err := DeleteEmail(conn, email.ID); !errors.IsBadRequest(err) {
			t.Fatalf("in-flight email can be deleted: %v", err)
		}
		close(s.release)
		waitEmailState(t, conn, email.ID, models.Sent)
		if pool.Stats().InUse != 0 {
			t.Fatal("async send retained a database connection")
		}
	})
	t.Run("concurrent calls share one durable claim", func(t *testing.T) {
		s := smtpForDelivery(t)
		email := emailFixture(t, conn)
		var requests sync.WaitGroup
		results := make(chan error, 8)
		for i := 0; i < 8; i++ {
			requests.Add(1)
			go func() { defer requests.Done(); results <- SendEmail(ctx, conn, email.ID, true) }()
		}
		requests.Wait()
		close(results)
		var successes int
		for err := range results {
			if err == nil {
				successes++
			} else if !errors.IsBadRequest(err) {
				t.Fatal(err)
			}
		}
		if successes != 1 || s.received.Load() != 1 {
			t.Fatalf("successes=%d, SMTP messages=%d", successes, s.received.Load())
		}
	})
	t.Run("SMTP refusal is an error and a later retry can succeed", func(t *testing.T) {
		s := smtpForDelivery(t)
		s.mode.Store("reject")
		email := emailFixture(t, conn)
		if err := SendEmail(ctx, conn, email.ID, true); err == nil {
			t.Fatal("SMTP refusal reported success")
		}
		waitEmailState(t, conn, email.ID, models.Error)
		s.mode.Store("accept")
		if err := SendEmail(ctx, conn, email.ID, true); err != nil {
			t.Fatal(err)
		}
		waitEmailState(t, conn, email.ID, models.Sent)
	})
	t.Run("final DATA refusal is not ignored", func(t *testing.T) {
		s := smtpForDelivery(t)
		s.mode.Store("reject-data")
		email := emailFixture(t, conn)
		if err := SendEmail(ctx, conn, email.ID, true); err == nil {
			t.Fatal("final SMTP refusal reported success")
		}
		waitEmailState(t, conn, email.ID, models.Error)
	})
	t.Run("lost acknowledgement requires explicit retry authorization", func(t *testing.T) {
		s := smtpForDelivery(t)
		s.mode.Store("drop")
		email := emailFixture(t, conn)
		if err := SendEmail(ctx, conn, email.ID, true); err == nil {
			t.Fatal("lost acknowledgement reported success")
		}
		waitEmailState(t, conn, email.ID, models.Unknown)
		if err := SendEmail(ctx, conn, email.ID, true); !errors.IsBadRequest(err) {
			t.Fatalf("uncertain message can be resent: %v", err)
		}
		if s.received.Load() != 1 {
			t.Fatal("uncertain message sent more than once")
		}
		if err := MarkAsError(ctx, conn, email.ID); err != nil {
			t.Fatal(err)
		}
		s.mode.Store("accept")
		if err := SendEmail(ctx, conn, email.ID, true); err != nil {
			t.Fatal(err)
		}
	})
	t.Run("persistence failures never silently permit resending", func(t *testing.T) {
		s := smtpForDelivery(t)
		email := emailFixture(t, conn)
		if err := conn.Exec(`CREATE FUNCTION fail_sent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state = 'SENT' THEN RAISE EXCEPTION 'simulated outcome failure'; END IF; RETURN NEW; END $$`).Error; err != nil {
			t.Fatal(err)
		}
		if err := conn.Exec(`CREATE TRIGGER fail_sent BEFORE UPDATE ON email FOR EACH ROW EXECUTE FUNCTION fail_sent()`).Error; err != nil {
			t.Fatal(err)
		}
		defer conn.Exec(`DROP TRIGGER fail_sent ON email`)
		if err := SendEmail(ctx, conn, email.ID, true); err == nil {
			t.Fatal("database failure reported success")
		}
		waitEmailState(t, conn, email.ID, models.Unknown)
		if err := SendEmail(ctx, conn, email.ID, true); !errors.IsBadRequest(err) {
			t.Fatalf("uncertain message can be resent: %v", err)
		}
		if s.received.Load() != 1 {
			t.Fatal("message sent twice after persistence failure")
		}
	})
	t.Run("cancellation while awaiting acceptance leaves an uncertain result", func(t *testing.T) {
		s := smtpForDelivery(t)
		s.mode.Store("hold")
		email := emailFixture(t, conn)
		requestCtx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
		defer cancel()
		if err := SendEmail(requestCtx, conn, email.ID, true); err == nil {
			t.Fatal("cancelled acknowledgement reported success")
		}
		waitEmailState(t, conn, email.ID, models.Unknown)
	})
	t.Run("interrupted outcome remains claimed until offline recovery", func(t *testing.T) {
		s := smtpForDelivery(t)
		email := emailFixture(t, conn)
		if err := conn.Exec(`CREATE FUNCTION fail_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.state = 'SENDING' THEN RAISE EXCEPTION 'simulated storage outage'; END IF; RETURN NEW; END $$`).Error; err != nil {
			t.Fatal(err)
		}
		if err := conn.Exec(`CREATE TRIGGER fail_outcome BEFORE UPDATE ON email FOR EACH ROW EXECUTE FUNCTION fail_outcome()`).Error; err != nil {
			t.Fatal(err)
		}
		if err := SendEmail(ctx, conn, email.ID, true); err == nil {
			t.Fatal("storage failure reported success")
		}
		waitEmailState(t, conn, email.ID, models.Sending)
		if err := SendEmail(ctx, conn, email.ID, true); !errors.IsBadRequest(err) {
			t.Fatalf("claimed message can be resent: %v", err)
		}
		if s.received.Load() != 1 {
			t.Fatal("claimed message sent twice")
		}
		if err := conn.Exec(`DROP TRIGGER fail_outcome ON email`).Error; err != nil {
			t.Fatal(err)
		}
		// The sending call has finished: simulate an operator's offline recovery.
		if err := conn.Model(&models.Email{}).Where("id = ? AND state = ?", email.ID, models.Sending).Update("state", models.Unknown).Error; err != nil {
			t.Fatal(err)
		}
		if err := MarkAsError(ctx, conn, email.ID); err != nil {
			t.Fatal(err)
		}
		if err := SendEmail(ctx, conn, email.ID, true); err != nil {
			t.Fatal(err)
		}
	})
	t.Run("invalid template remains visible as an error", func(t *testing.T) {
		smtpForDelivery(t)
		email := emailFixture(t, conn)
		var campaign models.EmailCampaign
		if err := conn.First(&campaign, "id = ?", email.EmailCampaignID).Error; err != nil {
			t.Fatal(err)
		}
		if err := conn.Model(&models.EmailTemplate{}).Where("id = ?", campaign.EmailTemplateID).Update("subject", "{{").Error; err != nil {
			t.Fatal(err)
		}
		if err := SendEmail(ctx, conn, email.ID, true); err == nil {
			t.Fatal("invalid template reported success")
		}
		waitEmailState(t, conn, email.ID, models.Error)
		rows, err := ListEmails(conn, campaign.ID)
		if err != nil || len(rows) != 1 || rows[0].Error == "" {
			t.Fatalf("failed email not visible: %v, %v", rows, err)
		}
	})
}
