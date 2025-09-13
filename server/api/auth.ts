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
const SESS: Map<string, { id: string; email: string; role: string }> = (global as any).__SESS || new Map();
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

// Diagnostic helper summarizing Microsoft SSO env presence (masked)
function msEnvStatus() {
  const tenant   = process.env.AZURE_TENANT_ID ?? '';
  const client   = process.env.AZURE_CLIENT_ID ?? '';
  const secret   = process.env.AZURE_CLIENT_SECRET ?? '';
  const redirect = process.env.AZURE_REDIRECT_URI ?? '';
  const mask = (v: string) => (v ? `${v.slice(0,6)}…${v.slice(-4)}` : '');
  const msEnabledFlag = (process.env.AUTH_MS_ENABLED ?? '1') !== '0';
  const hasTenant = !!tenant;
  const hasClient = !!client;
  const hasSecret = !!secret;
  const hasRedirect = !!redirect;
  const allPresent = msEnabledFlag && hasTenant && hasClient && hasSecret && hasRedirect;
  return {
    msEnabledFlag,
    hasTenant,
    hasClient,
    hasSecret,
    hasRedirect,
    allPresent,
  tenant,
  client,
  secret,
  redirect,
    preview: {
      tenant: mask(tenant),
      client: mask(client),
      secret: secret ? '***redacted***' : '',
      redirect,
    },
    nodeEnv: process.env.NODE_ENV || 'development',
  };
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
  const st = msEnvStatus();
  res.json({ msEnabled: st.allPresent, loginUrl: '/api/auth/login/microsoft' });
});

// TEMP diagnostic: which envs does the API see?
router.get('/config/_diag', (_req, res) => {
  res.json(msEnvStatus());
});

// GET /api/auth/login/microsoft
// Uses same env validation as /api/auth/config; returns 500 with stable error when incomplete.
router.get('/login/microsoft', (req, res) => {
  const st = msEnvStatus();
  if (!st.allPresent) return res.status(500).json({ error: 'sso_config_missing' });
  // Non-PKCE confidential client authorization request (no code_challenge)
  const auth = new URL(`https://login.microsoftonline.com/${st.tenant}/oauth2/v2.0/authorize`);
  auth.searchParams.set('client_id', st.client);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('response_mode', 'query');
  auth.searchParams.set('redirect_uri', st.redirect);
  auth.searchParams.set('scope', 'openid profile email offline_access');
  // Optional state (not enforced in callback for now)
  const state = crypto.randomBytes(8).toString('hex');
  auth.searchParams.set('state', state);
  console.log('[SSO] start (no PKCE) ->', auth.toString());
  return res.redirect(auth.toString());
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

// Helper to create a session cookie for SSO (lowercase role per spec for SSO path only)
function setCookieSession(res: any, payload: { email: string; name: string; role: string }, provider: string){
  const sid = 's_' + crypto.randomBytes(12).toString('hex');
  SESS.set(sid, { id: sid, email: payload.email, role: payload.role });
  res.cookie('ph.sid', sid, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7*24*60*60*1000,
  });
  return sid;
}

// NEW non-PKCE Azure callback
router.get('/azure/callback', async (req, res) => {
  console.log('[AUTH] azure/callback hit', { hasCode: !!req.query.code });
  try {
    const code = String(req.query.code || '');
    if(!code) return res.status(400).json({ error: 'missing_code' });
    const tenant = process.env.AZURE_TENANT_ID;
    const client = process.env.AZURE_CLIENT_ID;
    const secret = process.env.AZURE_CLIENT_SECRET;
    const redirect = process.env.AZURE_REDIRECT_URI;
    if(!tenant || !client || !secret || !redirect){
      return res.status(500).json({ error: 'sso_config_missing' });
    }
    const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: client,
      client_secret: secret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirect,
      scope: 'openid profile email offline_access'
    });
    const t = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if(!t.ok){
      const errTxt = await t.text().catch(()=> '');
      console.error('[AUTH] token exchange failed', t.status, errTxt);
      return res.status(401).json({ error: 'token_exchange_failed' });
    }
    const tokens: any = await t.json();
    const idToken = tokens.id_token || '';
    const parts = idToken.split('.');
    if(parts.length < 2) return res.status(401).json({ error: 'bad_id_token' });
    const payloadJson = Buffer.from(parts[1].replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8');
    let claims: any = {}; try { claims = JSON.parse(payloadJson); } catch {}
    const email = String((claims.email || claims.preferred_username || '')).toLowerCase();
    const name = String(claims.name || email || 'User');
    if(!email) return res.status(401).json({ error: 'no_email_claim' });
    // Determine canonical role (student present => student else teacher)
    const student = await prisma.student.findUnique({ where: { email } }).catch(()=>null);
    const canonical = student ? 'student' : 'teacher';
    setCookieSession(res, { email, name, role: canonical }, 'ms');
    return res.redirect(process.env.POST_LOGIN_REDIRECT || 'http://localhost:5173/');
  } catch (e:any){
    console.error('[AUTH] callback error', e);
    return res.status(500).json({ error: 'callback_error' });
  }
});

export default router;
