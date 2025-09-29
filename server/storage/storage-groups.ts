import { containerClient, storageDisabled } from './azure-blob';

const ensureSlash = (p: string) => (p.endsWith('/') ? p : p + '/');

// Canonical prefix builder (always trailing slash)
export const buildGroupPrefix = (id: string) => `groups/${id}/`;

// Create/ensure the group "folder" by uploading a zero-byte marker blob
export async function ensureGroupFolder(prefix: string, extraMeta?: Record<string,string>) {
  const name = `${ensureSlash(prefix)}_folder`; // consistent marker path
  if (storageDisabled || !containerClient) throw new Error('storage disabled');
  const blob = containerClient.getBlockBlobClient(name);

  console.log('[provision] ensureGroupFolder', {
    container: containerClient.containerName,
    name,
  });

  try {
  await blob.upload('', 0, { metadata: { createdAt: new Date().toISOString(), ...extraMeta } });
    console.log('[provision] marker created', name);
  } catch (e: any) {
    const code = e?.code || e?.details?.errorCode;
    const status = e?.statusCode;
    if (status === 409 || code === 'BlobAlreadyExists') {
      console.log('[provision] marker exists', name);
      return;
    }
    console.error('[provision] marker FAILED', { status, code, message: e?.message });
    throw e; // don't hide real failures
  }
}