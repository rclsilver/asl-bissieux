package server

import (
	"fmt"
	"io/fs"
	"net/http"
	"reflect"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/juju/errors"
	"github.com/loopfz/gadgeto/tonic"
	"github.com/sirupsen/logrus"
	"github.com/wI2L/fizz"
	"github.com/wI2L/fizz/openapi"

	"github.com/rclsilver/asl-bissieux/frontend"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/money"
	_auth "github.com/rclsilver/asl-bissieux/server/auth"
	"github.com/rclsilver/asl-bissieux/server/handlers"
	"github.com/rclsilver/asl-bissieux/version"
)

type ContextKey string

type httpServer struct {
	apiRouter    *fizz.Fizz
	authProvider auth.AuthProvider
}

func NewServer() *httpServer {
	return &httpServer{}
}

func (s *httpServer) WithAuthProvider(provider auth.AuthProvider) *httpServer {
	s.authProvider = provider
	return s
}

func (s *httpServer) Build() error {
	_auth.RegisterActions(handlers.CreateRefundAction, handlers.CreateAdjustmentAction)
	tonic.SetBindHook(func(c *gin.Context, v interface{}) error {
		val := reflect.ValueOf(v)
		typ := reflect.TypeOf(v).Elem()

		for i := 0; i < typ.NumField(); i++ {
			ft := typ.Field(i)

			name, found := ft.Tag.Lookup("context")
			if !found {
				continue
			}

			cv, exists := c.Get(name)
			if !exists {
				return fmt.Errorf("context key %q not found", name)
			}

			val.Elem().Field(i).Set(reflect.ValueOf(cv))
		}

		return tonic.DefaultBindingHook(c, v)
	})

	engine := gin.New()
	if _, browserSession := s.authProvider.(auth.BrowserAuthProvider); browserSession {
		engine.Use(func(c *gin.Context) { c.Header("Cache-Control", "no-store"); c.Next() })
	}

	corsCfg := cors.DefaultConfig()
	corsCfg.AllowAllOrigins = true
	corsCfg.AllowHeaders = []string{"authorization", "content-type"}
	engine.Use(cors.New(corsCfg))

	infos := &openapi.Info{
		Title:   "ASL",
		Version: version.Version,
	}

	router := fizz.NewFromEngine(engine)
	if err := router.Generator().OverrideDataType(reflect.TypeOf(money.Amount{}), "number", "double"); err != nil {
		return err
	}

	router.GET("/api/spec.json", nil, router.OpenAPI(infos, "json"))

	maintenance := router.Group("/api/mon", "01 - maintenance", "maintenance of the API")
	{
		maintenance.GET("/ping", []fizz.OperationOption{
			fizz.Summary("Checks if the API is healthy"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, tonic.Handler(Ping, http.StatusOK))
	}

	authGroup := router.Group("/api/auth", "02 - auth", "auth")
	{
		authGroup.GET("config", []fizz.OperationOption{fizz.Summary("Get public authentication configuration")}, tonic.Handler(s.publicAuthConfig, http.StatusOK))
		authGroup.GET("login", []fizz.OperationOption{fizz.Summary("Start OIDC sign-in")}, s.beginLogin)
		authGroup.GET("callback", []fizz.OperationOption{fizz.Summary("Complete OIDC sign-in")}, s.finishLogin)
		authGroup.POST("logout", []fizz.OperationOption{fizz.Summary("End the application session")}, tonic.Handler(s.endLogin, http.StatusOK))

		authGroup.GET("me", []fizz.OperationOption{
			fizz.Summary("Get the current user details"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), tonic.Handler(_auth.UserInfos, http.StatusOK))

		authGroup.GET("access-requests/summary", nil, _auth.RequireAuthentication(s.authProvider), _auth.RequireAdministrator(), tonic.Handler(_auth.PendingAccessRequests, http.StatusOK))

		authGroup.GET("actions", []fizz.OperationOption{
			fizz.Summary("Get all the registered actions"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireAdministrator(), tonic.Handler(_auth.ListActions, http.StatusOK))

		authGroup.GET("users", []fizz.OperationOption{
			fizz.Summary("Get all the registered users"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireAdministrator(), tonic.Handler(_auth.ListUsers, http.StatusOK))

		authGroup.POST("users", []fizz.OperationOption{
			fizz.Summary("Register a new user"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireAdministrator(), tonic.Handler(_auth.CreateUser, http.StatusCreated))

		authGroup.GET("users/:user_id", []fizz.OperationOption{
			fizz.Summary("Get an existing user"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireAdministrator(), tonic.Handler(_auth.GetUser, http.StatusOK))

		authGroup.PUT("users/:user_id", []fizz.OperationOption{
			fizz.Summary("Update an existing user"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireAdministrator(), tonic.Handler(_auth.UpdateUser, http.StatusOK))

		authGroup.DELETE("users/:user_id", []fizz.OperationOption{
			fizz.Summary("Delete an existing user"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireAdministrator(), tonic.Handler(_auth.DeleteUser, http.StatusNoContent))
	}

	unitGroup := router.Group("/api/unit", "03 - unit", "manages the units")
	{
		unitGroup.GET("", []fizz.OperationOption{
			fizz.Summary("Get the units"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.ListUnits, http.StatusOK))

		unitGroup.GET(":unit_id", []fizz.OperationOption{
			fizz.Summary("Get an unit"),
			fizz.Response(fmt.Sprint(http.StatusNotFound), "Not Found", APIError{}, nil, nil),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.GetUnit, http.StatusOK))

		unitGroup.POST("", []fizz.OperationOption{
			fizz.Summary("Create an unit"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.CreateUnitAction), tonic.Handler(handlers.CreateUnit, http.StatusCreated))

		unitGroup.PUT(":unit_id", []fizz.OperationOption{
			fizz.Summary("Update an unit"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.UpdateUnitAction), tonic.Handler(handlers.UpdateUnit, http.StatusOK))

		unitGroup.DELETE(":unit_id", []fizz.OperationOption{
			fizz.Summary("Delete an unit"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.DeleteUnitAction), tonic.Handler(handlers.DeleteUnit, http.StatusNoContent))

		unitGroup.GET(":unit_id/members", []fizz.OperationOption{
			fizz.Summary("Get members of an unit"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.ListUnitMembers, http.StatusOK))
	}

	peopleGroup := router.Group("/api/member", "04 - member", "manages the members")
	{
		peopleGroup.GET("", []fizz.OperationOption{
			fizz.Summary("Get the members"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.ListMembers, http.StatusOK))

		peopleGroup.GET(":member_id", []fizz.OperationOption{
			fizz.Summary("Get a member"),
			fizz.Response(fmt.Sprint(http.StatusNotFound), "Not Found", APIError{}, nil, nil),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.GetMember, http.StatusOK))

		peopleGroup.POST("", []fizz.OperationOption{
			fizz.Summary("Create a member"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.CreateMemberAction), tonic.Handler(handlers.CreateMember, http.StatusCreated))

		peopleGroup.PUT(":member_id", []fizz.OperationOption{
			fizz.Summary("Update a member"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.UpdateMemberAction), tonic.Handler(handlers.UpdateMember, http.StatusOK))

		peopleGroup.DELETE(":member_id", []fizz.OperationOption{
			fizz.Summary("Delete a member"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.DeleteMemberAction), tonic.Handler(handlers.DeleteMember, http.StatusNoContent))

		peopleGroup.POST(":member_id/units", []fizz.OperationOption{
			fizz.Summary("Link an unit to a member"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.LinkUnitAction), tonic.Handler(handlers.AddMemberUnit, http.StatusNoContent))

		peopleGroup.DELETE(":member_id/units/:unit_id", []fizz.OperationOption{
			fizz.Summary("Unlink an unit from a member"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.UnlinkUnitAction), tonic.Handler(handlers.RemoveMemberUnit, http.StatusNoContent))
	}

	budgetGroup := router.Group("/api/budget", "05 - budget", "manages the budgets")
	{
		budgetGroup.GET("", []fizz.OperationOption{
			fizz.Summary("Get the budgets"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.ListBudgets, http.StatusOK))

		budgetGroup.GET(":budget_id", []fizz.OperationOption{
			fizz.Summary("Get a budget"),
			fizz.Response(fmt.Sprint(http.StatusNotFound), "Not Found", APIError{}, nil, nil),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.GetBudget, http.StatusOK))

		budgetGroup.POST("", []fizz.OperationOption{
			fizz.Summary("Create a budget"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.CreateBudgetAction), tonic.Handler(handlers.CreateBudget, http.StatusCreated))

		budgetGroup.POST(":budget_id/publish", []fizz.OperationOption{
			fizz.Response("400", "Budget already published or inconsistent draft", APIError{}, nil, nil),
			fizz.Response("403", "Publication is not permitted", APIError{}, nil, nil),
			fizz.Summary("Publish a budget"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.PublishBudgetAction), tonic.Handler(handlers.PublishBudget, http.StatusOK))

		budgetGroup.PUT(":budget_id", []fizz.OperationOption{
			fizz.Summary("Update a budget"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.UpdateBudgetAction), tonic.Handler(handlers.UpdateBudget, http.StatusOK))

		budgetGroup.DELETE(":budget_id", []fizz.OperationOption{
			fizz.Response("403", "Published budgets cannot be deleted", APIError{}, nil, nil),
			fizz.Summary("Delete a budget"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.DeleteBudgetAction), tonic.Handler(handlers.DeleteBudget, http.StatusNoContent))

		budgetGroup.GET(":budget_id/dashboard", nil, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.GetBudgetDashboard, http.StatusOK))

		budgetGroup.GET(":budget_id/expenses", []fizz.OperationOption{
			fizz.Summary("Get the expenses"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.ListExpenses, http.StatusOK))

		budgetGroup.POST(":budget_id/expenses", []fizz.OperationOption{
			fizz.Response("403", "Published budget expenses are locked", APIError{}, nil, nil),
			fizz.Summary("Create an expense"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.CreateExpenseAction), tonic.Handler(handlers.CreateExpense, http.StatusCreated))

		budgetGroup.PUT(":budget_id/expenses/:expense_id", []fizz.OperationOption{
			fizz.Response("403", "Published budget expenses are locked", APIError{}, nil, nil),
			fizz.Summary("Update an expense"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.UpdateExpenseAction), tonic.Handler(handlers.UpdateExpense, http.StatusOK))

		budgetGroup.DELETE(":budget_id/expenses/:expense_id", []fizz.OperationOption{
			fizz.Response("403", "Published budget expenses are locked", APIError{}, nil, nil),
			fizz.Summary("Delete an expense"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.DeleteExpenseAction), tonic.Handler(handlers.DeleteExpense, http.StatusNoContent))

		budgetGroup.GET(":budget_id/cotisations", []fizz.OperationOption{
			fizz.Summary("Get the cotisations"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.ListCotisations, http.StatusOK))

		budgetGroup.GET(":budget_id/cotisations/:cotisation_id/entries", nil, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.ListFinancialEntries, http.StatusOK))
		budgetGroup.POST(":budget_id/cotisations/:cotisation_id/entries/preview", nil, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.PreviewFinancialEntry, http.StatusOK))
		budgetGroup.POST(":budget_id/cotisations/:cotisation_id/entries", nil, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.CreateFinancialEntry, http.StatusCreated))
		budgetGroup.GET(":budget_id/cotisations/:cotisation_id/payments", []fizz.OperationOption{
			fizz.Summary("Get the payments"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.ListPayments, http.StatusOK))

		budgetGroup.POST(":budget_id/cotisations/:cotisation_id/payments", []fizz.OperationOption{
			fizz.Summary("Create a payment"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.CreatePaymentAction), tonic.Handler(handlers.CreatePayment, http.StatusCreated))

		budgetGroup.PUT(":budget_id/cotisations/:cotisation_id/payments/:payment_id", []fizz.OperationOption{
			fizz.Summary("Update a payment"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.UpdatePaymentAction), tonic.Handler(handlers.UpdatePayment, http.StatusOK))

		budgetGroup.DELETE(":budget_id/cotisations/:cotisation_id/payments/:payment_id", []fizz.OperationOption{
			fizz.Summary("Delete a payment"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.DeletePaymentAction), tonic.Handler(handlers.DeletePayment, http.StatusNoContent))

		budgetGroup.POST(":budget_id/email", []fizz.OperationOption{
			fizz.Summary("Send an e-mail"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.SendBudgetEmailAction), tonic.Handler(handlers.SendBudgetEmail, http.StatusAccepted))

		budgetGroup.POST(":budget_id/email-preview", []fizz.OperationOption{
			fizz.Summary("Preview an e-mail"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.PreviewBudgetEmail, http.StatusOK))
	}

	dashboardGroup := router.Group("/api/dashboard", "07 - dashboard", "read-only dashboard summaries")
	dashboardGroup.GET("directory", nil, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.GetDirectoryQuality, http.StatusOK))
	dashboardGroup.GET("emails", nil, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.GetEmailDashboard, http.StatusOK))

	mailingGroup := router.Group("/api/mailing-lists", "08 - mailing lists", "OVH mailing list synchronization")
	mailingGroup.GET("preview", nil, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAdministrator(), tonic.Handler(handlers.PreviewMailingLists, http.StatusOK))
	mailingGroup.POST("sync", nil, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAdministrator(), tonic.Handler(handlers.SyncMailingLists, http.StatusOK))

	emailGroup := router.Group("/api/email", "06 - email", "manages the emails")
	{
		emailGroup.GET("templates", []fizz.OperationOption{
			fizz.Summary("Get the email templates"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.ListEmailTemplates, http.StatusOK))

		emailGroup.POST("templates", []fizz.OperationOption{
			fizz.Summary("Create an email template"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.CreateEmailTemplateAction), tonic.Handler(handlers.CreateEmailTemplate, http.StatusCreated))

		emailGroup.GET("templates/:template_id", []fizz.OperationOption{
			fizz.Summary("Get an email template"),
			fizz.Response(fmt.Sprint(http.StatusNotFound), "Not Found", APIError{}, nil, nil),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.GetEmailTemplate, http.StatusOK))

		emailGroup.PUT("templates/:template_id", []fizz.OperationOption{
			fizz.Summary("Update an email template"),
			fizz.Response(fmt.Sprint(http.StatusNotFound), "Not Found", APIError{}, nil, nil),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.UpdateEmailTemplateAction), tonic.Handler(handlers.UpdateEmailTemplate, http.StatusOK))

		emailGroup.DELETE("templates/:template_id", []fizz.OperationOption{
			fizz.Summary("Delete an email template"),
			fizz.Response(fmt.Sprint(http.StatusNotFound), "Not Found", APIError{}, nil, nil),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.DeleteEmailTemplateAction), tonic.Handler(handlers.DeleteEmailTemplate, http.StatusNoContent))

		emailGroup.POST("templates/:template_id/preview", []fizz.OperationOption{
			fizz.Summary("Preview an email template"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.PreviewEmailTemplate, http.StatusOK))

		emailGroup.GET("templates/:template_id/attachments", []fizz.OperationOption{
			fizz.Summary("Get the attachments"),
			fizz.Response(fmt.Sprint(http.StatusNotFound), "Not Found", APIError{}, nil, nil),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.ListAttachments, http.StatusOK))

		emailGroup.POST("templates/:template_id/attachments", []fizz.OperationOption{
			fizz.Summary("Add an attachment"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.AddAttachmentAction), handlers.AddAttachmentMiddleware, tonic.Handler(handlers.AddAttachment, http.StatusCreated))

		emailGroup.GET("templates/:template_id/attachments/:attachment_id", []fizz.OperationOption{
			fizz.Summary("Download an attachment"),
			fizz.Response(fmt.Sprint(http.StatusNotFound), "Not Found", APIError{}, nil, nil),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.DownloadAttachment, http.StatusOK))

		emailGroup.DELETE("templates/:template_id/attachments/:attachment_id", []fizz.OperationOption{
			fizz.Summary("Delete an attachment"),
			fizz.Response(fmt.Sprint(http.StatusNotFound), "Not Found", APIError{}, nil, nil),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.RemoveAttachmentAction), tonic.Handler(handlers.RemoveAttachment, http.StatusNoContent))

		emailGroup.GET("campaigns", []fizz.OperationOption{
			fizz.Summary("Get the email campaigns"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.ListEmailCampaigns, http.StatusOK))

		emailGroup.POST("campaigns", []fizz.OperationOption{
			fizz.Summary("Create an email campaign"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.CreateEmailCampaignAction), tonic.Handler(handlers.CreateEmailCampaign, http.StatusCreated))

		emailGroup.DELETE("campaigns/:campaign_id", []fizz.OperationOption{
			fizz.Summary("Delete a campaign"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.DeleteEmailCampaignAction), tonic.Handler(handlers.DeleteEmailCampaign, http.StatusNoContent))

		emailGroup.GET("campaigns/:campaign_id", []fizz.OperationOption{
			fizz.Summary("Get the campaign details"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.GetEmailCampaign, http.StatusOK))

		emailGroup.GET("campaigns/:campaign_id/emails", []fizz.OperationOption{
			fizz.Summary("Get the emails"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.ListEmails, http.StatusOK))

		emailGroup.GET(":email_id", []fizz.OperationOption{
			fizz.Summary("Get an email"),
			fizz.Response(fmt.Sprint(http.StatusNotFound), "Not Found", APIError{}, nil, nil),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.GetEmail, http.StatusOK))

		emailGroup.GET(":email_id/status", []fizz.OperationOption{
			fizz.Summary("Get email delivery status without rendering its content"),
			fizz.Response(fmt.Sprint(http.StatusNotFound), "Not Found", APIError{}, nil, nil),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), tonic.Handler(handlers.GetEmailStatus, http.StatusOK))

		emailGroup.DELETE(":email_id", []fizz.OperationOption{
			fizz.Summary("Delete an email"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.DeleteEmailAction), tonic.Handler(handlers.DeleteEmail, http.StatusNoContent))

		emailGroup.POST(":email_id/send", []fizz.OperationOption{
			fizz.Summary("Send an email"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.SendEmailAction), tonic.Handler(handlers.SendEmail, http.StatusNoContent))

		emailGroup.POST(":email_id/set-error", []fizz.OperationOption{
			fizz.Summary("Set email state to ERROR"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, _auth.RequireAuthentication(s.authProvider), _auth.RequireEnabled(), _auth.RequireAction(handlers.SetErrorEmailAction), tonic.Handler(handlers.SetEmailError, http.StatusNoContent))

		emailGroup.GET(":email_id/tracker", []fizz.OperationOption{
			fizz.Summary("Track an email"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, tonic.Handler(handlers.TrackEmail, http.StatusOK))
	}

	if _, browserSession := s.authProvider.(auth.BrowserAuthProvider); browserSession {
		router.Generator().SetSecuritySchemes(map[string]*openapi.SecuritySchemeOrRef{
			"application_session": {SecurityScheme: &openapi.SecurityScheme{
				Type: "apiKey", In: "cookie", Name: "asl_session",
				Description: "Server-side session established through OIDC Authorization Code with PKCE. Writes also require the X-XSRF-TOKEN header and the configured application origin.",
			}},
		})
		router.Generator().SetSecurityRequirement([]*openapi.SecurityRequirement{{"application_session": []string{}}})
	} else {
		router.Generator().SetSecuritySchemes(map[string]*openapi.SecuritySchemeOrRef{
			"google_oauth": {
				SecurityScheme: &openapi.SecurityScheme{
					Type:        "oauth2",
					Description: "Google authentication",
					Flows: &openapi.OAuthFlows{
						Implicit: &openapi.OAuthFlow{
							AuthorizationURL: "https://accounts.google.com/o/oauth2/v2/auth",
							TokenURL:         "https://www.googleapis.com/oauth2/v4/token",
							Scopes: map[string]string{
								"openid":  "",
								"profile": "",
								"email":   "",
							},
						},
					},
				},
			},
		})

		router.Generator().SetSecurityRequirement([]*openapi.SecurityRequirement{
			{
				"google_oauth": []string{},
			},
		})
	}

	if len(router.Errors()) != 0 {
		return fmt.Errorf("fizz errors: %v", router.Errors())
	}

	tonic.SetErrorHook(errHook)

	s.apiRouter = router

	return nil
}

func (s *httpServer) Serve() error {
	if s.apiRouter == nil {
		if err := s.Build(); err != nil {
			return err
		}
	}

	// Frontend
	dist, err := fs.Sub(frontend.Dist, "dist/asl-bissieux")
	if err != nil {
		return err
	}
	mux := http.NewServeMux()
	mux.Handle("/", frontendHandler(dist))

	// API
	mux.Handle("/api/", withLogging(s.apiRouter))

	logrus.Debugf("starting server on %s:%d", cfg.ListenAddress, cfg.ListenPort)
	return http.ListenAndServe(fmt.Sprintf("%s:%d", cfg.ListenAddress, cfg.ListenPort), mux)
}

func errHook(ctx *gin.Context, e error) (int, interface{}) {
	code, msg := http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError)

	if _, ok := e.(tonic.BindError); ok {
		code, msg = http.StatusBadRequest, e.Error()
	} else {
		switch {
		case errors.IsBadRequest(e), errors.IsNotValid(e), errors.IsNotSupported(e), errors.IsNotProvisioned(e):
			code, msg = http.StatusBadRequest, e.Error()

		case errors.IsForbidden(e):
			code, msg = http.StatusForbidden, e.Error()

		case errors.IsMethodNotAllowed(e):
			code, msg = http.StatusMethodNotAllowed, e.Error()

		case errors.IsNotFound(e), errors.IsUserNotFound(e):
			code, msg = http.StatusNotFound, e.Error()

		case errors.IsUnauthorized(e):
			code, msg = http.StatusUnauthorized, e.Error()

		case errors.IsAlreadyExists(e):
			code, msg = http.StatusConflict, e.Error()

		case errors.IsNotImplemented(e):
			code, msg = http.StatusNotImplemented, e.Error()
		}
	}

	err := APIError{
		Message: msg,
	}

	return code, err
}
