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
├── models/                       # GORM models
├── pkg/
│   ├── auth/                     # OIDC sessions and transitional Google provider
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
| Auth provider | Server-side OIDC (`pkg/auth/oidc_*.go`); transitional Google provider |
| Configuration | `github.com/spf13/viper` + `github.com/spf13/cobra` |
| Logging | `github.com/sirupsen/logrus` |
| Email | Custom SMTP client in `pkg/smtp/` |
| Templating | `github.com/Masterminds/sprig/v3`, Go `text/template` |
| UUID | `github.com/google/uuid` |

**Go version:** 1.27.3 (Docker and CI use the version pinned in go.mod)

**Module path:** `github.com/rclsilver/asl-bissieux`

### Frontend (Angular)

| Concern | Library |
|---|---|
| Framework | Angular 22 (NgModules, lazy loading) |
| UI Components | Angular Material |
| HTTP | Angular `HttpClient` |
| Auth | Server-side OIDC session; transitional Google component |
| API types | Auto-generated from OpenAPI spec (`core/api/openapi.ts`) |
| Reactive state | RxJS (`BehaviorSubject`, `Observable`) |

**Node version (Docker and CI):** 24.22.0 (npm 11.19.1)
**Frontend root:** `./frontend/`

The Angular application builder uses esbuild/Vite. Keep `outputPath.browser`
empty so the Go binary embeds the assets directly from `dist/asl-bissieux`.
The dev proxy uses `/api/**` to forward nested API routes. Preserve explicit
`ChangeDetectionStrategy.Eager`, zone-based bootstrapping and `withXhr()`
until a separate change deliberately migrates those behaviors.

Frontend checks: `npm run test:unit`, `npm test` (Angular/Vitest with jsdom),
`npm audit --audit-level=high`, and `npm run build`.

---

## Development Workflow

### Prerequisites

Docker and Docker Compose (v2) are required.

### Start the full stack

```bash
docker compose up
```

This starts:
- `postgresql` — PostgreSQL 14 (no host port in public Compose; current private override uses 55432)
- `smtp-mock` — fake SMTP server for local email testing
- `server` — Go backend, runs via `go run main.go server -v`, port `8080`
- `frontend` — Angular dev server (`npm start`), port `4200`
- `swagger` — Swagger UI pointed at `http://localhost:8080/api/spec.json`
- `keycloak` — OIDC development realm, port 9080 (current private override selects Google instead)

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
- `models/` — GORM models; schema changes require a new versioned SQL migration
- `pkg/db/migrations/` — immutable, numbered SQL migrations embedded in the binary; never edit an applied migration or use AutoMigrate at startup
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

Add explicit `mapstructure` tags for fields whose configuration keys contain underscores.

### Database migrations

Use `database status`, `database baseline` and `database migrate` to manage the
schema. Existing unversioned databases require a backup and exact schema
verification before explicit baseline adoption. `db.migrate: true` applies
pending SQL versions at startup; false verifies that the schema is current.
Test migrations on a fresh database and a restored copy, verify data fingerprints,
and document backup/restore steps. Production migrations require separate authorization.

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
- In OIDC mode it restores a server-side cookie session; never store ID/access/refresh tokens in Angular.
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

Compose uses Keycloak with server-side Authorization Code + PKCE, state, nonce,
and an opaque browser session. Identity keys are `(issuer, subject)`; never
merge OIDC accounts by email. Application permissions always come from the
internal user row. Cookie-authenticated writes require Origin and CSRF checks.
Read README before changing login, logout, identity linking or session expiry.

The transitional **Google OAuth** mode remains the default outside Compose:

1. The frontend (via `ngx-sign-in-with-google`) authenticates the user and obtains a Google access token.
2. The token is sent as a `Bearer` header on every API request (via `AuthInterceptor`).
3. The Go backend (`pkg/auth/google.go`) validates the token with Google's API and resolves the internal `auth.User`.
4. The `auth.User` is passed to all handlers for authorization checks.

Successful transitional Google authentication captures the stable subject;
an established identity takes precedence over email. Preserve this migration
path until all existing production accounts have been explicitly migrated.

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

## Completed local features

The authenticated home is `/dashboard`, with explicit budget/year/reference selection,
monthly Europe/Paris collections, payment map, directory quality and bounded email
aggregates. Its access-request counter is administrator-only. See
`docs/tableau-de-bord.md` for scope and formulas. Financial corrections use the immutable
ledger (migration 0005), account decisions use explicit requests (0006); never mutate
those histories to implement a UI shortcut. See `docs/demarrage-local.md` for the current
machine's private network override versus the public Compose configuration.

OVH mailing-list targets use the shared Viper `ml` section (YAML, flags,
`APP_ML_DOMAIN`, `APP_ML_MEMBERS`, `APP_ML_BUREAU`). Client credentials use
standard process environment: `OVH_ENDPOINT`,
`OVH_APPLICATION_KEY`, `OVH_APPLICATION_SECRET`, `OVH_CONSUMER_KEY` for the
client.
Never expose credentials in API responses or logs. `member.bureau` (migration 0007)
is an explicit association role, independent of application admin. Only admins
can preview/apply list differences. OVH writes are asynchronous: pending tasks
block reapplication, and completion requires a fresh subscriber comparison.
See `docs/listes-diffusion-ovh.md`; no real OVH validation is claimed without
an actual configured secret.

Development Compose always points OVH_ENDPOINT at Smocker, with fixed dummy
OVH credentials and example.invalid/membres/bureau targets; never inherit real
OVH credentials from the host. Smocker mocks in dev/smocker proxy only the fake
list resources to dev/ovh-fixture, a development-only in-memory state server
with asynchronous tasks. Neither simulator is part of the production binary
or chart. The only app-specific mailing variables are APP_ML_DOMAIN,
APP_ML_MEMBERS, APP_ML_BUREAU; reuse standard OVH_* for client credentials/URL.
TEST_SMOCKER=1 runs the contract test on a disposable Smocker at 8280/8281
and isolated TEST_DATABASE_URL; never reset the developer's 8180/8181 instance.
