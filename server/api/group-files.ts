import { Router } from 'express';
import { prisma } from '../prisma/client';
import {
  containerClient,
  initUpload,        // 🔐 creates write SAS for a single blob
  getDownloadUrl,   // 🔓 creates read SAS for a single blob
  deleteObject,     // 🗑️ deletes a blob by full key
} from '../storage/azure-blob';
import { assertPathInPrefix } from '../util/pathScope';

const r = Router();

/**
 * Treat these as “folder markers” that shouldn’t appear in listings.
 */
const isMarker = (name: string) =>
  name.endsWith('/_folder') || name.endsWith('/prefix_foldername');

// ---------- helpers ----------

/**
 * Sanitize a *path segment* (not a whole path):
 * remove reserved path chars \ / : * ? " < > |, keep spaces/dots/dashes/underscores/parens.
 */
function sanitizeSegment(seg: string) {
  return seg.replace(/[\/\\:*?"<>|]+/g, '').trim();
}

/** Ensure a prefix like "groups/abc" ends with exactly one trailing slash. */
const ensureTrailingSlash = (s: string) => (s.endsWith('/') ? s : s + '/');

/**
 * Given "some/sub/dir/file.pdf":
 * - sanitize each segment,
 * - return { filename: "file.pdf", subdir: "some/sub/dir/" }
 */
function splitAndSanitize(p: string) {
  const parts = p.split('/').filter(Boolean).map(sanitizeSegment);
  const rawFile = parts.pop() || '';
  const filename = sanitizeFilename(rawFile);
  const subdir = parts.length ? parts.join('/') + '/' : '';
  return { filename, subdir };
}

/** Only keep the last segment, then sanitize it as a filename. */
function sanitizeFilename(name: string) {
  const last = name.split(/[\/\\]/).pop() || '';
  return sanitizeSegment(last);
}

function splitBaseExt(name: string) {
  const i = name.lastIndexOf('.');
  if (i <= 0 || i === name.length - 1) return { base: name, ext: '' };
  return { base: name.slice(0, i), ext: name.slice(i) };
}

/** Does a blob exist at a full key? */
async function blobExists(fullKey: string) {
  const client = containerClient.getBlockBlobClient(fullKey);
  return await client.exists();
}

/**
 * Ensure unique filename inside keyPrefix, appending " [n]" before the extension.
 * e.g., "file.pdf" -> "file [1].pdf", "file [2].pdf", ...
 */
async function getUniqueFilename(keyPrefix: string, desiredName: string) {
  const { base, ext } = splitBaseExt(desiredName);
  let n = 0;
  let candidate = desiredName;
  while (await blobExists(keyPrefix + candidate)) {
    n += 1;
    candidate = `${base} [${n}]${ext}`;
  }
  return candidate;
}

// ---------- routes ----------

/**
 * GET /api/groups/:id/files/list?limit=50&cursor=<token>
 * Paginates blobs under the group’s storagePrefix.
 */
r.get('/:id/files/list', async (req, res) => {
  const g = await prisma.group.findUnique({
    where: { id: String(req.params.id) },
    select: { storagePrefix: true },
  });
  if (!g?.storagePrefix) return res.status(404).json({ error: 'Group not found' });

  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const cursor = (req.query.cursor as string | undefined) || undefined;

  const pager = containerClient
    .listBlobsFlat({ prefix: g.storagePrefix })
    .byPage({ maxPageSize: limit, continuationToken: cursor });

  const page = await pager.next();
  const value = page.value as any;

  const items = (value.segment.blobItems || [])
    .filter((b: any) => !isMarker(b.name))
    .map((b: any) => ({
      key: b.name,                                   // full blob key
      name: b.name.slice(g.storagePrefix.length),    // relative name for UI
      size: b.properties.contentLength ?? null,
      lastModified: b.properties.lastModified ?? null,
    }));

  res.json({ items, nextCursor: value.continuationToken || null });
});

/**
 * GET /api/groups/:id/files/read-url?key=<blobKeyRelOrFull>
 * Accepts either:
 *   - relative key: "sub/file.pdf"
 *   - full key:     "groups/<id>/sub/file.pdf"
 * Returns a time-limited download URL (read SAS) for exactly one blob.
 */
r.get('/:id/files/read-url', async (req, res) => {
  const g = await prisma.group.findUnique({
    where: { id: String(req.params.id) },
    select: { storagePrefix: true },
  });
  if (!g?.storagePrefix) return res.status(404).json({ error: 'Group not found' });

  const prefix = ensureTrailingSlash(g.storagePrefix);

  // Raw input (strip leading slashes), basic checks
  const raw = String(req.query.key || req.query.blob || '').trim().replace(/^\/+/, '');
  if (!raw) return res.status(400).json({ error: 'key is required' });
  if (raw.includes('..')) return res.status(400).json({ error: 'invalid path' });

  // Normalize to ONE prefix: if already prefixed, use as-is; else prepend the prefix.
  const fullKey = raw.startsWith(prefix) ? raw : prefix + raw;

  // Safety: ensure the resolved key is truly inside the allowed prefix
  const safeKey = assertPathInPrefix(fullKey, prefix);

  const filename = safeKey.split('/').pop();
  const url = await getDownloadUrl(safeKey, { filename });

  res.json({ url });
});

/**
 * POST /api/groups/:id/files/upload-url
 * Body: { filename?: string, key?: string, blob?: string, mimeType?: string }
 *
 * Frontend SHOULD send ONLY { filename } (Option 1).
 * We also tolerate { key } or { blob } for backward-compat.
 * If a full "groups/<id>/" sneaks in, we strip it once to avoid duplication.
 * We sanitize, keep subfolders, ensure a unique name, then return:
 *   { uploadUrl, headers, expiresAt, key, resolvedFilename }
 */
// NOTE: This is the ONLY active route for generating a group-scoped upload SAS URL.
// Accepts legacy body fields (key/blob) but prefers { filename }.
r.post('/:id/files/upload-url', async (req, res) => 
  {
  const id = String(req.params.id);
  const g = await prisma.group.findUnique({
    where: { id },
    select: { storagePrefix: true },
  });
  if (!g?.storagePrefix) return res.status(404).json({ error: 'Group not found' });

  const prefix = ensureTrailingSlash(g.storagePrefix);

  // Accept filename | key | blob
  const rawInput = String(
    req.body?.filename ?? req.body?.key ?? req.body?.blob ?? ''
  ).trim();
  if (!rawInput) return res.status(400).json({ error: 'filename is required' });

  // If client already included "groups/<id>/", strip it so we don't double it.
  const relative = rawInput.startsWith(prefix) ? rawInput.slice(prefix.length) : rawInput;

  // Pull sanitized subdir + filename
  const { filename, subdir } = splitAndSanitize(relative);
  if (!filename) return res.status(400).json({ error: 'invalid filename' });

  const keyPrefix = prefix + subdir;                 // "groups/<id>[/sub/]"
  const finalName = await getUniqueFilename(keyPrefix, filename); // de-dupe

  const mimeType = (req.body?.mimeType as string | undefined) || undefined;

  const sas = await initUpload({ keyPrefix, filename: finalName, mimeType, expiresInSeconds: 600 });
  const uploadUrl = (sas as any).uploadUrl ?? (sas as any).url;
  if (!uploadUrl) {
    return res.status(500).json({ error: 'storage initUpload missing uploadUrl/url' });
  }
  const headers = (sas as any).headers;
  const expiresAt = (sas as any).expiresAt;

  // TEMP debug line (remove after smoke test passes)
  console.log('[upload-url] key:', keyPrefix + finalName, 'uploadUrl:', uploadUrl);

  return res.status(201).json({
    uploadUrl,
    headers,
    expiresAt,
    key: keyPrefix + finalName,
    resolvedFilename: finalName,
  });
});

/**
 * DELETE /api/groups/:id/files?key=<blobKeyRelOrFull>
 * Accepts relative or full key; normalizes + asserts scope, then deletes.
 */
r.delete('/:id/files', async (req, res) => {
  const g = await prisma.group.findUnique({
    where: { id: String(req.params.id) },
    select: { storagePrefix: true },
  });
  if (!g?.storagePrefix) return res.status(404).json({ error: 'Group not found' });

  const prefix = ensureTrailingSlash(g.storagePrefix);

  const raw = String(req.query.key || req.query.blob || '').trim().replace(/^\/+/, '');
  if (!raw) return res.status(400).json({ error: 'key is required' });

  // Normalize to one prefix and assert scope
  const fullKey = raw.startsWith(prefix) ? raw : prefix + raw;
  const safeKey = assertPathInPrefix(fullKey, prefix);

  await deleteObject(safeKey);
  res.json({ ok: true });
});

export default r;