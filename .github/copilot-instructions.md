# GitHub Copilot Instructions

## Active Branch

Always work on the **`dev`** branch. Do not make changes to `master` or any other branch.

---

## Project Overview

**ASL Bissieux** is a full-stack web management application for an *Association Syndicale Libre* (ASL) — a French private homeowners association. It allows the association's board to manage:

- **Members** — homeowners registered in the association
- **Units** — housing lots (identified by a number and a share value in *tantièmes*)
- **Budgets** — annual budgets with expenses, cotisations (dues per unit), and payments
- **Emails** — email templates, campaigns, and attachments (with SMTP delivery)
- **Users** — application users with role-based access control (admin flag + per-action permissions)

---

## Repository Structure

```
asl-bissieux/
├── .github/
│   └── copilot-instructions.md   # this file
├── cmd/                          # Cobra CLI commands (root, server)
├── controllers/                  # Business logic (budgets, emails, members)
├── frontend/                     # Angular application (standalone sub-project)
│   └── src/app/
│       ├── core/                 # Auth, API service, interceptors, guards
│       ├── shared/               # Reusable components, datasources, models
│       ├── budgets/              # Budget feature module
│       ├── emails/               # Email feature module
│       ├── members/              # Members feature module
│       ├── units/                # Units feature module
│       └── users/                # Users feature module
├── models/                       # GORM models (auto-migrated on startup)
├── pkg/
│   ├── auth/                     # Pluggable auth providers (Google implemented)
│   ├── config/                   # Viper-based configuration loader
│   ├── db/                       # Database connection, migrations, base model
│   ├── smtp/                     # SMTP email sending
│   ├── templates/                # Go templating helpers
│   └── utils/                    # String utilities
├── server/
│   ├── auth/                     # HTTP authentication middleware
│   └── handlers/                 # HTTP route handlers (Gin + fizz)
├── version/                      # Binary version info
├── main.go                       # Entrypoint
├── Makefile                      # Build targets
├── Dockerfile                    # Multi-stage: frontend-build, server-build, final
├── docker-compose.yml            # Full dev stack
├── asl-bissieux.yaml             # Default configuration file
└── generate-openapi.sh           # Regenerates frontend OpenAPI types from server
```

---

## Tech Stack

### Backend (Go)

| Concern | Library |
|---|---|
| HTTP framework | `github.com/gin-gonic/gin` |
| OpenAPI generation | `github.com/wI2L/fizz` + `github.com/loopfz/gadgeto` |
| ORM | `gorm.io/gorm` + `gorm.io/driver/postgres` |
| Database | PostgreSQL 14 |
| Auth provider | Google OAuth (`pkg/auth/google.go`) |
| Configuration | `github.com/spf13/viper` + `github.com/spf13/cobra` |
| Logging | `github.com/sirupsen/logrus` |
| Email | Custom SMTP client in `pkg/smtp/` |
| Templating | `github.com/Masterminds/sprig/v3`, Go `text/template` |
| UUID | `github.com/google/uuid` |

**Go version:** 1.20  
**Module path:** `github.com/rclsilver/asl-bissieux`

### Frontend (Angular)

| Concern | Library |
|---|---|
| Framework | Angular 16+ (NgModules, lazy loading) |
| UI Components | Angular Material |
| HTTP | Angular `HttpClient` |
| Auth (Google) | `ngx-sign-in-with-google` |
| API types | Auto-generated from OpenAPI spec (`core/api/openapi.ts`) |
| Reactive state | RxJS (`BehaviorSubject`, `Observable`) |

**Node version (Docker):** 18.16.0-alpine  
**Frontend root:** `./frontend/`

---

## Development Workflow

### Prerequisites

Docker and Docker Compose (v2) are required.

### Start the full stack

```bash
docker compose up
```

This starts:
- `postgresql` — PostgreSQL 14 (port not exposed externally)
- `smtp-mock` — fake SMTP server for local email testing
- `server` — Go backend, runs via `go run main.go server -v`, port `8080`
- `frontend` — Angular dev server (`npm start`), port `4200`
- `swagger` — Swagger UI pointed at `http://localhost:8080/api/spec.json`

### Build the binary (without Docker)

```bash
make asl-bissieux
```

### Regenerate OpenAPI types

Run this whenever server routes or schemas change:

```bash
./generate-openapi.sh
```

This fetches `http://localhost:8080/api/spec.json` and regenerates `frontend/src/app/core/api/openapi.ts`.

### Run tests

```bash
go test ./...
```

---

## Backend Conventions

### Package layout

- `pkg/` — reusable, domain-agnostic packages (db, auth, smtp, config)
- `models/` — GORM models; each file calls `db.RegisterMigration(...)` in `init()`
- `controllers/` — business logic, called by handlers
- `server/handlers/` — HTTP handlers wired via fizz (auto-generates OpenAPI)

### Models

All models embed `db.Model` which provides:
- `ID string` — UUID primary key, auto-generated on create
- `CreatedAt`, `UpdatedAt time.Time`
- `DeletedAt gorm.DeletedAt` — soft delete

Always implement `TableName() string` on models.

### Configuration

Config is loaded from `asl-bissieux.yaml` (committed default values) and optionally overridden by `asl-bissieux.override.yaml` (git-ignored). Environment variables with the prefix `APP_` override file values (e.g. `APP_DB_PASSWORD`).

Register a new config section with:
```go
config.RegisterSection("section_name", &myCfgStruct)
```

### Error handling

Use `github.com/juju/errors` for typed HTTP errors (`errors.NewBadRequest`, `errors.NewNotFound`, etc.).

---

## Frontend Conventions

### Feature modules

Each domain area is a lazy-loaded Angular module (`budgets`, `emails`, `members`, `units`, `users`). New features should follow the same pattern.

### API access

All HTTP calls go through `ApiService` (`core/services/api.service.ts`). It uses types from the auto-generated `core/api/openapi.ts`. **Never** use raw strings for API paths or invent types manually — always use the generated types.

### DataSource pattern

CRUD lists use the `CrudTableDataSource<T>` pattern with the shared `CrudTableComponent`. Implement a domain-specific datasource extending `CrudTableDataSource`.

### Authentication

- `AuthService` manages the Google token and the current user (`AuthUser`).
- `AuthInterceptor` automatically injects the Bearer token into HTTP requests.
- Use `AuthService.allowed$(action)` to conditionally show/hide UI elements based on user permissions.

### Reactive patterns

- Prefer `inject()` over constructor injection.
- Use `BehaviorSubject` for shared state, `Observable` for derived values.
- Always unsubscribe with `takeUntil(this._destroy$)` or `takeUntil(this.unauthenticated$)` in components.

---

## Code Style

### Go

- Follow `gofmt` (tabs, no line length limit enforced by tooling)
- 4-space equivalent indentation (via gofmt/tabs)
- Error wrapping: prefer `fmt.Errorf("context: %w", err)` or `juju/errors`

### TypeScript / Angular

- 2-space indentation
- Single quotes for strings
- No trailing whitespace, LF line endings (enforced by `.editorconfig`)
- Angular components use `OnPush` where possible; avoid unnecessary change detection cycles

---

## Auth Architecture

The application uses **Google OAuth** end-to-end:

1. The frontend (via `ngx-sign-in-with-google`) authenticates the user and obtains a Google access token.
2. The token is sent as a `Bearer` header on every API request (via `AuthInterceptor`).
3. The Go backend (`pkg/auth/google.go`) validates the token with Google's API and resolves the internal `auth.User`.
4. The `auth.User` is passed to all handlers for authorization checks.

To configure Google OAuth, set `auth.provider: google` and `auth_google.client_id` in the config file (or via `APP_AUTH_GOOGLE_CLIENT_ID` env var).

---

## Docker / Build

The `Dockerfile` uses multi-stage builds:

| Stage | Purpose |
|---|---|
| `frontend-devel` | Dev server for Angular (mounted volume) |
| `frontend-build` | Production build of Angular app |
| `server-devel` | Dev server for Go (mounted volume, `go run`) |
| `server-build` | Compiles Go binary, embeds built Angular dist |
| `final` | Minimal Alpine image with the Go binary |

The final Docker image serves both the API (`/api/`) and the Angular SPA from the embedded filesystem.
