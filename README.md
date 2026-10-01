# Penny

A personal expense tracker built with React + TypeScript, Go, and MySQL. A quiet, responsive interface for knowing where your money went.

## Included

- Email/password sign-up, sign-in, persistent sessions, and sign-out.
- Nine default categories for each account; add, rename, recolor, and delete your own categories. Categories with expenses cannot be deleted until those expenses are moved or removed.
- Add, edit, and delete expenses with a description, exact INR amount, **expense date**, category, and optional notes.
- Day, month, year, inclusive custom dates, and all-time views. Previous/next period navigation.
- Totals, average expense, category breakdown, and day/month/year grouped totals.
- Search descriptions and notes, filter by category, and browse paginated results. Summaries and CSV exports cover **all matching expenses**, not just the current page.
- Mobile layout, keyboard-accessible dialogs, empty/loading/error states, and CSV export.
- MySQL for deployment; persistent SQLite for zero-setup local development.

No demo records are inserted into a new account. All money is INR in this first version; there is no currency conversion, bank linking, email verification, or password recovery. Keep your password in a password manager.

## Run locally

Requires Go 1.26+ and Node 22.12+ (Node 22 LTS recommended). From this folder on Windows:

```powershell
.\start.cmd
```

Open **http://localhost:8080**, select **Create account**, and start adding expenses. Stop the server with Ctrl+C. The startup script installs frontend packages on the first run, builds the frontend, then starts Go. Go downloads its dependencies on the first run.

Manual commands on any platform:

```sh
cd web
npm ci
npm run build
cd ..
go run ./cmd/server
```

On Windows PowerShell, use `npm.cmd` if your execution policy blocks `npm.ps1`.

With no database configuration, your local data is stored in `data/penny.db`. It survives restarts. To back it up, **stop the server first**, then copy the entire `data` folder. Never commit it to Git. SQLite is for local use; production refuses to start without MySQL configured.

The server loads `.env` automatically. Copy `.env.example` to `.env` when you want custom settings. Real environment variables take precedence. Never commit `.env`, credentials, or database files.

### React development with hot reload

Run `go run ./cmd/server` in one terminal, and `npm run dev` from `web` in another. Open the Vite URL (normally http://localhost:5173). Vite proxies `/api` to Go, so cookies remain same-origin. Leave `APP_ORIGIN` unset for local development.

### Use real MySQL locally

With Docker Desktop running:

```sh
docker compose up -d mysql
```

Copy `.env.example` to `.env`, uncomment its six local `DB_*` entries, then start the app. MySQL runs on **127.0.0.1:3307**, with database/user `penny` and local-only password `penny_local_only`.

Or run the entire stack in Docker:

```sh
docker compose up --build -d
```

Then open http://localhost:8080. Stop a separately running local server first so port 8080 is available. `docker compose down` preserves the database volume; **do not add `-v` unless you intend to erase it**.

Changing between SQLite and MySQL does not move existing records. Choose MySQL before collecting production data. CSV is an export, not an import or full account backup.

## Deploy for ₹0: Render + Aiven

The frontend is compiled and served by Go from the same origin. This needs only **one free Render web service plus one free Aiven MySQL service**, avoiding a separate frontend service and cross-site authentication configuration.

Free tiers have quotas and can change. Render sleeps free services after 15 minutes of inactivity; opening the app can take about a minute while it wakes. Aiven can power off inactive free databases. Use the free service URL, select only free plans, and do not enable paid upgrades. Check the provider dashboards for current quotas and billing behavior.

### 1. Create the free database

1. In Aiven, create **MySQL — Free** (not a paid trial plan).
2. Copy the service's host, port, database name, username, and password from the connection details. Use the supplied database name (commonly `defaultdb`).
3. Download the project CA certificate from the connection details.

### 2. Create the free web service

1. Put this project in a GitHub repository. Do not include `.env` or `data/`.
2. In Render, create a **Web Service**, connect that repository, and choose the **Docker** runtime and **Free** instance type.
3. If using this existing GoLang repository, set **Root Directory** to `expense-tracker`. If Penny is its own repository, leave Root Directory empty. The Dockerfile is `./Dockerfile` inside that root.
4. Set the health check path to `/api/health`.
5. Configure these environment variables before deploying:

| Variable | Value |
| --- | --- |
| `APP_ENV` | `production` |
| `APP_ORIGIN` | Your exact Render HTTPS URL, e.g. `https://your-penny-app.onrender.com` |
| `DB_HOST` | Aiven hostname, without a protocol |
| `DB_PORT` | Aiven port |
| `DB_NAME` | Aiven database name |
| `DB_USER` | Aiven username |
| `DB_PASSWORD` | Aiven password |
| `DB_TLS` | `true` |
| `DB_CA_CERT` | Entire CA certificate PEM text, including BEGIN/END lines and newlines |

Alternatively upload the CA as a Render secret file named `ca.pem`, set `DB_CA_FILE=/etc/secrets/ca.pem`, and leave `DB_CA_CERT` unset. The certificate and hostname are verified; there is no insecure TLS bypass.

Render provides `PORT` automatically. If the final URL differs from the initially chosen service name, update `APP_ORIGIN` to match it exactly and redeploy. The app may reject writes until the origin matches.

6. Deploy. The app initializes its schema on startup. Open the HTTPS URL and create your own account.
7. Add a small test expense, edit its date to last month, verify the monthly report, and export CSV. Sign out and back in to verify the account.

`render.yaml` is also provided for a Blueprint deployment when this folder is the repository root. Enter the same secret values when prompted. This project does not create paid services or connect any accounts automatically.

Provider documentation: [Render free services](https://render.com/docs/free), [Docker on Render](https://render.com/docs/docker), [Aiven free MySQL](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier), [Aiven TLS](https://aiven.io/docs/platform/concepts/tls-ssl-certificates).

## Verification

```sh
go test ./... -count=1
go vet ./...
cd web
npm test
npm run build
npm audit
```

Backend tests exercise real database operations through HTTP handlers: authentication/session expiry, password/session hashing, cross-account isolation, category lifecycle, exact amounts, leap-day/year/custom boundaries, search, pagination, exports, CSRF checks, and rate limiting. They use temporary SQLite databases by default.

To run the same contract suite against **a disposable MySQL database**, set `TEST_MYSQL=1` and the local `DB_*` environment variables, then run `go test ./internal/app -count=1`. Tests create accounts and records; **never point them at a real personal database**. Production/TLS settings also apply if `APP_ENV=production` is set. Environment variables are needed for tests; `.env` is loaded only by the server executable.

`scripts/smoke.mjs` also checks a real running HTTP server (including built frontend assets). Set `PENNY_TEST_URL=http://127.0.0.1:8081` to a disposable local instance, then run `node scripts/smoke.mjs`. It creates test accounts and refuses non-local targets.

Delivery verification: backend tests passed with SQLite and MySQL 8.4; frontend date tests and production build passed; Go static checks passed; npm reported zero known vulnerabilities; the Docker image built successfully; the HTTP smoke workflow passed against the Docker app and MySQL. Browser automation was unavailable in the build session, so visual layout and interactive browser behavior still need a manual check. No cloud services have been provisioned or deployed.

## Implementation notes

- Passwords use bcrypt; the API accepts 10+ characters and at most 72 UTF-8 bytes.
- Opaque 256-bit random session tokens are hashed before database storage, expire after 30 days, and are revoked at sign-out. Cookies are HttpOnly, SameSite=Lax, and Secure in production.
- Mutation requests require same-origin browser access and JSON content types. No cross-origin API access is enabled.
- All user-data queries are scoped to the authenticated account and use SQL parameters. Authentication attempts are rate limited in memory, per email and remote peer. Behind Render's proxy, the peer limit may apply across users; this is intended for a small personal app, not a large public service.
- Money is stored as integer paise; input is parsed without floating-point arithmetic. Reports use a validated `YYYY-MM-DD` calendar date, separate from the creation timestamp.
- Indexes support account/date queries. MySQL uses verified TLS and a small connection pool; SQLite enables foreign keys and WAL.
- Schema initialization is idempotent for this first version. Future schema changes need explicit versioned migrations.
- No password reset/email verification is included. Registration is open to anyone who can access the deployment. There are no analytics, advertisements, or external fonts.
- CSV fields neutralize spreadsheet formulas. Exports reflect the current date/category/search filters and include every matching page.

## Project layout

```text
cmd/server/       HTTP server startup, configuration, graceful shutdown
internal/app/     Auth, database setup, categories, expenses, reports, tests
web/src/          React UI, responsive styles, date helpers and tests
Dockerfile        Production multi-stage build
compose.yaml      Local MySQL and optional full-stack containers
render.yaml       Free Render service blueprint
```
