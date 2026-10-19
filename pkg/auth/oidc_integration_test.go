package auth_test

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/juju/errors"
	"github.com/lib/pq"
	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/config"
	"gorm.io/gorm"
)

type testIssuer struct {
	server           *httptest.Server
	key              *rsa.PrivateKey
	nonce, challenge string
	claims           map[string]interface{}
	exchanges        atomic.Int32
	wrongSignature   bool
}

func newTestIssuer(t *testing.T) *testIssuer {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	f := &testIssuer{key: key}
	f.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			json.NewEncoder(w).Encode(map[string]interface{}{
				"issuer": f.server.URL, "authorization_endpoint": f.server.URL + "/authorize",
				"token_endpoint": f.server.URL + "/token", "jwks_uri": f.server.URL + "/keys",
				"end_session_endpoint": f.server.URL + "/logout", "id_token_signing_alg_values_supported": []string{"RS256"},
			})
		case "/keys":
			json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &f.key.PublicKey, KeyID: "test-key", Algorithm: "RS256", Use: "sig"}}})
		case "/token":
			f.exchanges.Add(1)
			if r.Method != http.MethodPost {
				t.Error("code exchange must use POST")
			}
			r.ParseForm()
			client, secret, _ := r.BasicAuth()
			if client == "" {
				client, secret = r.Form.Get("client_id"), r.Form.Get("client_secret")
			}
			digest := sha256.Sum256([]byte(r.Form.Get("code_verifier")))
			if client != "asl-test" || secret != "test-server-secret" || r.Form.Get("grant_type") != "authorization_code" ||
				r.Form.Get("redirect_uri") != "https://app.example/api/auth/callback" ||
				base64.RawURLEncoding.EncodeToString(digest[:]) != f.challenge {
				http.Error(w, `{"error":"invalid_grant"}`, http.StatusBadRequest)
				return
			}
			claims := map[string]interface{}{"iss": f.server.URL, "aud": "asl-test", "sub": "subject-test",
				"exp": time.Now().Add(time.Hour).Unix(), "iat": time.Now().Unix(), "nonce": f.nonce,
				"email": "new@example.invalid", "email_verified": true}
			for k, v := range f.claims {
				claims[k] = v
			}
			key := f.key
			if f.wrongSignature {
				key, _ = rsa.GenerateKey(rand.Reader, 2048)
			}
			signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: key}, (&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", "test-key"))
			if err != nil {
				t.Error(err)
				return
			}
			token, err := jwt.Signed(signer).Claims(claims).Serialize()
			if err != nil {
				t.Error(err)
				return
			}
			json.NewEncoder(w).Encode(map[string]interface{}{"id_token": token, "access_token": "not-an-application-session", "token_type": "Bearer", "expires_in": 3600})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(f.server.Close)
	return f
}

func oidcFixture(t *testing.T) (auth.BrowserAuthProvider, *testIssuer, *gorm.DB) {
	t.Helper()
	conn, _ := testdb.Open(t)
	f := newTestIssuer(t)
	secret := filepath.Join(t.TempDir(), "client-secret")
	if err := os.WriteFile(secret, []byte("test-server-secret"), 0600); err != nil {
		t.Fatal(err)
	}
	for key, value := range map[string]string{
		"APP_AUTH_PROVIDER": "oidc", "APP_AUTH_CREATE_USER": "true",
		"APP_AUTH_OIDC_ISSUER": f.server.URL, "APP_AUTH_OIDC_CLIENT_ID": "asl-test",
		"APP_AUTH_OIDC_CLIENT_SECRET_FILE": secret, "APP_AUTH_OIDC_PUBLIC_URL": "https://app.example",
		"APP_AUTH_OIDC_BACKCHANNEL_URL": "", "APP_AUTH_OIDC_ALLOW_INSECURE_HTTP": "true",
		"APP_AUTH_OIDC_SESSION_DURATION": "8h",
	} {
		t.Setenv(key, value)
	}
	if err := config.Load(); err != nil {
		t.Fatal(err)
	}
	provider, err := auth.GetProvider()
	if err != nil {
		t.Fatal(err)
	}
	return provider.(auth.BrowserAuthProvider), f, conn
}

func begin(t *testing.T, p auth.BrowserAuthProvider, f *testIssuer) (*http.Cookie, string) {
	t.Helper()
	w := httptest.NewRecorder()
	p.Login(w, httptest.NewRequest("GET", "https://app.example/api/auth/login?return_to=%2Fbudgets", nil))
	if w.Code != http.StatusFound {
		t.Fatalf("login status %d", w.Code)
	}
	u, err := url.Parse(w.Header().Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	if q.Get("response_type") != "code" || q.Get("code_challenge_method") != "S256" || q.Get("nonce") == "" {
		t.Fatalf("missing code/PKCE/nonce parameters: %v", q)
	}
	f.nonce, f.challenge = q.Get("nonce"), q.Get("code_challenge")
	var binding *http.Cookie
	for _, cookie := range w.Result().Cookies() {
		if cookie.Name == "asl_oidc_binding" {
			binding = cookie
		}
	}
	if binding == nil || !binding.HttpOnly || !binding.Secure {
		t.Fatal("missing protected browser binding")
	}
	return binding, q.Get("state")
}

func callback(p auth.BrowserAuthProvider, binding *http.Cookie, state string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "https://app.example/api/auth/callback?code=one-time-code&state="+url.QueryEscape(state), nil)
	r.AddCookie(binding)
	p.Callback(w, r)
	return w
}

func sessionCookies(t *testing.T, w *httptest.ResponseRecorder) (*http.Cookie, *http.Cookie) {
	t.Helper()
	var session, csrf *http.Cookie
	for _, c := range w.Result().Cookies() {
		if c.Name == "asl_session" {
			session = c
		}
		if c.Name == "XSRF-TOKEN" {
			csrf = c
		}
	}
	if session == nil || csrf == nil {
		t.Fatalf("no session after callback, location=%s", w.Header().Get("Location"))
	}
	if !session.HttpOnly || !session.Secure || session.SameSite != http.SameSiteLaxMode || csrf.HttpOnly {
		t.Fatal("incorrect session/CSRF cookie protections")
	}
	return session, csrf
}

func TestOIDCSessionIntegration(t *testing.T) {
	p, f, conn := oidcFixture(t)
	binding, state := begin(t, p, f)
	w := callback(p, binding, state)
	if w.Header().Get("Location") != "https://app.example/budgets" {
		t.Fatal("lost return route")
	}
	session, csrf := sessionCookies(t, w)
	r := httptest.NewRequest("GET", "https://app.example/api/auth/me", nil)
	r.AddCookie(session)
	user, err := p.Authenticate(r)
	if err != nil || user == nil || user.Enabled || user.Admin || len(user.Actions) != 0 {
		t.Fatalf("new account must be inactive: %+v %v", user, err)
	}
	var stored struct{ TokenHash, CSRFHash string }
	if err := conn.Table("auth_session").First(&stored).Error; err != nil {
		t.Fatal(err)
	}
	hash := sha256.Sum256([]byte(session.Value))
	if stored.TokenHash != hex.EncodeToString(hash[:]) || stored.CSRFHash == csrf.Value {
		t.Fatal("raw session/CSRF tokens were persisted")
	}
	// Authentication and rights are looked up for every request, not copied from ID token roles.
	if err := conn.Model(&auth.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{"enabled": true, "actions": pq.StringArray{"budget.CreatePayment"}}).Error; err != nil {
		t.Fatal(err)
	}
	user, err = p.Authenticate(r)
	if err != nil || !user.Allowed("budget.CreatePayment") || user.Allowed("budget.DeletePayment") {
		t.Fatalf("internal permissions lost: %v", err)
	}
	conn.Model(&auth.User{}).Where("id = ?", user.ID).Update("enabled", false)
	user, _ = p.Authenticate(r)
	if user.Allowed("budget.CreatePayment") {
		t.Fatal("disabled account retained rights")
	}
	// Authorization response is consumed exactly once.
	if again := callback(p, binding, state); !strings.Contains(again.Header().Get("Location"), "auth_error=") || f.exchanges.Load() != 1 {
		t.Fatal("authorization response was replayed")
	}
	// CSRF checks apply to writes, including logout; no bearer token fallback.
	write := httptest.NewRequest("POST", "https://app.example/api/auth/logout", nil)
	write.AddCookie(session)
	if _, err := p.Authenticate(write); !errors.IsForbidden(err) {
		t.Fatalf("missing CSRF accepted: %v", err)
	}
	write.AddCookie(csrf)
	write.Header.Set("X-XSRF-TOKEN", csrf.Value)
	write.Header.Set("Origin", "https://attacker.example")
	if _, err := p.Authenticate(write); !errors.IsForbidden(err) {
		t.Fatalf("foreign origin accepted: %v", err)
	}
	write.Header.Set("Origin", "https://app.example")
	logout := httptest.NewRecorder()
	redirect, err := p.Logout(logout, write)
	if err != nil || !strings.HasPrefix(redirect, f.server.URL+"/logout?") || strings.Contains(redirect, "id_token") {
		t.Fatalf("logout failed: %s %v", redirect, err)
	}
	if user, err := p.Authenticate(r); err != nil || user != nil {
		t.Fatalf("revoked session accepted: %v", err)
	}
	r = httptest.NewRequest("GET", "https://app.example/api/auth/me", nil)
	r.Header.Set("Authorization", "Bearer not-an-application-session")
	if user, err := p.Authenticate(r); err != nil || user != nil {
		t.Fatal("bearer access token accepted as session")
	}
}

func TestOIDCRejectsInvalidTokensIntegration(t *testing.T) {
	for _, tc := range []struct {
		name, claim  string
		value        interface{}
		badSignature bool
	}{
		{"wrong issuer", "iss", "https://another-issuer.example", false},
		{"wrong audience", "aud", "another-client", false},
		{"expired", "exp", time.Now().Add(-time.Hour).Unix(), false},
		{"wrong nonce", "nonce", "another-nonce", false},
		{"wrong authorized party", "azp", "another-client", false},
		{"multiple audiences without authorized party", "aud", []string{"asl-test", "another-client"}, false},
		{"untrusted signature", "", "", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			p, f, conn := oidcFixture(t)
			binding, state := begin(t, p, f)
			f.claims = map[string]interface{}{tc.claim: tc.value}
			f.wrongSignature = tc.badSignature
			w := callback(p, binding, state)
			if !strings.Contains(w.Header().Get("Location"), "auth_error=") {
				t.Fatal("invalid token accepted")
			}
			var count int64
			conn.Table("auth_session").Count(&count)
			if count != 0 {
				t.Fatal("session created for invalid token")
			}
		})
	}
}

func TestOIDCBrowserBindingAndExpirationIntegration(t *testing.T) {
	p, f, conn := oidcFixture(t)
	binding, state := begin(t, p, f)
	wrong := *binding
	wrong.Value = strings.Repeat("x", 43)
	callback(p, &wrong, state)
	callback(p, binding, strings.Repeat("x", 43))
	if f.exchanges.Load() != 0 {
		t.Fatal("code exchanged without matching browser/state")
	}
	conn.Table("auth_login_attempt").Where("issuer = ?", f.server.URL).Update("expires_at", time.Now().Add(-time.Minute))
	callback(p, binding, state)
	if f.exchanges.Load() != 0 {
		t.Fatal("expired login attempt accepted")
	}
	binding, state = begin(t, p, f)
	session, _ := sessionCookies(t, callback(p, binding, state))
	conn.Table("auth_session").Where("issuer = ?", f.server.URL).Update("expires_at", time.Now().Add(-time.Minute))
	r := httptest.NewRequest("GET", "https://app.example/api/auth/me", nil)
	r.AddCookie(session)
	if user, err := p.Authenticate(r); user != nil || err != nil {
		t.Fatal("expired session accepted")
	}
}

func TestOIDCExplicitIdentityMigrationIntegration(t *testing.T) {
	p, f, conn := oidcFixture(t)
	existing := auth.NewUser("new@example.invalid", true, true, []string{"budget.CreatePayment"})
	if err := conn.Create(existing).Error; err != nil {
		t.Fatal(err)
	}
	binding, state := begin(t, p, f)
	if w := callback(p, binding, state); !strings.Contains(w.Header().Get("Location"), "auth_error=") {
		t.Fatal("existing account silently linked by email")
	}
	if err := auth.LinkIdentity(t.Context(), f.server.URL, "subject-test", existing.ID); err != nil {
		t.Fatal(err)
	}
	binding, state = begin(t, p, f)
	// Stable issuer/subject survives a provider email change without changing local account ID.
	f.claims = map[string]interface{}{"email": "changed@example.invalid"}
	session, _ := sessionCookies(t, callback(p, binding, state))
	r := httptest.NewRequest("GET", "https://app.example/api/auth/me", nil)
	r.AddCookie(session)
	user, err := p.Authenticate(r)
	if err != nil || user.ID != existing.ID || !user.Admin || !user.Enabled || user.Username != existing.Username {
		t.Fatalf("existing account changed: %+v %v", user, err)
	}
	other := auth.NewUser("other@example.invalid", true, false, nil)
	conn.Create(other)
	if err := auth.LinkIdentity(t.Context(), f.server.URL, "subject-test", other.ID); err == nil {
		t.Fatal("identity moved to another account")
	}
	var count int64
	conn.Table("auth_identity").Count(&count)
	if count != 1 {
		t.Fatal("identity duplicated")
	}
}

func TestOIDCCallbackReservationIsAtomicIntegration(t *testing.T) {
	p, f, conn := oidcFixture(t)
	binding, state := begin(t, p, f)
	results := make(chan *httptest.ResponseRecorder, 2)
	for i := 0; i < 2; i++ {
		go func() { results <- callback(p, binding, state) }()
	}
	successes := 0
	for i := 0; i < 2; i++ {
		if result := <-results; result.Header().Get("Location") == "https://app.example/budgets" {
			successes++
		}
	}
	var count int64
	conn.Table("auth_session").Count(&count)
	if successes != 1 || f.exchanges.Load() != 1 || count != 1 {
		t.Fatalf("callback reused: %d successes, %d exchanges, %d sessions", successes, f.exchanges.Load(), count)
	}
}
