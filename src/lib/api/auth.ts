export async function loginWithEmailPassword(email: string, password: string, remember: boolean){
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, remember })
  });
  if(!res.ok){
    let msg = 'Login failed';
    try { msg = await res.text() || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function fetchMe(){
  const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
  if(res.status === 401) return { authenticated: false as const };
  if(!res.ok) throw new Error('me_failed');
  const data = await res.json();
  return { authenticated: true as const, user: data };
}

export async function logout(){
  const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
