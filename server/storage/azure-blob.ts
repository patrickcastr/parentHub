import path from 'node:path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import {
  BlobServiceClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { randomUUID } from 'node:crypto';

/* -------------------------- ENV + CLIENTS -------------------------- */

// Allow storage layer to be disabled in local/dev environments when Azure env vars
// are not present. This prevents the entire server from crashing on startup.
// Export a flag so callers (or future code) can branch if needed.
export const storageDisabled =
  process.env.STORAGE_DISABLED === '1' ||
  !process.env.AZURE_STORAGE_ACCOUNT ||
  !process.env.AZURE_STORAGE_CONTAINER;

let account: string | undefined;
let container: string | undefined;
let service: BlobServiceClient | undefined;
export let containerClient: ReturnType<BlobServiceClient['getContainerClient']> | undefined;

if (storageDisabled) {
  // eslint-disable-next-line no-console
  console.warn('[storage] Disabled (missing env or STORAGE_DISABLED=1). File features unavailable.');
} else {
  account = process.env.AZURE_STORAGE_ACCOUNT as string;
  container = process.env.AZURE_STORAGE_CONTAINER as string;
  service = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    new DefaultAzureCredential()
  );
  containerClient = service.getContainerClient(container);
}

/* ------------------------------ UTILS ------------------------------ */

const ensureSlash = (p: string) => (p.endsWith('/') ? p : p + '/');

const ymd = (d = new Date()) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return { y, m, dd };
};

const ext = (name?: string) => {
  const e = name ? path.extname(name) : '';
  return e && e.startsWith('.') ? e : '';
};

export function buildBlobKey(prefix: string, originalName?: string) {
  const p = ensureSlash(prefix);
  const { y, m, dd } = ymd();
  const id = (typeof randomUUID === 'function' ? randomUUID() : Math.random().toString(36).slice(2, 10));
  return `${p}${y}/${m}/${dd}/${id}${ext(originalName)}`;
}

/* --------------------------- BOOTSTRAP ---------------------------- */

export async function initStorage() {
  if (storageDisabled) {
    console.log('[storage] init skipped (disabled)');
    return;
  }
  if (!containerClient) return;
  console.log('[storage] ensuring container', containerClient.containerName);
  await containerClient.createIfNotExists();
}

/* ------------------------- MARKER HELPERS ------------------------- */
/** Prefer the first name; keep old name for backward-compat. */
export const MARKER_BLOBS = ['prefix_foldername', '_folder'] as const;

const markerPath = (prefix: string, name: (typeof MARKER_BLOBS)[number] = MARKER_BLOBS[0]) =>
  `${ensureSlash(prefix)}${name}`;

export const isMarkerKey = (key: string) => MARKER_BLOBS.includes((key.split('/').pop() || '') as any);

export async function createFolderMarker(
  prefix: string,
  meta?: Record<string, string>,
  markerName: (typeof MARKER_BLOBS)[number] = MARKER_BLOBS[0] // "prefix_foldername"
) {
  if (storageDisabled) throw new Error('storage disabled');
  const name = markerPath(prefix, markerName);
  const block = containerClient!.getBlockBlobClient(name);
  await block.upload('', 0, { metadata: meta });
}

/** Idempotent “ensure folder” that only swallows AlreadyExists (409). */
export async function ensureGroupFolder(prefix: string, extraMeta?: Record<string, string>) {
  const name = markerPath(prefix);
  try {
    await createFolderMarker(prefix, { createdAt: new Date().toISOString(), ...extraMeta });
    console.log('[provision] marker created', name);
  } catch (e: any) {
    if (e?.statusCode === 409 || e?.code === 'BlobAlreadyExists') {
      console.log('[provision] marker exists', name);
    } else {
      console.error('[provision] marker FAILED', e?.statusCode, e?.code, e?.message);
      throw e;
    }
  }
}

export async function listKeysByPrefix(prefix: string) {
  if (storageDisabled) throw new Error('storage disabled');
  const out: string[] = [];
  const p = ensureSlash(prefix);
  for await (const b of containerClient!.listBlobsFlat({ prefix: p })) out.push(b.name);
  return out;
}

/* ----------------------------- UPLOAD ----------------------------- */
/** Returns a PUT URL + headers the client must send. */
export async function initUpload(opts: {
  keyPrefix: string;          // e.g., "groups/<id>/" or "groups/<id>/sub/"
  filename: string;           // e.g., "report.pdf" (already uniqued by the route)
  mimeType?: string;
  expiresInSeconds?: number;  // default 300
}) {
  const { keyPrefix, filename, mimeType, expiresInSeconds = 300 } = opts;

  // ✅ Treat keyPrefix+filename as FINAL. No date/uuid rewriting.
  const p = ensureSlash(keyPrefix);
  const key = `${p}${filename}`;

  if (storageDisabled) throw new Error('storage disabled');
  const blobClient = containerClient!.getBlobClient(key);

  const now = new Date();
  const startsOn = new Date(now.getTime() - 60_000);
  const expiresOn = new Date(now.getTime() + expiresInSeconds * 1000);

  const udk = await service!.getUserDelegationKey(startsOn, expiresOn);
  const perms = BlobSASPermissions.parse('cw'); // create + write

  const sas = generateBlobSASQueryParameters(
  { containerName: container!, blobName: key, permissions: perms, startsOn, expiresOn },
    udk,
  account!
  ).toString();

  // Client MUST send these headers on the PUT
  const headers: Record<string, string> = { 'x-ms-blob-type': 'BlockBlob' };
  if (mimeType) headers['x-ms-blob-content-type'] = mimeType;

  return {
    key,                                        // full blob key (matches what route returns)
  uploadUrl: `${blobClient.url}?${sas}`,      // primary field for clients
  url: `${blobClient.url}?${sas}`,            // backward-compatible alias (legacy clients)
    headers,
    expiresAt: expiresOn.toISOString(),
  };
}

/* ---------------------------- DOWNLOAD ---------------------------- */

export async function getDownloadUrl(
  key: string,
  opts?: { filename?: string; mimeType?: string; expiresInSeconds?: number }
) {
  if (storageDisabled) throw new Error('storage disabled');
  const blobClient = containerClient!.getBlobClient(key);
  const now = new Date();
  const startsOn = new Date(now.getTime() - 60_000);
  const expiresOn = new Date(now.getTime() + (opts?.expiresInSeconds ?? 300) * 1000);
  const udk = await service!.getUserDelegationKey(startsOn, expiresOn);
  const perms = BlobSASPermissions.parse('r');

  const sas = generateBlobSASQueryParameters(
    {
  containerName: container!,
      blobName: key,
      permissions: perms,
      startsOn,
      expiresOn,
      contentDisposition: opts?.filename ? `attachment; filename="${opts.filename}"` : undefined,
      contentType: opts?.mimeType,
    },
    udk,
  account!
  ).toString();

  return `${blobClient.url}?${sas}`;
}

/* ----------------------------- DELETE ----------------------------- */

export async function deleteObject(key: string) {
  if (storageDisabled) throw new Error('storage disabled');
  await containerClient!
    .deleteBlob(key, { deleteSnapshots: 'include' })
    .catch((e: any) => {
      if (e?.statusCode !== 404) throw e;
    });
}

/* ------------------------------ MOVE ------------------------------ */

async function getReadSasUrl(key: string, seconds = 300) {
  if (storageDisabled) throw new Error('storage disabled');
  const blobClient = containerClient!.getBlobClient(key);
  const now = new Date();
  const startsOn = new Date(now.getTime() - 60_000);
  const expiresOn = new Date(now.getTime() + seconds * 1000);
  const udk = await service!.getUserDelegationKey(startsOn, expiresOn);
  const sas = generateBlobSASQueryParameters(
    {
  containerName: container!,
      blobName: key,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
    },
    udk,
  account!
  ).toString();
  return `${blobClient.url}?${sas}`;
}

export async function moveObject(oldKey: string, newKey: string) {
  if (storageDisabled) throw new Error('storage disabled');
  const srcWithSas = await getReadSasUrl(oldKey, 300);
  const dst = containerClient!.getBlockBlobClient(newKey);
  const poller = await dst.beginCopyFromURL(srcWithSas);
  await poller.pollUntilDone();
  await deleteObject(oldKey);
}