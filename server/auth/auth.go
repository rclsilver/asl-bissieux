package auth

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/juju/errors"
	"github.com/lib/pq"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"slices"

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
			status := http.StatusUnauthorized
			if errors.IsForbidden(err) {
				status = http.StatusForbidden
			}
			c.AbortWithError(status, err)
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

func RegisterActions(names ...string) {
	actionsMut.Lock()
	defer actionsMut.Unlock()
	for _, name := range names {
		if !slices.Contains(actions, name) {
			actions = append(actions, name)
		}
	}
}

func RequireAction(action string) func(c *gin.Context) {
	RegisterActions(action)

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

type listUsersIn struct {
	Status string `query:"status"`
}

// ListUsers returns the list of the users
func ListUsers(c *gin.Context, in *listUsersIn) ([]*auth.User, error) {
	db := db.Connection(c)

	var result []*auth.User
	if err := db.Find(&result).Error; err != nil {
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get users")
		return nil, err
	}

	if err := auth.EnrichAccess(db, result, true); err != nil {
		return nil, err
	}
	if in.Status != "" {
		if !slices.Contains([]string{"pending", "active", "disabled", "rejected"}, in.Status) {
			return nil, errors.NewBadRequest(nil, "État d’accès invalide.")
		}
		filtered := make([]*auth.User, 0)
		for _, u := range result {
			if u.AccessStatus == in.Status {
				filtered = append(filtered, u)
			}
		}
		result = filtered
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

	db := db.Connection(c)
	var row auth.User

	if err := db.First(&row, "id = ?", in.UserID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.NewNotFound(nil, fmt.Sprintf("user %q not found", in.UserID))
		}
		logrus.WithContext(c.Request.Context()).WithError(err).Error("unable to get user")
		return nil, err
	}

	if err := auth.EnrichAccess(db, []*auth.User{&row}, true); err != nil {
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
	var row *auth.User
	err := administrativeWrite(c, func(tx *gorm.DB, actor *auth.User) error {
		if err := validateUserInput(in, nil); err != nil {
			return err
		}
		row = auth.NewUser(in.Username, in.Enabled, in.Admin, in.Actions)
		return tx.Create(row).Error
	})
	if err != nil {
		return nil, err
	}
	if err := db.Connection(c).First(row, "id = ?", row.ID).Error; err != nil {
		return nil, err
	}
	if err := auth.EnrichAccess(db.Connection(c), []*auth.User{row}, true); err != nil {
		return nil, err
	}
	return row, nil
}

type updateUserIn struct {
	ExpectedUpdatedAt *time.Time `json:"expected_updated_at"`
	AccessDecision    string     `json:"access_decision"`
	UserID            string     `path:"user_id"`

	createUserIn
}

// UpdateUser update a user
func UpdateUser(c *gin.Context, in *updateUserIn) (*auth.User, error) {
	if err := validateUUID(in.UserID, "Compte invalide."); err != nil {
		return nil, err
	}
	var row *auth.User
	err := administrativeWrite(c, func(tx *gorm.DB, actor *auth.User) error {
		var err error
		row, err = lockedUser(tx, in.UserID)
		if err != nil {
			return err
		}
		if in.ExpectedUpdatedAt != nil && !row.UpdatedAt.Equal(*in.ExpectedUpdatedAt) {
			return errors.NewAlreadyExists(nil, "Ce compte a changé. Actualise sa fiche avant de confirmer.")
		}
		if err := auth.EnrichAccess(tx, []*auth.User{row}, false); err != nil {
			return err
		}
		wasEnabled := row.Enabled
		if err := validateAccessDecision(row, in); err != nil {
			return err
		}
		if err := validateUserInput(&in.createUserIn, row); err != nil {
			return err
		}
		if err := protectLastAdministrator(tx, row, in.Enabled, in.Admin); err != nil {
			return err
		}
		values := map[string]any{"username": in.Username, "enabled": in.Enabled, "admin": in.Admin, "actions": pq.StringArray(in.Actions)}
		if err := tx.Model(row).Updates(values).Error; err != nil {
			return err
		}
		if wasEnabled != row.Enabled || in.AccessDecision != "" {
			if err := resolveAccess(tx, row, actor); err != nil {
				return err
			}
			return revokeDisabledSessions(tx, row)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if err := auth.EnrichAccess(db.Connection(c), []*auth.User{row}, true); err != nil {
		return nil, err
	}
	return row, nil
}

type deleteUserIn struct {
	UserID string `path:"user_id"`
}

// DeleteUser delete a user
func DeleteUser(c *gin.Context, in *deleteUserIn) error {
	if err := validateUUID(in.UserID, "Compte invalide."); err != nil {
		return err
	}
	return administrativeWrite(c, func(tx *gorm.DB, actor *auth.User) error {
		row, err := lockedUser(tx, in.UserID)
		if err != nil {
			return err
		}
		if err := protectLastAdministrator(tx, row, false, false); err != nil {
			return err
		}
		if err := tx.Exec("DELETE FROM auth_session WHERE user_id = ?", row.ID).Error; err != nil {
			return err
		}
		return tx.Delete(row).Error
	})
}

// UserInfos returns the informations of the current logged in user
func UserInfos(c *gin.Context) (*auth.User, error) {
	user, err := GetCurrentUser(c)
	if err != nil {
		return nil, err
	}
	if err := auth.EnrichAccess(db.Connection(c), []*auth.User{user}, false); err != nil {
		return nil, err
	}
	return user, nil
}

func validateUUID(value, message string) error {
	if _, err := uuid.Parse(value); err != nil {
		return errors.NewBadRequest(err, message)
	}
	return nil
}
