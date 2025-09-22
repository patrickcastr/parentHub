import { apiFetch } from '@/lib/api';
export async function loginWithEmailPassword(email: string, password: string, remember: boolean){
  return apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password, remember }) });
}

export async function fetchMe(){
  const res = await apiFetch('/api/auth/me');
  if ((res as any)?.authenticated === false) return { authenticated: false as const };
  return { authenticated: true as const, user: res };
}

export async function logout(){
  return apiFetch('/api/auth/logout', { method: 'POST' });
}
