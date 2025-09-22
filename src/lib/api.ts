export * from './api/groups';
import { Group, StudentDTO, Paginated } from './types';
import { msalInstance, loginRequest } from '@/auth/msal';

// Centralized API base + fetch helpers for production
export const API = (import.meta as any).env?.VITE_API_BASE_URL as string;
export async function apiFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}` as string, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    try { throw new Error(await res.text()); } catch { throw new Error(res.statusText); }
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}
export function apiPost(path: string, body: unknown, init: RequestInit = {}) {
  return apiFetch(path, { method: 'POST', body: JSON.stringify(body), ...init });
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

async function json<T>(res: Response): Promise<T> { if (!res.ok) throw new Error(await res.text()); return res.json(); }

// Groups
export type ListGroupsParams = { page?: number; limit?: number; search?: string };
export type GroupRow = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  createdAt?: string | null;
  // Legacy alias
  startsOn?: string | null;
  members?: number;
  files?: number;
  memberCount?: number;
  fileCount?: number;
};
export async function listGroups(params: ListGroupsParams = {}) {
  const q = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 10),
    search: (params.search ?? '').trim(),
  });
  const res = await fetch(`${API_BASE}/groups?${q.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`listGroups failed: ${res.status}`);
  const data = await res.json();
  // Normalize items to have startDate/endDate
  const items: GroupRow[] = (data.items || []).map((g: any) => ({
    id: g.id,
    name: g.name,
    startDate: g.startDate ?? g.startsOn ?? null,
    endDate: g.endDate ?? null,
    createdAt: g.createdAt ?? null,
    startsOn: g.startsOn ?? g.startDate ?? null,
    members: g.members ?? g.memberCount ?? undefined,
    files: g.files ?? g.fileCount ?? undefined,
    memberCount: g.memberCount,
    fileCount: g.fileCount,
  }));
  return { ...data, items } as { items: GroupRow[]; page: number; limit: number; total: number; pages?: number };
}
export async function createGroup(data: { name: string; startsOn?: string | null }) {
  const res = await fetch(`${API_BASE}/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) });
  return json<Group>(res);
}
export async function updateGroup(id: string, data: { name?: string; startsOn?: string | null; endsOn?: string | null }) {
  const res = await fetch(`${API_BASE}/groups/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) });
  return json<Group>(res);
}
export async function deleteGroup(id: string) {
  const res = await fetch(`${API_BASE}/groups/${id}`, { method: 'DELETE', credentials: 'include' });
  return json<{ ok: boolean }>(res);
}
export async function getGroup(id: string) {
  const res = await fetch(`${API_BASE}/groups/${id}`, { credentials: 'include' });
  if(!res.ok) throw new Error(`getGroup failed: ${res.status}`);
  const g = await res.json();
  return {
    id: g.id,
    name: g.name,
    startDate: g.startDate ?? g.startsOn ?? null,
    endDate: g.endDate ?? null,
  } as { id: string; name: string; startDate: string | null; endDate: string | null };
}

// File upload (presigned style) helpers
export type InitUploadResponse = { uploadUrl: string; headers?: Record<string,string>; key: string; expiresAt: number };
export async function initGroupFileUpload(groupId: string, file: File): Promise<InitUploadResponse> {
  const body = { filename: file.name, mimeType: file.type, sizeBytes: file.size };
  const res = await fetch(`${API_BASE}/groups/${groupId}/files/init-upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
  if(!res.ok) throw new Error(`init-upload failed: ${res.status}`);
  return res.json();
}
export async function completeFileUpload(params: { groupId: string; key: string; filename: string; mimeType?: string; sizeBytes?: number; }) {
  const res = await fetch(`${API_BASE}/files/complete`, { method: 'POST', headers: { 'Content-Type':'application/json' }, credentials: 'include', body: JSON.stringify(params) });
  if(!res.ok) throw new Error(`complete upload failed: ${res.status}`);
  return res.json();
}

// Students
export async function listStudents(params: { search?: string; page?: number; limit?: number; groupId?: string } = {}): Promise<Paginated<StudentDTO>> {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.groupId) q.set('groupId', params.groupId);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const res = await fetch(`${API_BASE}/students?${q.toString()}`, { credentials: 'include' });
  return json(res);
}
export async function createStudent(data: any) {
  const res = await fetch(`${API_BASE}/students`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) });
  return json(res);
}
export async function patchStudent(id: string, data: any) {
  const res = await fetch(`${API_BASE}/students/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) });
  return json(res);
}
export async function assignStudentGroup(id: string, groupId: string | null, override?: boolean) {
  const body: any = { groupId };
  if (override) body.override = true;
  const res = await fetch(`${API_BASE}/students/${id}/assign-group`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
  return json(res);
}
export async function importStudentsCsv(file: File) {
  const formData = new FormData(); formData.append('file', file);
  const res = await fetch(`${API_BASE}/students/import-csv`, { method: 'POST', credentials: 'include', body: formData });
  return json(res);
}

async function getToken(){
  const [account] = msalInstance.getAllAccounts();
  if (!account) throw new Error('Not authenticated');
  const res = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
  return res.accessToken;
}

async function authFetch(url:string, init: RequestInit = {}){
  const token = await getToken();
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

// Auth / Me (protected)
export const getMe = () => authFetch(`${API_BASE}/me`).then(r=> json(r));

// Files
export const listGroupFiles = ({ groupId, search='', page=1, size=20 }: { groupId: string; search?: string; page?: number; size?: number; }) => {
  const q = new URLSearchParams({ search, page: String(page), size: String(size) });
  return authFetch(`${API_BASE}/groups/${groupId}/files?${q.toString()}`).then(r=> json(r));
};
export const uploadGroupFile = async ({ groupId, file }: { groupId: string; file: File; }) => {
  const fd = new FormData(); fd.append('file', file);
  const res = await authFetch(`${API_BASE}/groups/${groupId}/files`, { method: 'POST', body: fd });
  return json(res);
};
