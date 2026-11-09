package auth

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/rclsilver/asl-bissieux/pkg/config"
	"golang.org/x/oauth2"
)

const OIDC Provider = "oidc"

type oidcConfig struct {
	Issuer            string
	ClientID          string `mapstructure:"client_id"`
	ClientSecretFile  string `mapstructure:"client_secret_file"`
	PublicURL         string `mapstructure:"public_url"`
	BackchannelURL    string `mapstructure:"backchannel_url"`
	Label             string
	SessionDuration   time.Duration `mapstructure:"session_duration"`
	AllowInsecureHTTP bool          `mapstructure:"allow_insecure_http"`
}

func (c *oidcConfig) SetDefaults() {
	c.Label = "Se connecter"
	c.SessionDuration = 8 * time.Hour
}

type oidcProvider struct {
	cfg           oidcConfig
	oauth         oauth2.Config
	verifier      *oidc.IDTokenVerifier
	client        *http.Client
	endSessionURL string
}

type PublicAuthConfig struct {
	Mode     string `json:"mode"`
	Label    string `json:"label"`
	LoginURL string `json:"login_url,omitempty"`
}

type BrowserAuthProvider interface {
	AuthProvider
	PublicConfig() PublicAuthConfig
	Login(http.ResponseWriter, *http.Request)
	Callback(http.ResponseWriter, *http.Request)
	Logout(http.ResponseWriter, *http.Request) (string, error)
}

func init() {
	var provider oidcProvider
	config.RegisterSection("auth_oidc", &provider.cfg)
	registerProvider(OIDC, &provider)
}

func (p *oidcProvider) PublicConfig() PublicAuthConfig {
	return PublicAuthConfig{Mode: "oidc", Label: p.cfg.Label, LoginURL: "/api/auth/login"}
}

func configURL(value string, insecure bool) (*url.URL, error) {
	u, err := url.Parse(value)
	if err != nil || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" ||
		(u.Scheme != "https" && !(insecure && u.Scheme == "http")) {
		return nil, fmt.Errorf("expected an absolute HTTPS URL (HTTP requires explicit development configuration)")
	}
	return u, nil
}

func (p *oidcProvider) validate() error {
	issuer, err := configURL(p.cfg.Issuer, p.cfg.AllowInsecureHTTP)
	if err != nil {
		return fmt.Errorf("invalid OIDC issuer: %w", err)
	}
	public, err := configURL(p.cfg.PublicURL, p.cfg.AllowInsecureHTTP)
	if err != nil || (public != nil && public.Path != "" && public.Path != "/") {
		return fmt.Errorf("invalid public application URL")
	}
	p.cfg.PublicURL = strings.TrimSuffix(p.cfg.PublicURL, "/")
	if p.cfg.ClientID == "" || p.cfg.SessionDuration <= 0 || p.cfg.SessionDuration > 24*time.Hour {
		return fmt.Errorf("OIDC requires a client ID and a session duration between zero and 24 hours")
	}
	secret := ""
	if p.cfg.ClientSecretFile != "" {
		content, err := os.ReadFile(p.cfg.ClientSecretFile)
		if err != nil {
			return fmt.Errorf("unable to read OIDC client secret file")
		}
		secret = strings.TrimSpace(string(content))
		if secret == "" {
			return fmt.Errorf("empty OIDC client secret file")
		}
	}
	if issuer.Hostname() == "accounts.google.com" && secret == "" {
		return fmt.Errorf("Google OIDC requires a server-side client secret file")
	}
	transport := http.RoundTripper(http.DefaultTransport)
	if p.cfg.BackchannelURL != "" {
		internal, err := configURL(p.cfg.BackchannelURL, p.cfg.AllowInsecureHTTP)
		if err != nil || (internal != nil && internal.Path != "" && internal.Path != "/") {
			return fmt.Errorf("invalid OIDC backchannel URL")
		}
		transport = issuerTransport{public: issuer, internal: internal, base: transport}
	}
	p.client = &http.Client{Timeout: 10 * time.Second, Transport: transport, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	provider, err := oidc.NewProvider(oidc.ClientContext(ctx, p.client), p.cfg.Issuer)
	if err != nil {
		return fmt.Errorf("OIDC discovery failed; check issuer and connectivity")
	}
	var metadata struct {
		EndSessionURL string `json:"end_session_endpoint"`
		JWKSURL       string `json:"jwks_uri"`
	}
	if err := provider.Claims(&metadata); err != nil {
		return fmt.Errorf("invalid OIDC discovery metadata")
	}
	endpoints := provider.Endpoint()
	for _, endpoint := range []string{endpoints.AuthURL, endpoints.TokenURL, metadata.JWKSURL, metadata.EndSessionURL} {
		if endpoint != "" {
			if _, err := configURL(endpoint, p.cfg.AllowInsecureHTTP); err != nil {
				return fmt.Errorf("invalid OIDC endpoint")
			}
		}
	}
	p.endSessionURL = metadata.EndSessionURL
	p.oauth = oauth2.Config{ClientID: p.cfg.ClientID, ClientSecret: secret, RedirectURL: p.cfg.PublicURL + "/api/auth/callback", Endpoint: endpoints, Scopes: []string{oidc.ScopeOpenID, "profile", "email"}}
	p.verifier = provider.Verifier(&oidc.Config{ClientID: p.cfg.ClientID, SupportedSigningAlgs: []string{oidc.RS256, oidc.ES256}})
	return nil
}

// Rewrite only the configured issuer origin for Docker backchannel traffic.
// Discovery and JWT issuer validation still use the canonical public issuer.
type issuerTransport struct {
	public, internal *url.URL
	base             http.RoundTripper
}

func (t issuerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	copy := req.Clone(req.Context())
	if copy.URL.Scheme == t.public.Scheme && copy.URL.Host == t.public.Host {
		u := *copy.URL
		u.Scheme, u.Host = t.internal.Scheme, t.internal.Host
		copy.URL = &u
		copy.Host = ""
	}
	return t.base.RoundTrip(copy)
}
