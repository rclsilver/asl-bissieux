package auth

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

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
	cfg googleAuthConfig
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

	authHeaderParts := strings.Split(authHeader, " ")
	if len(authHeaderParts) != 2 {
		return nil, errors.NewBadRequest(nil, "invalid authorization header")
	}

	userInfos, err := p.getUserInfos(authHeaderParts[1])
	if err != nil {
		return nil, errors.NewUnauthorized(err, "unable to verify token")
	}

	db := db.Connection()

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

func (p *googleProvider) getUserInfos(accessToken string) (*userInfos, error) {
	url := fmt.Sprintf("https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=%s", accessToken)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("unable to build request: %s", err)
	}

	req.Header.Add("Accept", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("unable to execute http request: %s", err)
	}

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bad status code: %d", res.StatusCode)
	}

	defer res.Body.Close()

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, fmt.Errorf("unable to read body: %s", err)
	}

	var userInfos userInfos

	if err := json.Unmarshal(body, &userInfos); err != nil {
		return nil, fmt.Errorf("unable to unmarshal body: %s", err)
	}

	if userInfos.Audience != p.cfg.ClientID {
		return nil, fmt.Errorf("not the expected audience")
	}

	if userInfos.IssuedTo != p.cfg.ClientID {
		return nil, fmt.Errorf("not the expected issued to")
	}

	return &userInfos, nil
}
