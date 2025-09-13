import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../prisma/client';
import crypto from 'crypto';

// Utility: normalize external / DB role values to internal enum
function normalizeRole(input: any): 'STUDENT' | 'TEACHER' {
  const v = String(input || '').toUpperCase();
  if (v === 'TEACHER') return 'TEACHER';
  return 'STUDENT';
}

// Hybrid (dev) auth router. In production we lean on AAD / JWT. This endpoint is ONLY
// enabled when ALLOW_DEV_PASSWORD=1 (convenience for local iteration). Outside that
// flag it returns 404 to avoid leaking an unnecessary surface area. If you want a
// real email/password flow, replace this file with a proper implementation (user table,
// hashed password storage, throttle, lockout, etc.).
const router = Router();

// Minimal in-memory session store (dev only). Replace with Redis/DB in prod.
const SESS: Map<string, { id: string; email: string; role: 'STUDENT' | 'TEACHER' }> = (global as any).__SESS || new Map();
if (!(global as any).__SESS) (global as any).__SESS = SESS;

function issueSession(res: any, user: { id: string; email: string; role: 'STUDENT' | 'TEACHER' }, remember: boolean | number = false) {
  const sid = 's_' + user.id + '_' + crypto.randomBytes(6).toString('hex');
  SESS.set(sid, { id: user.id, email: user.email, role: normalizeRole(user.role) });
  const isProd = process.env.NODE_ENV === 'production';
  const opts: any = { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/' };
  if (remember) {
    const days = typeof remember === 'number' ? remember : 30;
    opts.maxAge = days * 24 * 60 * 60 * 1000;
  }
  res.cookie('ph.sid', sid, opts);
  return sid;
}

function requireSSOEnv() {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_REDIRECT_URI, CLIENT_APP_ORIGIN } = process.env;
  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_REDIRECT_URI || !CLIENT_APP_ORIGIN) {
    return null;
  }
  return { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_REDIRECT_URI, CLIENT_APP_ORIGIN } as const;
}

router.post('/login', async (req, res) => {
  if (process.env.NODE_ENV !== 'production') console.log('[AUTH] /login route hit');
  try {
    const { email: rawEmail, password, remember } = req.body || {};
    const email = (rawEmail || '').toString().trim().toLowerCase();
    if (!email || !/.+@.+\..+/.test(email)) return res.status(400).json({ error: 'Invalid email' });
    if (!password) return res.status(400).json({ error: 'Password required' });
    const allowDev = process.env.ALLOW_DEV_PASSWORD === '1';
    const isProd = process.env.NODE_ENV === 'production';

    // Dev-only conveniences (bypass / shared password). Only active when ALLOW_DEV_PASSWORD=1
    if (allowDev) {
      // Static dev bypass password
      if (password === 'devpass') {
        console.warn('[dev-auth] ALLOW_DEV_PASSWORD active: granting session for', email);
        const maxAgeSec = remember ? 30 * 24 * 3600 : 3600; // 30d vs 1h
        res.cookie('ph.sid', 'dev-session', {
          httpOnly: true,
          sameSite: 'lax',
          secure: isProd,
          maxAge: maxAgeSec * 1000
        });
        SESS.set('dev-session', { id: 'dev-user', email, role: 'TEACHER' });
        return res.json({ ok: true, user: { id: 'dev-user', email, role: 'TEACHER', mode: 'dev-bypass' } });
      }
      // Optional private hash path
      const hash = process.env.DEV_LOGIN_HASH;
      if (hash) {
        const good = await bcrypt.compare(password, hash).catch(() => false);
        if (good) {
          const maxAgeSec = remember ? 30 * 24 * 3600 : 3600;
          res.cookie('ph.sid', 'dev-session', {
            httpOnly: true,
            sameSite: 'lax',
            secure: isProd,
            maxAge: maxAgeSec * 1000
          });
          return res.json({ ok: true, user: { email, mode: 'hash' } });
        }
        // fall through to DB lookup below so normal user creds can still work
      }
    }

    // Database-backed user login (always allowed)
    try {
      const user = await (prisma as any).user.findUnique({ where: { email } });
      if(!user || !user.passwordHash){
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const ok = await bcrypt.compare(password, user.passwordHash).catch(()=> false);
      if(!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const role = normalizeRole(user.role || 'STUDENT');
  issueSession(res, { id: user.id, email: user.email, role }, !!remember);
  return res.json({ ok: true, user: { id: user.id, email: user.email, role } });
    } catch (e:any){
      console.error('[auth] lookup/verify failed', e);
      return res.status(500).json({ error: 'Auth error' });
    }
  } catch (e: any) {
    console.error('[auth/login] error', e);
    return res.status(500).json({ error: 'Auth error' });
  }
});

router.post('/logout', (req, res) => {
  const sid = (req.cookies && req.cookies['ph.sid']) || '';
  if (sid) { try { SESS.delete(sid); } catch {/* ignore */} }
  res.clearCookie('ph.sid', { path: '/' });
  return res.json({ success: true });
});

// Dev diagnostic route for SSO config (redacted)
router.get('/config', (_req, res) => {
  const env = requireSSOEnv();
  const envEnabled = process.env.AUTH_MS_ENABLED !== '0';
  const msEnabled = !!env && envEnabled;
  res.json({ msEnabled, loginUrl: '/api/auth/login/microsoft' });
});

// GET /api/auth/login/microsoft
router.get('/login/microsoft', (req, res) => {
  const env = requireSSOEnv();
  if (!env) {
    const wantsJson = req.accepts(['json','html']) === 'json';
  if (wantsJson) return res.status(500).json({ error: 'sso_config_missing' });
  const origin = process.env.CLIENT_APP_ORIGIN || 'http://localhost:5173';
  return res.redirect(origin.replace(/\/$/,'') + '/login?error=sso_config');
  }
  const next = (req.query.next as string) || '';
  const state = crypto.randomBytes(16).toString('hex');
  // PKCE code verifier & challenge (S256)
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const payload = JSON.stringify({ state, next: next || null, ts: Date.now(), codeVerifier });
  const sig = crypto.createHmac('sha256', env.AZURE_CLIENT_SECRET).update(payload).digest('hex');
  res.cookie('ph.ms.state', Buffer.from(payload).toString('base64') + '.' + sig, { httpOnly: true, sameSite: 'lax', secure: false, path: '/', maxAge: 5 * 60 * 1000 });
  const authUrl = new URL(`https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', env.AZURE_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', env.AZURE_REDIRECT_URI);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', 'openid profile email offline_access');
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('state', state);
  console.log('[SSO] start ->', authUrl.toString());
  return res.redirect(authUrl.toString());
});

async function fetchToken(env: ReturnType<typeof requireSSOEnv>, code: string, codeVerifier?: string) {
  const body = new URLSearchParams();
  body.set('client_id', env!.AZURE_CLIENT_ID);
  body.set('client_secret', env!.AZURE_CLIENT_SECRET);
  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('redirect_uri', env!.AZURE_REDIRECT_URI);
  body.set('scope', 'openid profile email offline_access');
  if (codeVerifier) body.set('code_verifier', codeVerifier);
  const r = await fetch(`https://login.microsoftonline.com/${env!.AZURE_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString()
  });
  if (!r.ok) throw new Error('token_exchange_failed');
  return r.json() as any;
}

function parseStateCookie(raw: string | undefined, clientSecret: string){
  if(!raw) return null;
  const [b64, sig] = raw.split('.');
  if(!b64 || !sig) return null;
  const json = Buffer.from(b64, 'base64').toString('utf8');
  const expected = crypto.createHmac('sha256', clientSecret).update(json).digest('hex');
  if (sig !== expected) return null;
  try { return JSON.parse(json); } catch { return null; }
}

function deriveEmail(claims: any): string | null {
  return claims?.preferred_username || claims?.email || claims?.upn || null;
}

function decodeJwt(token: string): any {
  try { const [,payload] = token.split('.'); return JSON.parse(Buffer.from(payload,'base64').toString('utf8')); } catch { return {}; }
}

async function resolveRole(env: any, email: string, idTokenClaims: any): Promise<'STUDENT' | 'TEACHER'> {
  // 1. Existing user
  const existingUser = await prisma.user.findUnique({ where: { email } }).catch(()=>null);
  if (existingUser?.role) return normalizeRole(existingUser.role);
  // 2. Azure app roles claim (roles or wids or extension apps) - assume 'roles'
  const roles: string[] = (idTokenClaims?.roles || idTokenClaims?.wids || []) as any[];
  if (Array.isArray(roles) && roles.length) {
    const mapped = roles.map(r => String(r).toUpperCase());
    if (mapped.includes('TEACHER')) return 'TEACHER';
    if (mapped.includes('STUDENT')) return 'STUDENT';
  }
  // 3. Derived from student presence
  const student = await prisma.student.findUnique({ where: { email } }).catch(()=>null);
  if (student) return 'STUDENT';
  // 4. Fallback
  return 'STUDENT';
}

// GET /api/auth/callback/microsoft
router.get('/callback/microsoft', async (req, res) => {
  const env = requireSSOEnv();
  if(!env) return res.redirect((process.env.CLIENT_APP_ORIGIN || 'http://localhost:5173') + '/login?error=sso_config');
  const { code, state } = req.query as any;
  if(!code || !state) return res.redirect((env.CLIENT_APP_ORIGIN) + '/login?error=missing_code');
  const parsed = parseStateCookie(req.cookies['ph.ms.state'], env.AZURE_CLIENT_SECRET);
  res.clearCookie('ph.ms.state', { path: '/' });
  if(!parsed || parsed.state !== state) {
    console.warn('[SSO] state mismatch');
    return res.redirect(env.CLIENT_APP_ORIGIN + '/login?error=state');
  }
  try {
    const codeVerifier: string | undefined = parsed.codeVerifier;
    const tokenResp = await fetchToken(env, code, codeVerifier);
    const idToken = tokenResp.id_token;
    if(!idToken) throw new Error('missing_id_token');
    const claims = decodeJwt(idToken);
    const email = deriveEmail(claims);
    if(!email) return res.redirect(env.CLIENT_APP_ORIGIN + '/login?error=no_email');
    const role = await resolveRole(env, email.toLowerCase(), claims);
    // Upsert user (basic profile)
    const upserted = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: { role },
      create: { email: email.toLowerCase(), role }
    });
    issueSession(res, { id: upserted.id, email: upserted.email, role }, true);
    const pathDest = parsed.next || (role === 'TEACHER' ? '/teachers' : '/students');
    const fullDest = env.CLIENT_APP_ORIGIN.replace(/\/$/, '') + pathDest;
    console.log('[SSO] ok', { email: upserted.email, role, dest: fullDest });
    return res.redirect(fullDest);
  } catch (e:any){
    console.error('[SSO] callback error', e);
    const origin = (env && env.CLIENT_APP_ORIGIN) || 'http://localhost:5173';
    return res.redirect(origin + '/login?error=sso_failed');
  }
});

export default router;
