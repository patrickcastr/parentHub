export interface StudentPortalPayload {
  group: { id: string; name: string; startsOn?: string | null; endsOn?: string | null } | null;
  files: Array<{ id: string; name: string; sizeBytes: number | null; createdAt: string; uploadedBy: string | null }>;
}

export async function fetchStudentPortal(): Promise<StudentPortalPayload> {
  const res = await fetch('/api/student/portal', { credentials: 'include', cache: 'no-store' });
  if(!res.ok) throw new Error('Failed to load portal');
  return res.json();
}
