package auth

import (
	"fmt"
	"net/http"

	"github.com/sirupsen/logrus"

	"github.com/rclsilver/asl-bissieux/pkg/config"
)

type AuthProvider interface {
	// validate validate the configuration
	validate() error

	// Authenticate try to authenticate the request user and return the user instance
	Authenticate(*http.Request) (*User, error)
}

type Provider string

type providerConfig interface {
	Validate() error
}

var (
	providers map[Provider]AuthProvider
)

func registerProvider(name Provider, provider AuthProvider) {
	if _, exists := providers[name]; exists {
		logrus.Panicf("authentication provider %q already defined", name)
	}

	if providers == nil {
		providers = make(map[Provider]AuthProvider)
	}

	providers[name] = provider
}

type authConfig struct {
	Provider   Provider
	CreateUser bool
}

func (c *authConfig) SetDefaults() {
	c.CreateUser = true
}

var (
	cfg authConfig
)

func init() {
	config.RegisterSection("auth", &cfg)
}

func GetProvider() (AuthProvider, error) {
	provider, ok := providers[cfg.Provider]
	if !ok {
		return nil, fmt.Errorf("provider %q does not exist", cfg.Provider)
	}

	if err := provider.validate(); err != nil {
		return nil, fmt.Errorf("invalid authentication provider configuration: %v", err)
	}

	return provider, nil
}
