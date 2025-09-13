import { ReactNode } from 'react';
import { useAuth } from '@/state/authStore';
import { Outlet, Navigate, useLocation } from 'react-router-dom';

type AllowSpec = 'TEACHER' | 'STUDENT' | 'ANY' | Array<'TEACHER' | 'STUDENT'>;

export function RequireRole({ allow, children }: { allow: AllowSpec; children: ReactNode }){
  const { state } = useAuth();
  const role = state.status === 'signedIn' ? state.user.role : null;
  const location = useLocation();
  if(state.status === 'loading') return null;
  if(state.status === 'signedOut'){
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if(allow === 'ANY') return <>{children}</>;
  if(Array.isArray(allow)){
    if(allow.includes(role as any)) return <>{children}</>;
    return <div className="p-8 text-center">
      <h2 className="text-xl font-semibold">Access denied.</h2>
      <p className="text-slate-600 mt-2">{allow.includes('TEACHER') && !allow.includes('STUDENT') ? 'Teachers only.' : 'Students only.'}</p>
    </div>;
  }
  if(role === allow) return <>{children}</>;
  return <div className="p-8 text-center">
    <h2 className="text-xl font-semibold">Access denied.</h2>
    <p className="text-slate-600 mt-2">{allow === 'TEACHER' ? 'Teachers only.' : 'Students only.'}</p>
  </div>;
}

export function RequireAuth(){
  const { state } = useAuth();
  const loc = useLocation();
  if(state.status === 'loading') return null;
  if(state.status === 'signedOut'){
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}
