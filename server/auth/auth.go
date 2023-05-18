package auth

import (
	"fmt"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/juju/errors"
	"github.com/sirupsen/logrus"
	"golang.org/x/exp/slices"
	"gorm.io/gorm"

	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/db"
)

const (
	CurrentUser = "user"
)

var (
	actions    []string
	actionsMut sync.Mutex
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

		c.Set(CurrentUser, user)
		c.Next()
	}
}

func RequireEnabled() func(c *gin.Context) {
	return func(c *gin.Context) {
		user, err := GetCurrentUser(c)
		if err != nil {
			logrus.WithError(err).Errorf("unable to get user")
			c.AbortWithError(http.StatusUnauthorized, err)
			return
		}

		if !user.Enabled {
			c.AbortWithError(http.StatusUnauthorized, errors.NewUnauthorized(nil, "account not active"))
			return
		}

		c.Next()
	}
}

func RequireAdministrator() func(c *gin.Context) {
	return func(c *gin.Context) {
		user, err := GetCurrentUser(c)
		if err != nil {
			logrus.WithError(err).Errorf("unable to get user")
			c.AbortWithError(http.StatusUnauthorized, err)
			return
		}

		if !user.Enabled {
			c.AbortWithError(http.StatusUnauthorized, errors.NewUnauthorized(nil, "account not active"))
			return
		}

		if !user.Admin {
			c.AbortWithError(http.StatusForbidden, errors.NewUnauthorized(nil, "account not an administrator"))
			return
		}

		c.Next()
	}
}

func RequireAction(action string) func(c *gin.Context) {
	actionsMut.Lock()
	defer actionsMut.Unlock()

	if !slices.Contains(actions, action) {
		actions = append(actions, action)
	}

	return func(c *gin.Context) {
		u, err := GetCurrentUser(c)
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

// GetCurrentUser returns the current authenticated user
func GetCurrentUser(c *gin.Context) (*auth.User, error) {
	cUser, _ := c.Get(CurrentUser)

	u, ok := cUser.(*auth.User)
	if !ok {
		return nil, fmt.Errorf("expected *auth.User, got %T", cUser)
	}

	return u, nil
}

// ListActions returns all the registered actions
func ListActions(c *gin.Context) ([]string, error) {
	actionsMut.Lock()
	defer actionsMut.Unlock()

	return append([]string{}, actions...), nil
}

type listUsersIn struct{}

// ListUsers returns the list of the users
func ListUsers(c *gin.Context, in *listUsersIn) ([]*auth.User, error) {
	db := db.Connection()

	var result []*auth.User
	if err := db.Find(&result).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get users")
		return nil, err
	}

	return result, nil
}

type getUserIn struct {
	UserID string `path:"user_id"`
}

// GetUser get a user
func GetUser(c *gin.Context, in *getUserIn) (*auth.User, error) {
	if err := validateUUID(in.UserID, "invalid user ID"); err != nil {
		return nil, err
	}

	db := db.Connection()
	var row auth.User

	if err := db.First(&row, "id = ?", in.UserID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("user %q not found", in.UserID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get user")
		return nil, err
	}

	return &row, nil
}

type createUserIn struct {
	Username string   `json:"username" binding:"required"`
	Enabled  bool     `json:"enabled"`
	Admin    bool     `json:"admin"`
	Actions  []string `json:"actions"`
}

// CreateUser create a user
func CreateUser(c *gin.Context, in *createUserIn) (*auth.User, error) {
	row := auth.NewUser(in.Username, in.Enabled, in.Admin, in.Actions)
	db := db.Connection()

	if err := db.Create(row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to create user")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Infof("user %s (%s) created", row.Username, row.ID)

	return row, nil
}

type updateUserIn struct {
	UserID string `path:"user_id"`

	createUserIn
}

// UpdateUser update a user
func UpdateUser(c *gin.Context, in *updateUserIn) (*auth.User, error) {
	if err := validateUUID(in.UserID, "invalid user ID"); err != nil {
		return nil, err
	}

	db := db.Connection()
	var row auth.User

	if err := db.First(&row, "id = ?", in.UserID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("user %q not found", in.UserID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to update user")
		return nil, err
	}

	values := map[string]any{
		"username": in.Username,
		"enabled":  in.Enabled,
		"admin":    in.Admin,
		"actions":  in.Actions,
	}

	if err := db.Model(&row).Where("id = ?", row.ID).Updates(values).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to update user")
		return nil, err
	}
	logrus.WithContext(c.Request.Context()).Error("user %s (%s) updated", row.Username, row.ID)

	if err := db.First(&row, "id = ?", in.UserID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("user %q not found", in.UserID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get user")
		return nil, err
	}

	return &row, nil
}

type deleteUserIn struct {
	UserID string `path:"user_id"`
}

// DeleteUser delete a user
func DeleteUser(c *gin.Context, in *deleteUserIn) error {
	if err := validateUUID(in.UserID, "invalid user ID"); err != nil {
		return err
	}

	db := db.Connection().Begin()
	if db.Error != nil {
		logrus.WithContext(c.Request.Context()).WithError(db.Error).Error("unable to begin transaction")
		return db.Error
	}
	defer db.Rollback()

	var row auth.User

	if err := db.First(&row, "id = ?", in.UserID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return errors.NewNotFound(nil, fmt.Sprintf("user %q not found", in.UserID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to delete user")
		return err
	}

	if err := db.Delete(&row).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to delete user")
		return err
	}
	logrus.WithContext(c.Request.Context()).Infof("user %q deleted", row.ID)

	if err := db.Commit().Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to commit transaction")
		return err
	}

	return nil
}

// UserInfos returns the informations of the current logged in user
func UserInfos(c *gin.Context) (*auth.User, error) {
	return GetCurrentUser(c)
}

func validateUUID(value, message string) error {
	if _, err := uuid.Parse(value); err != nil {
		return errors.NewBadRequest(err, message)
	}
	return nil
}
