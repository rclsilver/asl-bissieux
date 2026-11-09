package auth

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func validGoogleInfos() userInfos {
	return userInfos{IssuedTo: "client", Audience: "client", UserID: "google-subject", ExpiresIn: 3600, Email: "test@example.invalid", VerifiedEmail: true}
}

func TestGoogleTokenValidation(t *testing.T) {
	for _, tc := range []struct {
		name      string
		modify    func(*userInfos)
		wantError bool
	}{
		{"valid", func(*userInfos) {}, false},
		{"wrong audience", func(i *userInfos) { i.Audience = "other" }, true},
		{"wrong issuer client", func(i *userInfos) { i.IssuedTo = "other" }, true},
		{"expired", func(i *userInfos) { i.ExpiresIn = 0 }, true},
		{"unverified email", func(i *userInfos) { i.VerifiedEmail = false }, true},
		{"missing email", func(i *userInfos) { i.Email = "" }, true},
		{"missing identity", func(i *userInfos) { i.UserID = "" }, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			infos := validGoogleInfos()
			tc.modify(&infos)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Query().Get("access_token") != "token with +&?=" {
					t.Error("token was not encoded correctly")
				}
				json.NewEncoder(w).Encode(infos)
			}))
			defer server.Close()
			provider := googleProvider{cfg: googleAuthConfig{ClientID: "client"}, client: server.Client(), endpoint: server.URL}
			result, err := provider.getUserInfos(context.Background(), "token with +&?=")
			if (err != nil) != tc.wantError {
				t.Fatalf("result=%+v, error=%v", result, err)
			}
		})
	}
}

type googleTransport func(*http.Request) (*http.Response, error)

func (f googleTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

type trackedGoogleBody struct {
	io.Reader
	closed bool
}

func (b *trackedGoogleBody) Close() error { b.closed = true; return nil }

func TestGoogleResponseBodyAlwaysClosed(t *testing.T) {
	for _, status := range []int{http.StatusUnauthorized, http.StatusServiceUnavailable, http.StatusOK} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			body := &trackedGoogleBody{Reader: strings.NewReader("invalid JSON")}
			provider := googleProvider{cfg: googleAuthConfig{ClientID: "client"}, client: &http.Client{Transport: googleTransport(func(*http.Request) (*http.Response, error) {
				return &http.Response{StatusCode: status, Body: body, Header: make(http.Header)}, nil
			})}}
			if _, err := provider.getUserInfos(context.Background(), "test-token"); err == nil {
				t.Fatal("invalid response was accepted")
			}
			if !body.closed {
				t.Fatal("HTTP body was not closed")
			}
		})
	}
}

func TestGoogleTimeoutCancellationAndRedaction(t *testing.T) {
	for _, cancelRequest := range []bool{false, true} {
		t.Run(map[bool]string{false: "timeout", true: "request cancellation"}[cancelRequest], func(t *testing.T) {
			started := make(chan struct{})
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { close(started); <-r.Context().Done() }))
			defer server.Close()
			client := server.Client()
			client.Timeout = 50 * time.Millisecond
			provider := googleProvider{cfg: googleAuthConfig{ClientID: "client"}, client: client, endpoint: server.URL}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			if cancelRequest {
				go func() { <-started; cancel() }()
			}
			_, err := provider.getUserInfos(ctx, "NEVER_LOG_THIS_TOKEN")
			if err == nil {
				t.Fatal("expected a cancelled/timed-out request")
			}
			if strings.Contains(err.Error(), "NEVER_LOG_THIS_TOKEN") || strings.Contains(err.Error(), "access_token") {
				t.Fatalf("token-bearing URL leaked: %v", err)
			}
			if cancelRequest && !errors.Is(err, context.Canceled) {
				t.Fatalf("cancellation cause lost: %v", err)
			}
			if !cancelRequest && !errors.Is(err, context.DeadlineExceeded) {
				t.Fatalf("timeout cause lost: %v", err)
			}
		})
	}
}

func TestGoogleMalformedAuthorizationHeader(t *testing.T) {
	provider := googleProvider{}
	for _, header := range []string{"Basic token", "Bearer", "Bearer one two"} {
		request := httptest.NewRequest("GET", "/", nil)
		request.Header.Set("Authorization", header)
		if _, err := provider.Authenticate(request); err == nil {
			t.Fatalf("accepted malformed header %q", header)
		}
	}
}

func TestGoogleRedirectIsNotFollowed(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("token validation followed an unexpected redirect")
	}))
	defer target.Close()
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusFound)
	}))
	defer source.Close()
	provider := googleProvider{cfg: googleAuthConfig{ClientID: "client"}, endpoint: source.URL}
	if _, err := provider.getUserInfos(context.Background(), "test-token"); err == nil {
		t.Fatal("redirect was accepted as token validation")
	}
}
