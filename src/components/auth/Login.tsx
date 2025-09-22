import React from 'react';
import AuthProviderButton from '@/components/auth/AuthProviderButton';
import { AUTH_PROVIDERS } from '@/config/authProviders';
import { loginWithEmailPassword, fetchMe } from '@/lib/api/auth';
import { MSAL_ENABLED } from '@/auth/msal';
import { apiFetch } from '@/lib/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/state/authStore';

function resolveRedirect(role: string | null | undefined, nextParam?: string | null){
  if(nextParam) return nextParam;
  if(role === 'TEACHER') return '/teachers';
  if(role === 'STUDENT') return '/students';
  return '/';
}

export default function Login(){
  const navigate = useNavigate();
  const location = useLocation();
  const { state, setSignedIn } = useAuth();
  const user = state.status === 'signedIn' ? state.user : null;
  const role = user?.role;
  const ready = state.status !== 'loading';
  const next = new URLSearchParams(location.search).get('next');
  const [email,setEmail] = React.useState('');
  const [password,setPassword] = React.useState('');
  const [remember,setRemember] = React.useState(true);
  const [loading,setLoading] = React.useState(false);
  const [error,setError] = React.useState<string|null>(null);

  function validEmail(v:string){ return /.+@.+\..+/.test(v); }

  const handleSubmit = async (e: React.FormEvent)=>{
    e.preventDefault(); // keep SPA
    setError(null);
    if(!validEmail(email)) { setError('Please enter a valid email.'); return; }
    if(!password) { setError('Password required.'); return; }
    setLoading(true);
    try {
      await loginWithEmailPassword(email, password, remember);
      const me = await fetchMe();
      if(me.authenticated){
        setSignedIn(me.user);
        navigate(resolveRedirect(me.user.role, next), { replace: true });
      } else {
        setError('Unexpected: still unauthenticated');
      }
    } catch (err:any){
      setError(err?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  // Auto-redirect if already authenticated (silent, no toast) once auth state is ready
  React.useEffect(() => {
    if(!ready) return;
    if(!user) return;
    navigate(resolveRedirect(role, next), { replace: true });
  }, [ready, user, role, next, navigate]);

  // Microsoft SSO config (public)
  const [msCfg, setMsCfg] = React.useState<{ msEnabled: boolean; loginUrl: string } | null>(null);
  const [msLoading, setMsLoading] = React.useState(true);
  React.useEffect(()=>{
    let cancelled = false;
    (async()=>{
      try {
  const j = (await apiFetch('/api/auth/config')) as any;
        if(!cancelled) setMsCfg(j);
      } catch {
  if(!cancelled) setMsCfg({ msEnabled: false, loginUrl: '/api/auth/login/microsoft' });
      } finally { if(!cancelled) setMsLoading(false); }
    })();
    return ()=>{ cancelled = true; };
  }, []);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 bg-white border rounded-xl shadow-sm p-8">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-slate-600">Please enter your details</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">Email address</label>
            <input id="email" type="email" autoComplete="email" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" value={email} onChange={e=> setEmail(e.target.value)} required />
          </div>
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium">Password</label>
              <input id="password" type="password" autoComplete="current-password" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" value={password} onChange={e=> setPassword(e.target.value)} required />
            </div>
          <div className="flex items-center justify-between text-sm">
            <label className="inline-flex items-center gap-2 select-none cursor-pointer">
              <input type="checkbox" className="rounded border" checked={remember} onChange={e=> setRemember(e.target.checked)} />
              <span>Remember me for 30 days</span>
            </label>
            <a href="/forgot-password" className="text-slate-600 hover:text-slate-900">Forgot password?</a>
          </div>
          {error && <div className="text-sm text-red-600" role="alert">{error}</div>}
          <button type="submit" disabled={loading} className="w-full rounded-md bg-slate-900 text-white py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="flex-1 h-px bg-slate-200" />
          <span>OR</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <div className="space-y-3">
          {MSAL_ENABLED && AUTH_PROVIDERS.filter(p=> p.id==='microsoft').map(p=> (
            <AuthProviderButton
              key={p.id}
              provider={p}
              overridePath={msCfg?.loginUrl || '/api/auth/login/microsoft'}
              disabled={msLoading || !(msCfg?.msEnabled)}
            />
          ))}
          {MSAL_ENABLED && !msLoading && msCfg && !msCfg.msEnabled && (
            <p className="text-xs text-red-600 text-center">Microsoft SSO isn’t configured on the server.</p>
          )}
          {!MSAL_ENABLED && (
            <p className="text-xs text-red-600 text-center">Microsoft SSO isn’t configured on the server.</p>
          )}
        </div>
      </div>
    </div>
  );
}

