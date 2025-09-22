// Group API helpers
import { apiFetch } from '@/lib/api';

export async function updateGroup(
  id: string,
  body: { name?: string; startDate?: string|null; endDate?: string|null }
){
  return apiFetch(`/api/groups/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function fetchGroups(){
  return apiFetch('/api/groups');
}
