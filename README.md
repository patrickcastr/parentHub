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

## Microsoft Entra ID (Azure AD) SSO Setup

Environment variables (dev vs prod):

```
# Dev
CLIENT_APP_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:5180
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=your-client-secret
AZURE_REDIRECT_URI=http://localhost:5180/api/auth/callback/microsoft
POST_LOGIN_REDIRECT=http://localhost:5173/
COOKIE_SAMESITE=lax
COOKIE_SECURE=false

# Prod
CLIENT_APP_ORIGIN=https://app.parenthub.nz
VITE_API_URL=https://api.parenthub.nz
AZURE_REDIRECT_URI=https://api.parenthub.nz/api/auth/callback/microsoft
POST_LOGIN_REDIRECT=https://app.parenthub.nz/
COOKIE_SAMESITE=none
COOKIE_SECURE=true
```

Azure App registration:
* Redirect URIs include both dev & prod callback URLs.
* Expose scopes: openid profile email offline_access.
* Enable PKCE (S256) – implemented in `/api/auth/login/microsoft`.
* Add SPA origins (localhost:5173, production app domain) to CORS / redirect settings.

## Test Plan (SSO)

1. Start API (port 5180) and SPA (port 5173); verify `GET /api/health` returns `{ ok: true }`.
2. In SPA click “Sign in with Microsoft”; complete Entra login.
3. On redirect back, confirm `ph.sid` cookie is present (DevTools → Application → Cookies for API origin).
4. Call `GET /api/auth/me` – expect 200 with JSON user `{ id, email, role }`.
5. Visit `GET /api/auth/debug` – expect `hasCookie:true`, `hasStore:true`, `inStore:true`.
6. Hard refresh SPA – `GET /api/auth/me` still 200.
7. Log out (or clear cookie) – `GET /api/auth/me` now 401.

Troubleshooting:
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 401 + no cookie | Callback failed to `res.cookie` | Inspect server logs; ensure CORS allows origin and cookie flags not too strict |
| Cookie present, 401 | Session map lost (server restart) | Re-login; persist with Redis in future |
| CORS error | Origin not in allow-list | Update `CLIENT_APP_ORIGIN` / CORS config in `server/app.ts` |
| State mismatch | Stale / missing state cookie | Ensure browser sends `ph.ms.state`; check clock skew |
| ECONNREFUSED | Wrong proxy / port | Confirm Vite proxy targets `http://127.0.0.1:5180` |

## Future Hardening
* Replace in-memory session store with Redis for horizontal scaling.
* Rotate and hash session IDs server-side.
* Add nonce validation for ID token; currently minimal validation for dev.
* Enforce role provisioning (teachers vs students) centrally.