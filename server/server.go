package server

import (
	"fmt"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/juju/errors"
	"github.com/loopfz/gadgeto/tonic"
	"github.com/sirupsen/logrus"
	"github.com/wI2L/fizz"
	"github.com/wI2L/fizz/openapi"

	"github.com/rclsilver/asl-bissieux/people"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
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
	engine := gin.New()

	corsCfg := cors.DefaultConfig()
	corsCfg.AllowAllOrigins = true
	corsCfg.AllowHeaders = []string{"authorization", "content-type"}
	engine.Use(cors.New(corsCfg))

	infos := &openapi.Info{
		Title:   "ASL",
		Version: version.Version,
	}

	router := fizz.NewFromEngine(engine)

	router.GET("/api/spec.json", nil, router.OpenAPI(infos, "json"))

	maintenance := router.Group("/api/mon", "01 - maintenance", "maintenance of the API")
	{
		maintenance.GET("/ping", []fizz.OperationOption{
			fizz.Summary("Checks if the API is healthy"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, tonic.Handler(Ping, http.StatusOK))
	}

	auth := router.Group("/api/auth", "02 - auth", "auth")
	{
		auth.GET("me", []fizz.OperationOption{
			fizz.Summary("Get the current user details"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, s.requireAuthentication(), tonic.Handler(UserInfos, http.StatusOK))
	}

	peopleGroup := router.Group("/api/member", "03 - member", "manages the members")
	{
		peopleGroup.GET("", []fizz.OperationOption{
			fizz.Summary("Get the members"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, s.requireAuthentication(), tonic.Handler(people.ListMembers, http.StatusOK))

		peopleGroup.GET(":id", []fizz.OperationOption{
			fizz.Summary("Get a member"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, s.requireAuthentication(), tonic.Handler(people.GetMember, http.StatusOK))

		peopleGroup.POST("", []fizz.OperationOption{
			fizz.Summary("Create a member"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, s.requireAuthentication(), s.requireAction(people.CreateMemberAction), tonic.Handler(people.CreateMember, http.StatusCreated))

		peopleGroup.PUT(":id", []fizz.OperationOption{
			fizz.Summary("Update a member"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, s.requireAuthentication(), s.requireAction(people.UpdateMemberAction), tonic.Handler(people.UpdateMember, http.StatusOK))

		peopleGroup.DELETE(":id", []fizz.OperationOption{
			fizz.Summary("Delete a member"),
			fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
		}, s.requireAuthentication(), s.requireAction(people.DeleteMemberAction), tonic.Handler(people.DeleteMember, http.StatusNoContent))
	}
	/*
		sync := router.Group("/api/sync", "04 - sync", "synchronization")
		{
			sync.POST("", []fizz.OperationOption{
				fizz.Summary("Synchronizes the mailing list with the database."),
				fizz.Response(fmt.Sprint(http.StatusInternalServerError), "Server Error", APIError{}, nil, nil),
			}, s.requireAuthentication(), tonic.Handler(handlers.Sync, http.StatusOK))
		}
	*/

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
			return nil
		}
	}

	// Frontend directory
	//frontend := http.FileServer(http.Dir(frontendPath))
	//http.Handle("/", frontend)

	// API
	http.Handle("/api/", withLogging(s.apiRouter))

	logrus.Debugf("starting server on %s:%d", cfg.ListenAddress, cfg.ListenPort)
	return http.ListenAndServe(fmt.Sprintf("%s:%d", cfg.ListenAddress, cfg.ListenPort), nil)
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
