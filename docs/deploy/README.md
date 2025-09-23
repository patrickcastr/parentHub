# ParentHub Deploy (prod)

## Branch strategy
- `main` = dev
- `prod` = production (triggers deploy)

## Triggers
- Frontend → `cloudbuild.web.yaml`
- API → `cloudbuild.api.yaml`
- Both watch `^prod$`

## Secrets required
Create once in GCP Secret Manager:

### Frontend
- VITE_API_BASE_URL
- VITE_MSAL_ENABLED
- VITE_MSAL_CLIENT_ID
- VITE_MSAL_AUTHORITY
- VITE_MSAL_REDIRECT_URI

### API
- FRONTEND_ORIGIN
- AUTH_ALLOWED_ORIGIN
- AUTH_REDIRECT_URI
- ENTRA_TENANT_ID
- ENTRA_CLIENT_ID
- ENTRA_CLIENT_SECRET
- SESSION_SECRET
- DATABASE_URL
- DIRECT_URL

Grant Cloud Build service account `roles/secretmanager.secretAccessor`.

## Deploy order
1. API trigger → build, run Prisma migrate, deploy.
2. Frontend trigger → build with envs, deploy.
3. Test:
   - `GET https://<API>.a.run.app/api/health`
   - Browser login (password + Microsoft SSO)

## Sanity check CORS
```bash
curl -i -X OPTIONS "https://<API>.a.run.app/api/auth/login" \
  -H "Origin: https://<FRONTEND>.a.run.app" \
  -H "Access-Control-Request-Method: POST"
```

Expect Access-Control-Allow-Origin: https://<FRONTEND>.a.run.app.

---

## 4) Commit message

ci: add Cloud Build configs for prod (frontend + api), Secret Manager env binding, deploy docs

---

✅ After this, set up **two Cloud Build triggers** on `^prod$`:  
- **Frontend** → `cloudbuild.web.yaml`  
- **API** → `cloudbuild.api.yaml`  
