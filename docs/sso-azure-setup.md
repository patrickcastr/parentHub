# Azure Entra ID (Microsoft SSO) Setup Guide

> Target stack: Confidential client (server-side) — no PKCE. Session established by issuing `ph.sid` httpOnly cookie. Roles: email/password login stores UPPERCASE (`TEACHER` / `STUDENT`), Microsoft SSO stores lowercase (`teacher` / `student`).

## 1. Overview
This application supports Microsoft Entra ID (Azure AD) SSO for teacher / student access:
- User clicks **Sign in with Microsoft** (GET `/api/auth/login/microsoft`).
- Browser is redirected to Azure authorize endpoint.
- Azure redirects back to **single callback**: `/api/auth/azure/callback`.
- Server exchanges the code using client secret (confidential flow, no PKCE) and parses `id_token`.
- A session record is created in an in‑memory map and a `ph.sid` httpOnly cookie is set (lax in dev, secure/none in prod).
- `/api/auth/me` returns the authenticated user; casing reflects source auth:
  - Email login ⇒ `TEACHER` / `STUDENT`
  - Microsoft SSO ⇒ `teacher` / `student`

Legacy/alternate callbacks should be retired (301 to `/api/auth/azure/callback`).

## 2. Prerequisites
- Node.js 20+
- Postgres instance reachable by the API
- Azure portal access (target tenant) to create an App Registration

## 3. Azure App Registration (New Tenant)
1. Azure Portal → Azure Active Directory → App registrations → **New registration**
2. Name: `ParentHub Dev` (any)
3. Supported account types: *Single tenant* (or as required)
4. Redirect URI → Platform: **Web**
   - URI: `http://localhost:5180/api/auth/azure/callback`
5. Register.
6. Copy **Application (client) ID** and **Directory (tenant) ID**.
7. Certificates & secrets → **New client secret**. Copy secret **value** (only shown once).
8. API permissions → Add a permission → **Microsoft Graph** → **OpenID permissions**: ensure these default scopes are present:
   - `openid`
   - `profile`
   - `email`
   - (Add `offline_access` if you want refresh tokens — optional for current flow, but safe to keep.)
9. (Prod) Add your production HTTPS callback later (see section 8).

## 4. Environment Variables
Server reads ONLY non-`VITE_` variables. Add to root `.env` (gitignored):
```
AUTH_MS_ENABLED=1
AZURE_TENANT_ID=<tenant-guid>
AZURE_CLIENT_ID=<app-client-id>
AZURE_CLIENT_SECRET=<client-secret>
AZURE_REDIRECT_URI=http://localhost:5180/api/auth/azure/callback
POST_LOGIN_REDIRECT=http://localhost:5173/
```
`AUTH_MS_ENABLED`: any value except `0` enables SSO.

Ensure these appear in `.env.example` (they are already listed / updated).

## 5. Start & Verify
```bash
# Run the dev stack
pnpm dev  # or: npm run dev / yarn dev

# Check public config
curl -s http://localhost:5180/api/auth/config
# => {"msEnabled":true,"loginUrl":"/api/auth/login/microsoft"}

# Optional diagnostic
curl -s http://localhost:5180/api/auth/config/_diag | jq
# hasTenant/hasClient/hasSecret/hasRedirect should all be true
```
If `msEnabled` is false, re-check env values.

## 6. Test the Flow
1. Open `http://localhost:5173/login`.
2. Click **Sign in with Microsoft**.
3. Complete Azure login → redirected back to app.
4. Browser DevTools → Application → Cookies → Origin `http://localhost:5180` → **ph.sid** exists.
5. Verify API session:
```bash
curl -s http://localhost:5180/api/auth/me
# => {"id":"...","email":"user@domain","role":"teacher"}
```
Email/password login will still show role uppercase (`TEACHER`).

## 7. Switching Tenants
1. Create a new App Registration in the target tenant (repeat Section 3).
2. Update: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` (and optionally redirect if different).
3. Restart API.
4. Re-verify with `/api/auth/config` and `_diag`.

## 8. Production Configuration
Add production HTTPS redirect URI in Azure:
```
https://api.example.com/api/auth/azure/callback
```
Production `.env` sample:
```
AUTH_MS_ENABLED=1
AZURE_TENANT_ID=<prod-tenant-guid>
AZURE_CLIENT_ID=<prod-client-id>
AZURE_CLIENT_SECRET=<prod-secret>
AZURE_REDIRECT_URI=https://api.example.com/api/auth/azure/callback
POST_LOGIN_REDIRECT=https://app.example.com/
NODE_ENV=production
```
Cookie flags automatically become `secure: true` & `sameSite: 'none'` (requires HTTPS).

## 9. Troubleshooting
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `msEnabled:false` | Missing env var | Check `_diag` booleans; fill gaps |
| 500 `sso_config_missing` on login | Env names absent/mistyped | Confirm `AZURE_*` vars & flag not `0` |
| Callback 401 `token_exchange_failed` | Secret mismatch / wrong tenant | Regenerate secret; verify tenant in URL |
| `bad_id_token` | Azure response missing id_token | Ensure `openid profile email` scopes set |
| No `ph.sid` cookie | Cookie blocked or callback error | Check server logs; ensure redirect URI matches Azure exactly |
| Azure “redirect URI mismatch” | URI not exactly identical | Update Azure app + `AZURE_REDIRECT_URI` |
| Role casing unexpected | `/api/auth/me` normalizes? (now returns stored role) | Re-login; verify session creation path |

## 10. Multiple Providers / Tenants
Patterns:
- Parameterized tenant: build authorize URL using `?tenant=<tenantId>` and override base token/authorize endpoints dynamically.
- Distinct deployments per tenant with different env sets.
Keep a single callback path; 301 legacy callbacks to `/api/auth/azure/callback` if still referenced.

## 11. Security Notes
- Never commit real secrets (root `.env` is gitignored).
- Rotate client secrets regularly (calendar reminder).
- Limit redirect URIs to only dev + prod.
- Enforce HTTPS in production.
- Consider moving sessions from memory to Redis for scalability.

## 12. Reference Links
- Azure v2.0 OAuth endpoints: https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-auth-code-flow
- App registrations overview: https://learn.microsoft.com/azure/active-directory/develop/quickstart-register-app

### Code Pointers
| Purpose | File / Route |
|---------|--------------|
| Public config + diag | `server/api/auth.ts` (`/api/auth/config`, `/api/auth/config/_diag`) |
| Login redirect | `server/api/auth.ts` (`/api/auth/login/microsoft`) |
| Callback (confidential) | `server/api/auth.ts` (`/api/auth/azure/callback`) |
| Session issuance | `server/api/auth.ts` `setCookieSession` helper |
| Current user | `server/api/me.ts` (`/api/auth/me`) |
| Login page logic | `src/components/auth/Login.tsx` |

---
If anything drifts (e.g., reintroducing PKCE or adding nonce validation), update this doc accordingly.
