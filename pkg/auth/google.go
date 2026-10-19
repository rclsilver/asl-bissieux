package auth

import (
	"context"
	"encoding/json"
	stderrors "errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/juju/errors"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/rclsilver/asl-bissieux/pkg/config"
	"github.com/rclsilver/asl-bissieux/pkg/db"
)

const (
	Google Provider = "google"
)

type googleAuthConfig struct {
	ClientID string `mapstructure:"client_id"`
}

func (c *googleAuthConfig) SetDefaults() {}

type googleProvider struct {
	cfg      googleAuthConfig
	client   *http.Client
	endpoint string
}

var googleHTTPClient = &http.Client{
	Timeout:       5 * time.Second,
	CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse },
}

func (p *googleProvider) validate() error {
	if p.cfg.ClientID == "" {
		return fmt.Errorf("client id not set")
	}
	return nil
}

func init() {
	var provider googleProvider

	config.RegisterSection("auth_google", &provider.cfg)
	registerProvider(Google, &provider)
}

type userInfos struct {
	IssuedTo      string `json:"issued_to"`
	Audience      string `json:"audience"`
	UserID        string `json:"user_id"`
	Scope         string `json:"scope"`
	ExpiresIn     int    `json:"expires_in"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	AccessType    string `json:"access_type"`
}

func (p *googleProvider) Authenticate(r *http.Request) (*User, error) {
	logger := logrus.WithContext(r.Context())

	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, nil
	}

	authHeaderParts := strings.Fields(authHeader)
	if len(authHeaderParts) != 2 || !strings.EqualFold(authHeaderParts[0], "Bearer") {
		return nil, errors.NewBadRequest(nil, "invalid authorization header")
	}

	userInfos, err := p.getUserInfos(r.Context(), authHeaderParts[1])
	if err != nil {
		return nil, errors.NewUnauthorized(err, "unable to verify token")
	}

	db := db.Connection(r.Context())

	var userRow User
	if err := db.Where("username = ?", userInfos.Email).First(&userRow).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			logger.WithError(err).Error("error while fetching user")
			return nil, errors.NewUnauthorized(err, "unable to fetch user")
		}

		if !cfg.CreateUser {
			logger.WithError(err).Error("error while creating user")
			return nil, errors.NewUserNotFound(nil, "user not found")
		}

		userRow.Username = userInfos.Email

		if err := db.Create(&userRow).Error; err != nil {
			logger.WithError(err).Error("error while creating user")
			return nil, errors.NewUnauthorized(err, "unable to create user")
		}

		logger.Infof("created new user %s", userRow.Username)
	}

	return &userRow, nil
}

func (p *googleProvider) getUserInfos(ctx context.Context, accessToken string) (*userInfos, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	endpoint := p.endpoint
	if endpoint == "" {
		endpoint = "https://www.googleapis.com/oauth2/v1/tokeninfo"
	}
	endpointURL, err := url.Parse(endpoint)
	if err != nil {
		return nil, fmt.Errorf("invalid token validation endpoint")
	}
	query := endpointURL.Query()
	query.Set("access_token", accessToken)
	endpointURL.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, "GET", endpointURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("unable to build request: %s", err)
	}

	req.Header.Add("Accept", "application/json")

	client := p.client
	if client == nil {
		client = googleHTTPClient
	}
	res, err := client.Do(req)
	if err != nil {
		// http.Client wraps transport errors with the URL, which contains the
		// bearer token. Keep the cause, never the token-bearing URL.
		var requestErr *url.Error
		if stderrors.As(err, &requestErr) {
			err = requestErr.Err
		}
		if ctx.Err() != nil {
			err = ctx.Err()
		} else {
			var timeoutErr interface{ Timeout() bool }
			if stderrors.As(err, &timeoutErr) && timeoutErr.Timeout() {
				err = context.DeadlineExceeded
			}
		}
		return nil, fmt.Errorf("token validation request failed: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bad status code: %d", res.StatusCode)
	}

	var userInfos userInfos

	if err := json.NewDecoder(io.LimitReader(res.Body, 64<<10)).Decode(&userInfos); err != nil {
		return nil, fmt.Errorf("unable to unmarshal body: %s", err)
	}

	if userInfos.Audience != p.cfg.ClientID {
		return nil, fmt.Errorf("not the expected audience")
	}

	if userInfos.IssuedTo != p.cfg.ClientID {
		return nil, fmt.Errorf("not the expected issued to")
	}
	if userInfos.ExpiresIn <= 0 {
		return nil, fmt.Errorf("token is expired")
	}
	if userInfos.UserID == "" || userInfos.Email == "" || !userInfos.VerifiedEmail {
		return nil, fmt.Errorf("token does not identify a verified account")
	}

	return &userInfos, nil
}
