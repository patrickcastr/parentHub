import type { StudentDTO } from '@/lib/types';

export type FetchStudentsOpts = { groupId?: string | null; page?: number; limit?: number; search?: string };
export async function fetchStudents(opts: FetchStudentsOpts = {}): Promise<{ items: StudentDTO[]; total?: number; page?: number; limit?: number } | { items: StudentDTO[]; total?: number } | StudentDTO[]> {
  const params = new URLSearchParams();
  if (opts.page) params.set('page', String(opts.page));
  if (opts.limit) params.set('size', String(opts.limit)); // server expects 'size'
  if (opts.search) params.set('search', opts.search);
  if (opts.groupId) params.set('groupId', opts.groupId);
  const qs = params.toString();
  const res = await fetch(`/api/students${qs ? `?${qs}` : ''}`, { credentials: 'include' });
  if(!res.ok) throw new Error('Failed to load students');
  return res.json();
}

export async function assignStudentGroup(studentId: string, groupId: string | null, override?: boolean){
  const payload: any = { groupId: groupId === '' ? null : groupId };
  if (override) payload.override = true;
  const res = await fetch(`/api/students/${studentId}/assign-group`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  class HttpError extends Error { status: number; constructor(status:number, message:string){ super(message); this.status = status; } }
  if(!res.ok){
    let msg = '';
    try { msg = await res.text(); } catch {}
    throw new HttpError(res.status, msg || 'Request failed');
  }
  // Endpoint returns updated student JSON
  try { return await res.json(); } catch { return { ok: true }; }
}
