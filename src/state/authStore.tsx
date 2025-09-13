import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchMe, logout } from '@/lib/api/auth';

export interface AuthUser { id: string; email: string; role: 'STUDENT' | 'TEACHER'; }
type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: AuthUser };

interface AuthContextValue {
  state: AuthState;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setSignedIn: (u: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }){
  const [state,setState] = useState<AuthState>({ status: 'loading' });

  async function load(){
    try {
      const me = await fetchMe();
      if(me.authenticated){
        setState({ status: 'signedIn', user: me.user });
      } else {
        setState({ status: 'signedOut' });
      }
    } catch {
      setState({ status: 'signedOut' });
    }
  }

  useEffect(()=> { load(); }, []);

  async function signOut(){
    try { await logout(); } catch {/* ignore */}
    setState({ status: 'signedOut' });
  }

  const value: AuthContextValue = { state, signOut, refresh: load, setSignedIn: (u)=> setState({ status:'signedIn', user: u }) };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(){
  const ctx = useContext(AuthContext);
  if(!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
