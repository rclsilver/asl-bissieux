package auth

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/juju/errors"
	"github.com/sirupsen/logrus"

	"github.com/rclsilver/asl-bissieux/pkg/auth"
)

const (
	CurrentUser = "user"
)

func RequireAuthentication(provider auth.AuthProvider) func(c *gin.Context) {
	return func(c *gin.Context) {
		user, err := provider.Authenticate(c.Request)
		if err != nil {
			c.AbortWithError(http.StatusUnauthorized, err)
			return
		}

		if user == nil {
			c.AbortWithError(http.StatusUnauthorized, errors.NewUnauthorized(nil, "not authenticated"))
			return
		}

		if !user.IsActive() {
			c.AbortWithError(http.StatusUnauthorized, errors.NewUnauthorized(nil, "account not active"))
			return
		}

		c.Set(CurrentUser, user)
		c.Next()
	}
}

func RequireAction(action string) func(c *gin.Context) {
	return func(c *gin.Context) {
		u, err := GetUser(c)
		if err != nil {
			logrus.WithError(err).Errorf("unable to get user")
			c.AbortWithError(http.StatusUnauthorized, err)
			return
		}

		if !u.Allowed(action) {
			logrus.Errorf("not allowed to execute action %q", action)
			c.AbortWithError(http.StatusForbidden, errors.NewForbidden(nil, "user not allowed to execute this action"))
			return
		}

		c.Next()
	}
}

// GetUser returns the current authenticated user
func GetUser(c *gin.Context) (*auth.User, error) {
	cUser, _ := c.Get(CurrentUser)

	u, ok := cUser.(*auth.User)
	if !ok {
		return nil, fmt.Errorf("expected *auth.User, got %T", cUser)
	}

	return u, nil
}

func UserInfos(c *gin.Context) (*auth.User, error) {
	return GetUser(c)
}
