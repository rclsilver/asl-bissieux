package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/juju/errors"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
)

type LogoutResult struct {
	RedirectURL string `json:"redirect_url"`
}

func (s *httpServer) publicAuthConfig(c *gin.Context) (*auth.PublicAuthConfig, error) {
	c.Header("Cache-Control", "no-store")
	if provider, ok := s.authProvider.(auth.BrowserAuthProvider); ok {
		configuration := provider.PublicConfig()
		return &configuration, nil
	}
	return &auth.PublicAuthConfig{Mode: "google", Label: "Google"}, nil
}

func (s *httpServer) beginLogin(c *gin.Context) {
	if provider, ok := s.authProvider.(auth.BrowserAuthProvider); ok {
		provider.Login(c.Writer, c.Request)
		return
	}
	c.Status(http.StatusNotFound)
}

func (s *httpServer) finishLogin(c *gin.Context) {
	if provider, ok := s.authProvider.(auth.BrowserAuthProvider); ok {
		provider.Callback(c.Writer, c.Request)
		return
	}
	c.Status(http.StatusNotFound)
}

func (s *httpServer) endLogin(c *gin.Context) (*LogoutResult, error) {
	provider, ok := s.authProvider.(auth.BrowserAuthProvider)
	if !ok {
		return nil, errors.NewNotFound(nil, "session authentication is not configured")
	}
	c.Header("Cache-Control", "no-store")
	redirect, err := provider.Logout(c.Writer, c.Request)
	if err != nil {
		return nil, err
	}
	return &LogoutResult{RedirectURL: redirect}, nil
}
