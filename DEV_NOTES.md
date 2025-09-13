# Dev Notes

Iteration: Added TailwindCSS + shadcn-style UI components (Button, Card, Input, Table), created Home and Teacher Admin pages with modern styling.

Migration start: Preparing to rebuild as Vite React TS app (GreenSchool Student Hub). Will replace Next.js specific configs with Vite.

## Storage Import Audit (2025-09-09)

File | Import Specifier | Named Imports | Status
---- | ---------------- | ------------- | ------
server/api/groups.ts | ../storage/storage-groups | buildGroupPrefix, ensureGroupFolder | OK (canonical)
server/api/groups.ts | ../services/storage-groups | deletePrefixRecursive | Legacy (pending migration)
server/api/debug-storage.ts | ../storage/storage-groups | buildGroupPrefix, ensureGroupFolder | OK
server/scripts/backfill-group-folders.ts | ../storage/storage-groups | buildGroupPrefix, ensureGroupFolder | OK
server/prisma/seed.ts | ../storage/storage-groups | buildGroupPrefix, ensureGroupFolder | OK
server/api/group-files.ts | ../storage/azure-blob | list via containerClient, initUpload, deleteObject | OK (canonical)
server/index.ts | ./storage/azure-blob | initStorage | OK
server/api/files.azure.ts | ../storage/azure-blob | initUpload, getDownloadUrl, moveObject, deleteObject | OK
server/api/_debug.storage.ts | ../storage/azure-blob | containerClient | OK
server/scripts/smoke-provision.ts | ../storage/azure-blob | containerClient, createFolderMarker, buildBlobKey | OK

Canonical modules:
- Blob provider: `server/storage/azure-blob.ts`
- Group helpers: `server/storage/storage-groups.ts`

Legacy module (to retire): `server/services/storage-groups.ts` (no active route references remaining)

Next cleanup steps:
1. Remove `deletePrefixRecursive` usage (if still needed) or re-implement in canonical helper.
2. Delete deprecated `server/services/storage-groups.ts` after confirming scripts/tests unaffected.
3. Re-run `npx tsc -p tsconfig.server.json --noEmit` to confirm no drift.

## Dev Auth Bypass (Email/Password)

For fast local iteration we support a temporary email/password login endpoint:

POST /api/auth/login { email, password, remember }

Activation requires setting `ALLOW_DEV_PASSWORD=1` in your `.env`. When enabled:

* The static password `devpass` grants a session cookie `ph.sid` (HttpOnly, sameSite=lax, secure only in prod, 1h or 30d with remember).
* (Optional) Provide a custom bcrypt hash in `DEV_LOGIN_HASH` to use a private password instead of the shared `devpass`. If both are present and the submitted password matches the static value, the static path wins (simple precedence is acceptable for now).
* Without `ALLOW_DEV_PASSWORD=1` the endpoint returns 404 to reduce surface area.
* Intended only for local development; do NOT enable in production.

Cookie name rationale: `ph.sid` (namespace + short) to avoid collisions with any future auth systems.

Future: Replace with proper session/JWT issuance and user table.

