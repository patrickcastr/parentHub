# Parent Hub v3

This project provides a skeleton implementation of the "Parent Hub" portal described in Patrick's ideas. It uses **Next.js 14** with the **app router** and TypeScript.  It is designed to run server‑side in a Node.js environment and integrates with Azure services for persistent storage.

## Features

* **Email‑based OTP authentication** for parents/students (no Microsoft login required).  Verification codes are stored in Azure Table Storage and sent via SMTP.
* **Optional Single Sign On** for teachers via Azure AD (NextAuth).
* **Role‑aware navigation**: Teachers and Students each see relevant sections; teachers access group & student management, students see their portal.
* **Teacher console**:
  * Create and manage groups (with start dates).
  * Add or import students (CSV) and assign/unassign groups (with future start date override).
  * Upload files to Azure Blob Storage under a group folder.
  * View student directory and group memberships.
* **Student portal** to list assigned groups and download files.  All file downloads are signed with a short‑lived SAS token and recorded in an audit log.
* Lightweight **rate limiting and CAPTCHA** for OTP requests to mitigate abuse.
* A **daily cleanup endpoint** to disable expired memberships and purge groups past their expiry.

## Running locally

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in the values for your Azure Storage account, SMTP provider, Azure AD app (for teacher SSO) and CAPTCHA provider if using one.

3. Run the development server:

```bash
npm run dev
```

4. Open <http://localhost:3000> in your browser.

## Deployment

This app can be deployed to Azure Static Web Apps, Vercel, Cloudflare Pages or any platform supporting Next.js 14 with the **app** directory.  You must provide environment variables at build and runtime.

## Notes

This repository contains **skeleton** implementations of the API routes and pages.  The core integration points for Azure Table Storage, Azure Blob Storage, email delivery and SSO are provided as examples.  You will need to adjust the code to suit your specific requirements and handle edge‑cases (error handling, validation, etc.).  Sensitive keys should **never** be committed to the repository.

## Microsoft Entra ID (Azure AD) SSO

Full, living setup guide: [docs/sso-azure-setup.md](./docs/sso-azure-setup.md)

Quick env sketch (dev vs prod) — refer to the guide for explanations:

```
# Dev
AUTH_MS_ENABLED=1
CLIENT_APP_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:5180
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=your-client-secret
AZURE_REDIRECT_URI=http://localhost:5180/api/auth/azure/callback
POST_LOGIN_REDIRECT=http://localhost:5173/

# Prod
AUTH_MS_ENABLED=1
CLIENT_APP_ORIGIN=https://app.parenthub.nz
VITE_API_URL=https://api.parenthub.nz
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=prod-secret
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

## Future Hardening
* Replace in-memory session store with Redis for horizontal scaling.
* Rotate and hash session IDs server-side.
* Add nonce validation for ID token; currently minimal validation for dev.
* Enforce role provisioning (teachers vs students) centrally.