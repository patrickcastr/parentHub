import { apiFetch } from '@/lib/api';
// Minimal client helpers for SAS URL endpoints
export async function getReadUrl(blob: string) {
  const data = (await apiFetch(`/api/storage/read-url/${encodeURIComponent(blob)}`)) as any;
  return data.url as string;
}

export async function getUploadUrl(blob: string) {
  const data = (await apiFetch('/api/storage/upload-url', { method: 'POST', body: JSON.stringify({ blob }) })) as any;
  return data.url as string;
}
