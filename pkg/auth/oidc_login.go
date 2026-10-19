package auth

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
	"gorm.io/gorm"
)

type loginAttempt struct {
	StateHash   string `gorm:"primaryKey"`
	BindingHash string
	NonceHash   string
	Issuer      string
	Verifier    string
	ReturnPath  string
	ExpiresAt   time.Time
}

func (loginAttempt) TableName() string { return "auth_login_attempt" }

func safeReturnPath(value string) string {
	u, err := url.Parse(value)
	if err != nil || !strings.HasPrefix(value, "/") || strings.HasPrefix(value, "//") || strings.Contains(value, "\\") || u.IsAbs() || u.Host != "" || strings.HasPrefix(u.Path, "/api/") {
		return "/"
	}
	return u.String()
}

func (p *oidcProvider) Login(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	state, err1 := randomToken()
	binding, err2 := randomToken()
	nonce, err3 := randomToken()
	verifier, err4 := randomToken()
	if err1 != nil || err2 != nil || err3 != nil || err4 != nil {
		http.Error(w, "unable to begin sign-in", http.StatusInternalServerError)
		return
	}
	expires := time.Now().Add(10 * time.Minute)
	attempt := loginAttempt{StateHash: tokenHash(state), BindingHash: tokenHash(binding), NonceHash: tokenHash(nonce),
		Issuer: p.cfg.Issuer, Verifier: verifier, ReturnPath: safeReturnPath(r.URL.Query().Get("return_to")), ExpiresAt: expires}
	conn := authDB(r.Context())
	if err := conn.Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&loginAttempt{}, "expires_at < ?", time.Now()).Error; err != nil {
			return err
		}
		if err := tx.Delete(&browserSession{}, "expires_at < ?", time.Now()).Error; err != nil {
			return err
		}
		return tx.Create(&attempt).Error
	}); err != nil {
		http.Error(w, "unable to begin sign-in", http.StatusServiceUnavailable)
		return
	}
	p.setCookie(w, bindingCookie, binding, expires, true)
	http.Redirect(w, r, p.oauth.AuthCodeURL(state, oidc.Nonce(nonce), oauth2.S256ChallengeOption(verifier)), http.StatusFound)
}

func (p *oidcProvider) Callback(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	fail := func() { http.Redirect(w, r, p.cfg.PublicURL+"/?auth_error=sign_in_failed", http.StatusSeeOther) }
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	state := r.URL.Query().Get("state")
	binding, err := r.Cookie(bindingCookie)
	if err != nil || len(binding.Value) != 43 || len(state) != 43 {
		fail()
		return
	}
	p.setCookie(w, bindingCookie, "", time.Unix(1, 0), true)
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	var attempt loginAttempt
	result := authDB(ctx).Raw(`DELETE FROM public.auth_login_attempt WHERE state_hash = ? AND binding_hash = ? AND issuer = ? AND expires_at > ? RETURNING *`, tokenHash(state), tokenHash(binding.Value), p.cfg.Issuer, time.Now()).Scan(&attempt)
	if result.Error != nil || result.RowsAffected != 1 || r.URL.Query().Get("error") != "" || r.URL.Query().Get("code") == "" {
		fail()
		return
	}
	ctx = oidc.ClientContext(ctx, p.client)
	token, err := p.oauth.Exchange(ctx, r.URL.Query().Get("code"), oauth2.VerifierOption(attempt.Verifier))
	if err != nil {
		fail()
		return
	}
	raw, ok := token.Extra("id_token").(string)
	if !ok {
		fail()
		return
	}
	idToken, err := p.verifier.Verify(ctx, raw)
	if err != nil {
		fail()
		return
	}
	var claims struct {
		Nonce           string `json:"nonce"`
		Email           string `json:"email"`
		EmailVerified   bool   `json:"email_verified"`
		AuthorizedParty string `json:"azp"`
	}
	if err := idToken.Claims(&claims); err != nil || idToken.Subject == "" || !sameHash(tokenHash(claims.Nonce), attempt.NonceHash) ||
		(claims.AuthorizedParty != "" && claims.AuthorizedParty != p.cfg.ClientID) || (len(idToken.Audience) > 1 && claims.AuthorizedParty != p.cfg.ClientID) {
		fail()
		return
	}
	// Email is a display/login label, never the key used to resolve an existing identity.
	username := claims.Email
	if username == "" || !claims.EmailVerified {
		username = "oidc:" + tokenHash(p.cfg.Issuer+":"+idToken.Subject)
	}
	user, err := resolveIdentity(ctx, p.cfg.Issuer, idToken.Subject, username)
	if err != nil {
		fail()
		return
	}
	sessionToken, err1 := randomToken()
	csrf, err2 := randomToken()
	if err1 != nil || err2 != nil {
		fail()
		return
	}
	expires := time.Now().Add(p.cfg.SessionDuration)
	err = authDB(ctx).Transaction(func(tx *gorm.DB) error {
		// A successful sign-in rotates and revokes the previous application session.
		if old, err := r.Cookie(sessionCookie); err == nil && len(old.Value) == 43 {
			if err := tx.Delete(&browserSession{}, "token_hash = ?", tokenHash(old.Value)).Error; err != nil {
				return err
			}
		}
		return tx.Create(&browserSession{TokenHash: tokenHash(sessionToken), CSRFHash: tokenHash(csrf), Issuer: p.cfg.Issuer, Subject: idToken.Subject, UserID: user.ID, ExpiresAt: expires}).Error
	})
	if err != nil {
		fail()
		return
	}
	p.setCookie(w, sessionCookie, sessionToken, expires, true)
	p.setCookie(w, csrfCookie, csrf, expires, false)
	http.Redirect(w, r, p.cfg.PublicURL+safeReturnPath(attempt.ReturnPath), http.StatusSeeOther)
}
