# Web Frontend (Placeholder)

The current frontend lives under `src/` (Vite + React + TypeScript). This `web/` directory is a placeholder for future separation (e.g., if migrating to Next.js, Astro, or splitting concerns).

## Stack (current state in `src/`)
- React + TypeScript
- React Query (data fetching + caching)
- Tailwind CSS utilities
- Vite dev & build pipeline

## Dev Quickstart
```bash
npm install
npm run dev  # root script starts Vite on :5173 (proxy to API :5180)
```

## Environment Variables (Client)
Client-exposed vars must be prefixed with `VITE_`.

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Base URL for API (proxy or absolute) |

Example `.env` (root) snippet:
```
VITE_API_URL=http://localhost:5180
```

## Auth Flow (Summary)
1. On load, client calls `/api/auth/config` to determine if Microsoft SSO is enabled.
2. If signed out, SSO button uses `loginUrl` from that config.
3. After callback, `/api/auth/me` returns user (role casing: lowercase for SSO, uppercase for email dev login).

## Building
```bash
npm run build   # Emits production assets (dist/)
```
Deploy the static bundle behind a CDN pointing `VITE_API_URL` to deployed API origin.

## Future
- Extract shared UI primitives into a design system package.
- Add e2e tests (Playwright) and component tests (Vitest / React Testing Library).
- Optional migration to Next.js app router if SSR/edge becomes required.
