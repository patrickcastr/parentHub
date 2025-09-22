import type { StudentDTO } from '@/lib/types';
import { apiFetch } from '@/lib/api';

export type FetchStudentsOpts = { groupId?: string | null; page?: number; limit?: number; search?: string };
export async function fetchStudents(opts: FetchStudentsOpts = {}): Promise<{ items: StudentDTO[]; total?: number; page?: number; limit?: number } | { items: StudentDTO[]; total?: number } | StudentDTO[]> {
  const params = new URLSearchParams();
  if (opts.page) params.set('page', String(opts.page));
  if (opts.limit) params.set('size', String(opts.limit)); // server expects 'size'
  if (opts.search) params.set('search', opts.search);
  if (opts.groupId) params.set('groupId', opts.groupId);
  const qs = params.toString();
  return apiFetch(`/api/students${qs ? `?${qs}` : ''}`);
}

export async function assignStudentGroup(studentId: string, groupId: string | null, override?: boolean){
  const payload: any = { groupId: groupId === '' ? null : groupId };
  if (override) payload.override = true;
  return apiFetch(`/api/students/${studentId}/assign-group`, { method: 'POST', body: JSON.stringify(payload) });
}
