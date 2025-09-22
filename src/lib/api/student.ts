import { apiFetch } from '@/lib/api';
export interface StudentPortalPayload {
  group: { id: string; name: string; startsOn?: string | null; endsOn?: string | null } | null;
  files: Array<{ id: string; name: string; sizeBytes: number | null; createdAt: string; uploadedBy: string | null }>;
}

export async function fetchStudentPortal(): Promise<StudentPortalPayload> {
  return apiFetch('/api/student/portal') as Promise<StudentPortalPayload>;
}
