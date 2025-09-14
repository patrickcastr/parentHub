# Server (Backend API)

Express + TypeScript API powering authentication, groups, students, and file metadata / access logging. Uses Prisma + PostgreSQL.

## Stack
| Area | Tech |
|------|------|
| Runtime | Node 20 |
| Framework | Express 4 + custom routers |
| ORM | Prisma Client |
| DB | PostgreSQL (any compatible host) |
| Auth | Email OTP + Azure Entra ID (confidential flow) |
| Sessions | In-memory map (cookie `ph.sid`) |
| Hashing | bcryptjs (SALT_ROUNDS env) |
| File Storage | Azure Blob (SAS signed URLs) |

## Directory Pointers
| Path | Description |
|------|-------------|
| `app.ts` | Express app bootstrap (CORS, routes, diagnostics) |
| `api/auth.ts` | Auth & SSO endpoints, session issuance |
| `api/students.ts` | Student CRUD, password changes, CSV import |
| `prisma/schema.prisma` | Data models (Group, Student, File, etc.) |
| `prisma/seed*.ts` | Seed scripts (students, auth users) |

## Key Models (Prisma)
| Model | Highlights |
|-------|-----------|
| `User` | `email`, `role` (STUDENT/TEACHER), optional `passwordHash` |
| `Group` | `name`, `slug?`, `startsOn/endsOn`, `storagePrefix` unique |
| `Student` | `firstName/lastName`, `username`, `email`, `groupId?` |
| `File` | `key`, `url`, `status`, `groupId`, soft archive fields |
| `FileAccessLog` | `fileId`, `action`, `ip`, `userAgent` |

See schema for indexes & relations.

## Auth Endpoints (Selected)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Dev/email password login (guarded by flags) |
| GET | `/api/auth/login/microsoft` | Redirect to Azure authorize (confidential) |
| GET | `/api/auth/azure/callback` | Handle code, exchange token, set session |
| GET | `/api/auth/config` | Public SSO enable + login URL |
| GET | `/api/auth/me` | Current user / session status |

## Student & Group (Representative)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/students` | List/search students |
| POST | `/api/students` | Create student (hash password) |
| PATCH | `/api/students/:id` | Update profile / rotate password |
| POST | `/api/groups` | Create group |
| GET | `/api/groups` | List groups |

## Environment Variables (Core)
| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection string |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob access (uploads & SAS) |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | Entra ID confidential client (placeholder values only in docs) |
| `AZURE_REDIRECT_URI` | Callback (e.g. http://localhost:5180/api/auth/azure/callback) |
| `POST_LOGIN_REDIRECT` | Where frontend should land after auth |
| `AUTH_MS_ENABLED` | Toggle SSO button/config |
| `ALLOW_DEV_PASSWORD` | Enables dev password login route |
| `DEV_LOGIN_HASH` | Optional bcryptjs hash overriding static dev pass |
| `BCRYPT_SALT_ROUNDS` | Hashing cost factor (default 12) |

## Local Development
```bash
cd server
npm install
cp ../.env.example .env  # fill values
npx prisma migrate dev --name init
npm run dev
```
API default port: 5180 (adjust via `PORT` env for production).

## Build & Run (Prod Image Pattern)
Dockerfile uses multi-stage (deps → build → runtime) on `node:20-alpine`.
```bash
docker build -t parenthub-api .
docker run -p 5180:8080 --env-file .env parenthub-api
```

At start the container applies `prisma migrate deploy` then serves `dist/app.js`.

## Seeding
```bash
npm run seed           # general seed
npm run seed:students  # sample students
npm run seed:auth-users
```

## Password Hashing
Uses `bcryptjs` (pure JS) for portability on Alpine. Cost factor tunable with `BCRYPT_SALT_ROUNDS` (12 recommended baseline).

## Security Notes
* Session IDs currently stored in-memory (single instance). For multi-instance, externalize to Redis.
* Add a nonce & state validation on SSO callback for production (baseline present but can be hardened further).
* Consider output encoding & strict CSP headers once frontend is static hosted.

## Operational Hardening (Future)
| Area | Next Step |
|------|----------|
| Sessions | Redis with TTL & rotation |
| Audit | Structured logs + retention tasks |
| Files | Malware scan & checksum record |
| Secrets | Managed store (Azure Key Vault) |
| Scaling | Horizontal pod autoscaling with shared session backend |

## Troubleshooting
| Symptom | Likely Cause | Action |
|---------|--------------|--------|
| 401 after SSO | Missing cookie or session lost | Inspect `Set-Cookie`, ensure sameSite setting |
| 500 on login redirect | Env vars incomplete | Hit `/api/auth/config/_diag` |
| Slow hashing | Very high rounds | Lower `BCRYPT_SALT_ROUNDS` in dev |

---
For SSO specifics see root `docs/sso-azure-setup.md`.
