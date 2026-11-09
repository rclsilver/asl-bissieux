package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/juju/errors"
	"gorm.io/gorm"
)

const sessionCookie = "asl_session"
const bindingCookie = "asl_oidc_binding"
const csrfCookie = "XSRF-TOKEN"

type browserSession struct {
	TokenHash string `gorm:"primaryKey"`
	CSRFHash  string
	Issuer    string
	Subject   string
	UserID    string
	ExpiresAt time.Time
}

func (browserSession) TableName() string { return "auth_session" }

func randomToken() (string, error) {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}
func tokenHash(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}
func sameHash(a, b string) bool { return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1 }

func (p *oidcProvider) setCookie(w http.ResponseWriter, name, value string, expiry time.Time, httpOnly bool) {
	maxAge := int(time.Until(expiry).Seconds())
	if maxAge < 1 {
		maxAge = -1
	}
	http.SetCookie(w, &http.Cookie{Name: name, Value: value, Path: "/", HttpOnly: httpOnly,
		Secure: strings.HasPrefix(p.cfg.PublicURL, "https://"), SameSite: http.SameSiteLaxMode, Expires: expiry, MaxAge: maxAge})
}
func (p *oidcProvider) clearSession(w http.ResponseWriter) {
	p.setCookie(w, sessionCookie, "", time.Unix(1, 0), true)
	p.setCookie(w, csrfCookie, "", time.Unix(1, 0), false)
}

func (p *oidcProvider) Authenticate(r *http.Request) (*User, error) {
	// Browser sessions never accept Google access tokens or arbitrary bearer JWTs.
	cookie, err := r.Cookie(sessionCookie)
	if err != nil || len(cookie.Value) != 43 {
		return nil, nil
	}
	var session browserSession
	err = authDB(r.Context()).First(&session, "token_hash = ? AND issuer = ? AND expires_at > ?", tokenHash(cookie.Value), p.cfg.Issuer, time.Now()).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, errors.NewUnauthorized(nil, "unable to verify session")
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodOptions {
		origin := r.Header.Get("Origin")
		if origin == "" {
			if ref, err := url.Parse(r.Referer()); err == nil && ref.Host != "" {
				origin = ref.Scheme + "://" + ref.Host
			}
		}
		csrf, _ := r.Cookie(csrfCookie)
		if origin != p.cfg.PublicURL || csrf == nil || len(csrf.Value) != 43 ||
			!sameHash(tokenHash(r.Header.Get("X-XSRF-TOKEN")), session.CSRFHash) ||
			!sameHash(tokenHash(csrf.Value), session.CSRFHash) {
			return nil, errors.NewForbidden(nil, "invalid request origin or CSRF token")
		}
	}
	var user User
	if err := authDB(r.Context()).First(&user, "id = ?", session.UserID).Error; err != nil {
		return nil, errors.NewUnauthorized(nil, "account is unavailable")
	}
	return &user, nil
}

func (p *oidcProvider) Logout(w http.ResponseWriter, r *http.Request) (string, error) {
	if r.Method != http.MethodPost {
		return "", fmt.Errorf("logout requires POST")
	}
	user, err := p.Authenticate(r)
	if err != nil {
		return "", err
	}
	if user == nil {
		return "", errors.NewUnauthorized(nil, "not authenticated")
	}
	cookie, _ := r.Cookie(sessionCookie)
	if err := authDB(r.Context()).Delete(&browserSession{}, "token_hash = ?", tokenHash(cookie.Value)).Error; err != nil {
		return "", fmt.Errorf("unable to end session")
	}
	p.clearSession(w)
	if p.endSessionURL == "" {
		return p.cfg.PublicURL + "/", nil
	}
	u, _ := url.Parse(p.endSessionURL)
	query := u.Query()
	query.Set("client_id", p.cfg.ClientID)
	query.Set("post_logout_redirect_uri", p.cfg.PublicURL+"/")
	u.RawQuery = query.Encode()
	return u.String(), nil
}
