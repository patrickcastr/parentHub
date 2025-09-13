// ------------------------------------------------------------
// types.ts — frontend API client for group file operations
// ------------------------------------------------------------

/**
 * Shape of a file record returned by the backend.
 * Mirrors DB schema + API response.
 */
export type FileItem = {
  id: string;
  name: string;
  url: string;
  key: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedBy?: string | null;
  createdAt: string;
  status: "ACTIVE" | "ARCHIVED" | "PURGED";
  groupId: string;
};

/**
 * Utility: ensure filenames don’t accidentally carry slashes/backslashes.
 * Removes any path separators but keeps safe characters.
 */
function sanitizeFilename(name: string) {
  return name.replace(/[\/\\]+/g, '');
}

// ------------------------------------------------------------
// LIST FILES
// ------------------------------------------------------------

/**
 * List files for a given group with pagination, search, and status filter.
 */
export async function listGroupFiles(params: {
  groupId: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: "ACTIVE" | "ARCHIVED" | "ALL";
}) {
  const { groupId, page = 1, limit = 10, search = "", status = "ACTIVE" } = params;

  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    status,
    ...(search ? { search } : {}),
  });

  const r = await fetch(`/api/groups/${groupId}/files?` + qs.toString(), { credentials: 'include' });
  if (!r.ok) throw new Error("Failed to fetch files");

  return r.json() as Promise<{
    items: FileItem[];
    page: number;
    limit: number;
    total: number;
    pages: number;
  }>;
}

// ------------------------------------------------------------
// INIT UPLOAD
// ------------------------------------------------------------

/**
 * Ask the backend for a SAS URL for a new upload.
 * Client sends ONLY the filename; server attaches groups/<id>/ prefix.
 *
 * Backend returns:
 *  {
 *    key: "groups/<id>/filename.pdf",
 *    uploadUrl: "<signed PUT URL>",
 *    headers: { ... },
 *    expiresAt: "...",
 *    resolvedFilename: "filename.pdf"
 *  }
 */
export async function initUpload(
  groupId: string,
  body: { filename: string; mimeType?: string; sizeBytes?: number }
) {
  console.debug('[files:initUpload] request', { groupId, filename: body.filename, mimeType: body.mimeType, size: body.sizeBytes });
  const r = await fetch(`/api/groups/${groupId}/files/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: 'include',
    body: JSON.stringify({
      filename: sanitizeFilename(body.filename), // ✅ safe name only
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    }),
  });

  if (!r.ok) {
    let msg = "initUpload failed";
    try {
      const j = await r.json();
      if (j?.error) msg = j.error; // surface backend error like "filename is required"
      console.warn('[files:initUpload] error response', j);
    } catch {}
    throw new Error(msg);
  }

  const data = await r.json();
  console.debug('[files:initUpload] success', data);
  return data;
}

// ------------------------------------------------------------
// COMPLETE UPLOAD
// ------------------------------------------------------------

/**
 * Notify the backend that the file was uploaded successfully to Azure.
 * Backend can then persist DB metadata, mark as ACTIVE, etc.
 */
export async function completeUpload(args: {
  groupId: string;
  key: string;       // full blob key from initUpload (server-resolved!)
  filename: string;  // original filename (for display)
  mimeType?: string;
  sizeBytes?: number;
}) {
  console.debug('[files:completeUpload] request', args);
  const r = await fetch(`/api/files/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: 'include',
    body: JSON.stringify(args),
  });

  if (!r.ok) {
    let msg = "completeUpload failed";
    try {
      const j = await r.json();
      if (j?.error) msg = j.error;
      console.warn('[files:completeUpload] error response', j);
    } catch {}
    throw new Error(msg);
  }

  const data = await r.json();
  console.debug('[files:completeUpload] success', data);
  return data;
}

// ------------------------------------------------------------
// OTHER ACTIONS
// ------------------------------------------------------------

// Lightweight blob listing (direct storage-backed list) --------------------
export type GroupBlobItem = {
  key: string;          // full blob key (groups/<id>/...)
  name: string;         // relative name (no prefix)
  size: number | null;
  lastModified: string | null;
};

export async function listGroupFilesStorage(groupId: string, cursor?: string, limit = 20) {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (cursor) qs.set('cursor', cursor);
  const r = await fetch(`/api/groups/${groupId}/files/list?${qs.toString()}`, { credentials: 'include' });
  if (!r.ok) {
    let msg = 'list files failed';
    try { const j = await r.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  return r.json() as Promise<{ items: GroupBlobItem[]; nextCursor: string | null }>;  
}

export async function readFileUrl(groupId: string, key: string) {
  const qs = new URLSearchParams({ key });
  const r = await fetch(`/api/groups/${groupId}/files/read-url?${qs.toString()}`, { credentials: 'include' });
  if (!r.ok) {
    let msg = 'read url failed';
    try { const j = await r.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  return r.json() as Promise<{ url: string }>;  
}

export async function deleteFile(groupId: string, key: string) {
  const qs = new URLSearchParams({ key });
  const r = await fetch(`/api/groups/${groupId}/files?${qs.toString()}`, { method: 'DELETE', credentials: 'include' });
  if (!r.ok) {
    let msg = 'delete failed';
    try { const j = await r.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  return r.json() as Promise<{ ok: boolean }>;  
}

/** Get a download URL for a given file ID. */
export function downloadUrl(fileId: string) {
  return `/api/files/${fileId}/download`;
}

/** Archive a file (soft delete / hidden from normal list). */
export async function archiveFile(id: string) {
  const r = await fetch(`/api/files/${id}/archive`, { method: "PATCH", credentials: 'include' });
  if (!r.ok) throw new Error("archive failed");
}

/** Permanently delete a file (irreversible). */
export async function purgeFile(id: string) {
  const r = await fetch(`/api/files/${id}/purge`, { method: "DELETE", credentials: 'include' });
  if (!r.ok) throw new Error("purge failed");
}