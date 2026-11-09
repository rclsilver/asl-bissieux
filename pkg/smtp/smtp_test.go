package smtp

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net"
	"net/mail"
	"net/textproto"
	"strings"
	"testing"
	"time"
)

func TestSendWithSimulatedSMTP(t *testing.T) {
	for _, reject := range []bool{false, true} {
		t.Run(fmt.Sprintf("recipient_rejected=%t", reject), func(t *testing.T) {
			listener, err := net.Listen("tcp", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			defer listener.Close()
			previous := cfg
			defer func() { cfg = previous }()
			cfg = smtpConfig{Host: "127.0.0.1", Port: listener.Addr().(*net.TCPAddr).Port, Template: "{{.message}}"}
			cfg.From.Address = "sender@example.invalid"
			cfg.ReplyTo.Address = cfg.From.Address
			type delivery struct {
				from, to, body string
				err            error
			}
			result := make(chan delivery, 1)
			go func() {
				var received delivery
				defer func() { result <- received }()
				client, err := listener.Accept()
				if err != nil {
					received.err = err
					return
				}
				defer client.Close()
				client.SetDeadline(time.Now().Add(5 * time.Second))
				fmt.Fprint(client, "220 localhost test SMTP\r\n")
				reader := bufio.NewReader(client)
				for {
					line, err := reader.ReadString('\n')
					if err != nil {
						received.err = err
						return
					}
					switch {
					case strings.HasPrefix(line, "EHLO"), strings.HasPrefix(line, "HELO"):
						fmt.Fprint(client, "250 localhost\r\n")
					case strings.HasPrefix(line, "MAIL FROM:"):
						received.from = strings.TrimSpace(line)
						fmt.Fprint(client, "250 OK\r\n")
					case strings.HasPrefix(line, "RCPT TO:"):
						received.to = strings.TrimSpace(line)
						if reject {
							fmt.Fprint(client, "550 test rejection\r\n")
							return
						}
						fmt.Fprint(client, "250 OK\r\n")
					case strings.TrimSpace(line) == "DATA":
						fmt.Fprint(client, "354 send message\r\n")
						body, err := textproto.NewReader(reader).ReadDotBytes()
						received.body, received.err = string(body), err
						fmt.Fprint(client, "250 accepted\r\n")
						return
					default:
						received.err = fmt.Errorf("unexpected SMTP command: %s", line)
						return
					}
				}
			}()
			err = Send(context.Background(), "recipient@example.invalid", "Test subject", "Test body", "")
			if (err != nil) != reject {
				t.Fatalf("Send error = %v, want rejected=%t", err, reject)
			}
			select {
			case received := <-result:
				if received.err != nil {
					t.Fatal(received.err)
				}
				if received.from != "MAIL FROM:<sender@example.invalid>" || received.to != "RCPT TO:<recipient@example.invalid>" {
					t.Fatalf("unexpected envelope: %+v", received)
				}
				if !reject {
					message, err := mail.ReadMessage(strings.NewReader(received.body))
					if err != nil {
						t.Fatal(err)
					}
					subject, err := new(mime.WordDecoder).DecodeHeader(message.Header.Get("Subject"))
					if err != nil || subject != "Test subject" {
						t.Fatalf("invalid delivered subject: %q, %v", subject, err)
					}
					_, params, err := mime.ParseMediaType(message.Header.Get("Content-Type"))
					if err != nil {
						t.Fatal(err)
					}
					part, err := multipart.NewReader(message.Body, params["boundary"]).NextPart()
					if err != nil {
						t.Fatal(err)
					}
					body, err := io.ReadAll(part)
					if err != nil || !strings.Contains(string(body), "Test body") {
						t.Fatalf("invalid delivered body: %q, %v", body, err)
					}
				}
			case <-time.After(6 * time.Second):
				t.Fatal("simulated SMTP did not finish")
			}
		})
	}
}
