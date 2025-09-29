# Parent Hub

Unified portal for teachers & students: study group management, secure file distribution, and SSO / email-based authentication. Backend (Express + Prisma + Postgres) lives in `server/`; frontend (React + Vite) in `src/` (future separation into `web/`).

## High-Level Architecture
| Layer | Tech | Responsibility |
|-------|------|----------------|
| Frontend + API (Unified) | React (Vite) + Express (TS) | Single container: API under /api, static SPA + runtime config |
| Database | PostgreSQL via Prisma | Core relational data |
| Object Storage | Azure Blob | File objects (SAS signed) |
| Email | SMTP | OTP + notifications |
| Sessions / OTP (dev) | In-memory | Replace with Redis in prod |

## Feature Summary
* Email OTP auth + Azure Entra (AD) SSO (teacher role) with role-aware nav.
* Group & student CRUD, CSV import, future-dated membership handling.
* File upload/download with SAS + access logging.
* Rate limiting + CAPTCHA (hCaptcha) for OTP endpoints.
* Diagnostics endpoints for SSO env visibility.

## Quickstart
```bash
git clone <repo>
cd parentHub
npm install
cd server && npm install && cp ../.env.example .env  # fill values
npx prisma migrate dev --name init || true
npm run dev        # API :5180
cd .. && npm run dev  # Frontend (Vite) :5173
```
Visit: http://localhost:5173/

## Deployment Matrix (Examples)
| Concern | Dev / Simple | Hardened / Prod |
|---------|--------------|-----------------|
| Unified App (API+Web) | Single Cloud Run service | Split later if scaling profiles diverge |
| DB | Neon / Supabase | Azure Postgres Flexible Server |
| Sessions | In-memory | Redis / Azure Cache |
| OTP Store | In-memory | Table Storage / Redis |
| Files | Azure Blob | Blob + lifecycle rules |
| CDN | None | Cloudflare / Front Door |

## Docs Index
| Path | Purpose |
|------|---------|
| `README.md` | Overview & onboarding |
| `server/README.md` | Backend routes, env & deploy |
| `web/README.md` | Frontend env & build (placeholder) |
| `docs/sso-azure-setup.md` | Detailed SSO setup guide |

## Environment (Minimal Core)
```
DATABASE_URL=postgresql://...
AZURE_STORAGE_CONNECTION_STRING=...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_REDIRECT_URI=http://localhost:5180/api/auth/azure/callback
POST_LOGIN_REDIRECT=http://localhost:5173/
AUTH_MS_ENABLED=1
BCRYPT_SALT_ROUNDS=12
```

## Workflows
* Build backend: `cd server && npm run build`
* Run smoke password hash: `npm run smoke:hash` (server)
* SSO env check: `curl http://localhost:5180/api/auth/config`

## Roadmap (Abbrev)
* Redis session/OTP store; structured logging; object lifecycle purge.
* Multi-tenant boundary (teacher org isolation) & RBAC refinements.
* Optional file antivirus scan integration.

---
Below: quick SSO reference (see dedicated doc for details).

## Microsoft Entra ID (Azure AD) SSO (Quick Reference)

Full, living setup guide: [docs/sso-azure-setup.md](./docs/sso-azure-setup.md)

Quick env sketch (dev vs prod) — refer to the guide for explanations:

```
# Dev
AUTH_MS_ENABLED=1
CLIENT_APP_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:5180
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=<client-secret>
AZURE_REDIRECT_URI=http://localhost:5180/api/auth/azure/callback
POST_LOGIN_REDIRECT=http://localhost:5173/

# Prod
AUTH_MS_ENABLED=1
CLIENT_APP_ORIGIN=https://app.parenthub.nz
VITE_API_URL=https://api.parenthub.nz
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=<prod-client-secret>
AZURE_REDIRECT_URI=https://api.parenthub.nz/api/auth/azure/callback
POST_LOGIN_REDIRECT=https://app.parenthub.nz/
```

Notes:
* Confidential client flow (no PKCE) — server exchanges code with `client_secret`.
* Canonical callback path: `/api/auth/azure/callback`.
* Public config endpoint: `GET /api/auth/config` → `{ msEnabled, loginUrl }`.
* Diagnostic env check: `GET /api/auth/config/_diag` (masked values; do **not** expose publicly in prod).
* Role casing: email/password sessions store uppercase roles; Microsoft SSO stores lowercase.

### Minimal Test Plan
1. Start API (5180) & SPA (5173).
2. Hit `GET /api/auth/config` → `msEnabled:true`.
3. Click **Sign in with Microsoft** → authenticate → redirected.
4. Confirm `ph.sid` cookie set for API origin.
5. `GET /api/auth/me` returns user JSON with lowercase role (e.g. `teacher`).
6. Clear cookie → `GET /api/auth/me` returns 401 (`authenticated:false`).

### Common Issues
| Symptom | Cause | Fix |
|---------|-------|-----|
| `msEnabled:false` | Missing / misnamed env | Compare with guide & `_diag` |
| 500 on callback | Wrong secret / tenant | Regenerate secret; verify IDs |
| No `ph.sid` cookie | Redirect mismatch or cookie flags | Ensure callback path matches Azure; dev uses non-secure cookie |
| Role casing surprise | Different auth source | Working as designed (see guide) |

## Future Hardening (Security Focus)
* Redis or KeyDB for session + OTP store.
* Session ID hashing & rotation.
* Nonce + state strict enforcement for SSO.
* Fine-grained audit logging & retention policies.
* Automate stale file purging & archival.

## Deployment Environment & Secrets (Cloud Run / Cloud Build)

Minimal recommended separation between Cloud Run environment variables and Secret Manager secrets:

Secrets (managed in Secret Manager & injected with --set-secrets):
```
DATABASE_URL            # Postgres / Neon connection string
AZURE_CLIENT_SECRET     # Microsoft Entra application client secret
# JWT_SECRET            # (Create if/when JWT signing needed)
```

Plain environment variables (safe to appear in service config):
```
AZURE_CLIENT_ID
AZURE_TENANT_ID
AZURE_STORAGE_ACCOUNT
AZURE_STORAGE_CONTAINER
AUTH_MS_ENABLED=1|0
COMMIT_SHA (injected by Cloud Build)
BUILD_ID   (injected by Cloud Build)
AZURE_REDIRECT_URI (required when AUTH_MS_ENABLED=1)
CLIENT_APP_ORIGIN (only if a separate origin is actually used)
```

Optional secret-izing of storage identifiers (not usually necessary):
```
PARENTHUB_AZURE_STORAGE_ACCOUNT
PARENTHUB_AZURE_STORAGE_CONTAINER
```

### Cloud Build Deploy Snippet (Resulting Pattern)
```
gcloud run deploy parenthub-app \
	--image=gcr.io/$PROJECT_ID/parenthub-app:$TAG \
	--set-env-vars=AZURE_CLIENT_ID=...,AZURE_TENANT_ID=...,AZURE_STORAGE_ACCOUNT=...,AZURE_STORAGE_CONTAINER=...,AUTH_MS_ENABLED=1,COMMIT_SHA=$COMMIT_SHA,BUILD_ID=$BUILD_ID \
	--set-secrets=AZURE_CLIENT_SECRET=PARENTHUB_AZURE_CLIENT_SECRET:latest,DATABASE_URL=PARENTHUB_DB_URL:latest \
	--revision-suffix=rev-$BUILD_ID
```

Smoke test in Cloud Build uses `SKIP_MIGRATIONS=1` so it does not need database secrets just to verify static serving & health.

### Why Not All Secrets?
Account IDs, tenant IDs, and container names are identifiers, not credentials. Keeping only true secrets in Secret Manager reduces operational friction while preserving security. If policy requires centralizing everything, you can promote those env vars to secrets later without code changes.
