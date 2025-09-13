// Group API helpers

export async function updateGroup(
  id: string,
  body: { name?: string; startDate?: string|null; endDate?: string|null }
){
  const r = await fetch(`/api/groups/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = `Update failed (${r.status})`;
    try { const j = await r.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

export async function fetchGroups(){
  const res = await fetch('/api/groups', { credentials: 'include' });
  if(!res.ok) throw new Error('Failed to load groups');
  return res.json();
}
