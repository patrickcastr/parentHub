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

const requireEnv = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`[storage] Missing env ${k}`);
  return v;
};

const account = requireEnv('AZURE_STORAGE_ACCOUNT');
const container = requireEnv('AZURE_STORAGE_CONTAINER');

const service = new BlobServiceClient(
  `https://${account}.blob.core.windows.net`,
  new DefaultAzureCredential()
);
export const containerClient = service.getContainerClient(container);

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
  const name = markerPath(prefix, markerName);
  const block = containerClient.getBlockBlobClient(name);
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
  const out: string[] = [];
  const p = ensureSlash(prefix);
  for await (const b of containerClient.listBlobsFlat({ prefix: p })) out.push(b.name);
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

  const blobClient = containerClient.getBlobClient(key);

  const now = new Date();
  const startsOn = new Date(now.getTime() - 60_000);
  const expiresOn = new Date(now.getTime() + expiresInSeconds * 1000);

  const udk = await service.getUserDelegationKey(startsOn, expiresOn);
  const perms = BlobSASPermissions.parse('cw'); // create + write

  const sas = generateBlobSASQueryParameters(
    { containerName: container, blobName: key, permissions: perms, startsOn, expiresOn },
    udk,
    account
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
  const blobClient = containerClient.getBlobClient(key);
  const now = new Date();
  const startsOn = new Date(now.getTime() - 60_000);
  const expiresOn = new Date(now.getTime() + (opts?.expiresInSeconds ?? 300) * 1000);
  const udk = await service.getUserDelegationKey(startsOn, expiresOn);
  const perms = BlobSASPermissions.parse('r');

  const sas = generateBlobSASQueryParameters(
    {
      containerName: container,
      blobName: key,
      permissions: perms,
      startsOn,
      expiresOn,
      contentDisposition: opts?.filename ? `attachment; filename="${opts.filename}"` : undefined,
      contentType: opts?.mimeType,
    },
    udk,
    account
  ).toString();

  return `${blobClient.url}?${sas}`;
}

/* ----------------------------- DELETE ----------------------------- */

export async function deleteObject(key: string) {
  await containerClient
    .deleteBlob(key, { deleteSnapshots: 'include' })
    .catch((e: any) => {
      if (e?.statusCode !== 404) throw e;
    });
}

/* ------------------------------ MOVE ------------------------------ */

async function getReadSasUrl(key: string, seconds = 300) {
  const blobClient = containerClient.getBlobClient(key);
  const now = new Date();
  const startsOn = new Date(now.getTime() - 60_000);
  const expiresOn = new Date(now.getTime() + seconds * 1000);
  const udk = await service.getUserDelegationKey(startsOn, expiresOn);
  const sas = generateBlobSASQueryParameters(
    {
      containerName: container,
      blobName: key,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
    },
    udk,
    account
  ).toString();
  return `${blobClient.url}?${sas}`;
}

export async function moveObject(oldKey: string, newKey: string) {
  const srcWithSas = await getReadSasUrl(oldKey, 300);
  const dst = containerClient.getBlockBlobClient(newKey);
  const poller = await dst.beginCopyFromURL(srcWithSas);
  await poller.pollUntilDone();
  await deleteObject(oldKey);
}