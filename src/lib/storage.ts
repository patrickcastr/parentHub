// Minimal client helpers for SAS URL endpoints
export async function getReadUrl(blob: string) {
  const res = await fetch(`/api/storage/read-url/${encodeURIComponent(blob)}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`read-url failed: ${res.status}`);
  const data = await res.json();
  return data.url as string;
}

export async function getUploadUrl(blob: string) {
  const res = await fetch('/api/storage/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ blob }),
  });
  if (!res.ok) throw new Error(`upload-url failed: ${res.status}`);
  const data = await res.json();
  return data.url as string;
}
