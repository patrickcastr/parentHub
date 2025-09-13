/**
 * DEPRECATED: Use `server/storage/storage-groups.ts` for group prefix + folder marker helpers.
 * This file remains temporarily for list/delete utilities still referenced.
 */
import 'dotenv/config';
import { containerClient as container } from '../storage/storage';

export function buildGroupPrefix(groupId: string) {
  return `groups/${groupId.replace(/[^a-zA-Z0-9_-]/g, '')}/`;
}

export async function ensureGroupFolder(prefix: string): Promise<{ ok: true } | { ok: false; error: { statusCode?: number; code?: string; message?: string } }> {
  const cleanPrefix = prefix.replace(/^\/+/, '').replace(/\/+$/, '') + '/';
  const blobName = `${cleanPrefix}.keep`;
  console.log('[storage] ensureGroupFolder →', {
    account: container.url,
    container: container.containerName,
    blobName,
  });
  const marker = container.getBlockBlobClient(blobName);
  try {
    const resp = await marker.upload('', 0, {
      blobHTTPHeaders: { blobContentType: 'text/plain' },
      metadata: { createdBy: 'parenthub-api', purpose: 'folder-marker' },
      tags: { scope: 'group' },
    });
    console.log('[storage] upload OK', { etag: resp.etag, lastModified: resp.lastModified });
    return { ok: true };
  } catch (e: any) {
    if (e?.statusCode === 409) {
      console.log('[storage] marker already exists:', marker.name);
      return { ok: true };
    }
    const detail = {
      statusCode: e?.statusCode as number | undefined,
      code: (e?.code || e?.details?.errorCode) as string | undefined,
      message: e?.message as string | undefined,
    };
    console.error('[storage] upload FAIL', detail);
    return { ok: false, error: detail };
  }
}

export { container };

export type ListResult = {
  items: { name: string; relative: string; size: number; contentType?: string; lastModified?: string }[];
  nextCursor?: string;
};

export async function listFilesInPrefix(prefix: string, limit = 50, cursor?: string): Promise<ListResult> {
  const p = prefix.replace(/^\/+/, '');
  const pager = container
    .listBlobsFlat({ prefix: p, includeMetadata: true })
    .byPage({ maxPageSize: limit, continuationToken: cursor });

  const page = (await pager.next()).value as any;
  const items = (page.segment?.blobItems || [])
    .filter((b: any) => !b.name.endsWith('/.keep'))
    .map((b: any) => ({
      name: b.name,
      relative: b.name.substring(p.length),
      size: Number(b.properties?.contentLength || 0),
      contentType: b.properties?.contentType,
      lastModified: b.properties?.lastModified?.toISOString(),
    }));
  return { items, nextCursor: page.continuationToken };
}

export async function deleteSingleBlob(path: string) {
  const client = container.getBlobClient(path);
  await client.deleteIfExists({ deleteSnapshots: 'include' });
}

export async function deletePrefixRecursive(prefix: string) {
  const p = prefix.replace(/^\/+/, '');
  const iterator = container.listBlobsFlat({ prefix: p, includeSnapshots: true }).byPage({ maxPageSize: 200 });
  for await (const page of iterator as any) {
    const blobs = page.segment?.blobItems || [];
    await Promise.all(
      blobs.map((b: any) => container.getBlobClient(b.name).deleteIfExists({ deleteSnapshots: 'include' }))
    );
  }
}
