// app.ts
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import groups from './api/groups';
import filesAzureRouter from './api/files.azure';
import { studentsRouter } from './api/students';
import storageDebug from './api/_debug.storage';
import debugStorageRoutes from './api/debug-storage';
import groupFilesRoutes from './api/group-files';
import { log } from './logger';
import storageRouter from './api/storage';
import authRouter from './api/auth';
import meRouter from './api/me';
import studentPortalRouter from './api/studentPortal';
import { prisma } from './prisma/client';
import { requireAuth } from './auth/jwt';
import { URL } from 'url';

// import using require to avoid transient TS resolution issue; tolerate absence in test env
let diag: any = (req: any, res: any, next: any) => next();
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  diag = require('./diag').default;
} catch {}

export const app = express();

// Trust reverse proxy (Cloud Run / Ingress) so secure cookies & samesite work
app.set('trust proxy', 1);

// One-line masked Microsoft auth env summary (startup)
{
  const mask = (v: string) => (v ? `${v.slice(0, 6)}…${v.slice(-4)}` : '');
  /* eslint-disable no-console */
  console.log('[AUTH] env:', {
    msEnabledFlag: (process.env.AUTH_MS_ENABLED ?? '1') !== '0',
    hasTenant: !!process.env.AZURE_TENANT_ID,
    hasClient: !!process.env.AZURE_CLIENT_ID,
    hasSecret: !!process.env.AZURE_CLIENT_SECRET,
    hasRedirect: !!process.env.AZURE_REDIRECT_URI,
    tenant: mask(process.env.AZURE_TENANT_ID || ''),
    client: mask(process.env.AZURE_CLIENT_ID || ''),
    redirect: process.env.AZURE_REDIRECT_URI || '',
    nodeEnv: process.env.NODE_ENV || 'development',
  });
  /* eslint-enable no-console */
}

// CORS (strict allow-list) BEFORE any routes
const CLIENT_ORIGIN = process.env.FRONTEND_ORIGIN || process.env.CLIENT_APP_ORIGIN || 'http://localhost:5173';
const extraOrigins = [CLIENT_ORIGIN, CLIENT_ORIGIN.replace('localhost', '127.0.0.1')];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // non-browser / same-origin
      if (extraOrigins.includes(origin)) return cb(null, true);
      // Allow any Vite auto-bumped localhost:51xx port in dev
      if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:51\d{2}$/.test(origin))
        return cb(null, true);
      return cb(new Error('CORS blocked'), false);
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Development DB visibility self-check
if (process.env.NODE_ENV !== 'production') {
  console.log('[DB] API DATABASE_URL =', process.env.DATABASE_URL);
  (prisma as any)
    .user.count()
    .then((c: number) => console.log('[DB] API sees User count =', c))
    .catch((err: any) => console.error('[DB] startup check failed', err));
}

// Auth bypass (dev only)
const BYPASS_AUTH = process.env.AUTH_BYPASS === '1';
const IS_PROD = process.env.NODE_ENV === 'production';
if (!IS_PROD && BYPASS_AUTH) {
  console.warn('[dev] AUTH_BYPASS enabled: auth middleware is disabled.');
  // Provide a stub /api/me early (before protected route definition below)
  app.get('/api/me', (_req, res) => {
    res.json({
      id: 'dev-user',
      email: 'dev@example.com',
      role: 'TEACHER',
      name: 'Developer Mode',
      student: null,
    });
  });
}

// static uploads dir
const uploadsDir = path.join(process.cwd(), 'server', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Routers
app.use('/api', groups);
app.use('/api', storageDebug);
app.use('/api/debug', debugStorageRoutes);
app.use('/api/groups', groupFilesRoutes);
app.use('/api', storageRouter);
app.use('/api/students', studentsRouter);
app.use('/api/auth', authRouter);
if (process.env.NODE_ENV !== 'production') console.log('[AUTH] router mounted at /api/auth');
app.get('/api/auth/debug', (req, res) => {
  const sid = req.cookies?.['ph.sid'];
  const store: Map<string, any> | undefined = (global as any).__SESS;
  res.json({
    hasCookie: Boolean(sid),
    sid,
    hasStore: Boolean(store),
    inStore: sid ? Boolean(store?.get(sid)) : false,
  });
});
app.use('/api', meRouter);

// Simple session-based auth middleware (defense in depth for API)
// Public allow-list so health and auth entry points can bypass session checks
const PUBLIC_PATHS = new Set<string>([
  '/api/health',
  '/api/auth/login',
  '/api/auth/callback',
  '/api/auth/login/microsoft',
  '/api/auth/azure/callback',
  '/api/auth/config',
  '/api/auth/config/_diag',
]);

function authRequired(req: any, res: any, next: any) {
  if (PUBLIC_PATHS.has(req.path)) return next();
  const sid = req.cookies && req.cookies['ph.sid'];
  const store: Map<string, any> | undefined = (global as any).__SESS;
  if (!sid || !store || !store.get(sid)) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

// Student portal (must be after auth routes so session cookie parsed)
app.use('/api/student', (req, res, next) => authRequired(req, res, next), studentPortalRouter);
app.use('/api/diag', diag);

// lightweight db check (group count)
app.get('/api/_dbcheck', async (_req, res) => {
  try {
    const groups = await prisma.group.count();
    res.json({ ok: true, groups });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Apply after public auth + health routes
app.use('/api/students', authRequired);
app.use('/api/groups', authRequired);
app.use('/api/debug', authRequired);
app.use('/api', authRequired, filesAzureRouter);

// Log DB host
if (process.env.DATABASE_URL) {
  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`[db] host=${u.hostname} db=${u.pathname.slice(1)} provider=postgresql`);
  } catch {}
}

log.info(
  { account: process.env.AZURE_STORAGE_ACCOUNT, container: process.env.AZURE_STORAGE_CONTAINER },
  '[storage] config'
);

// GET /api/me (protected when not bypassing)
if (IS_PROD || !BYPASS_AUTH)
  app.get('/api/me', requireAuth, async (req: any, res) => {
    const claims = req.auth || {};
    const email: string | undefined = claims.emails?.[0] || claims.preferred_username;
    const name: string = claims.name || email || 'User';
    let student = null;
    if (email) {
      student = (await prisma.student.findUnique({ where: { email } })) as any;
    }
    const role = student ? 'STUDENT' : 'TEACHER';
    let groupName: string | null = null;
    if (student?.groupId) {
      const g: any = await (prisma as any).group.findUnique({ where: { id: student.groupId } });
      groupName = g?.name || null;
    }
    res.json({
      name,
      email,
      role,
      student: student ? { id: student.id, groupId: student.groupId, groupName } : null,
    });
  });

// simple public health endpoint (before protected routes)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'parenthub-api',
    revision: process.env.K_REVISION || 'local',
  });
});
app.get('/health', (_req, res) => res.json({ ok: true }));

// generic error handler - surface zod/prisma messages as JSON
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    const status = err?.status || 400;
    res.status(status).json({ error: err?.message || 'Unexpected error' });
  }
);

// -------------------------------
// ✅ LISTEN HERE (fix for Cloud Run)
// -------------------------------
const port = Number(process.env.PORT) || 5180; // 5180 for local dev, $PORT on Cloud Run
app.set('port', port);

// Start server when this file is executed directly (normal for Docker CMD "node dist/app.js")
if (require.main === module) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`[api] listening on ${port} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
  });
}

// Also export default for tests or external importing (e.g., supertest)
export default app;