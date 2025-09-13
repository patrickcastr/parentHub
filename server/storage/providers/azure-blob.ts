import { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import path from 'path';
import { customAlphabet } from 'nanoid';
import { IStorageProvider, InitUploadInput, InitUploadResult } from '../IStorageProvider';

const account = process.env.AZURE_STORAGE_ACCOUNT!;
const container = process.env.AZURE_STORAGE_CONTAINER!;
const accountUrl = `https://${account}.blob.core.windows.net`;

const credential = new DefaultAzureCredential();
const service = new BlobServiceClient(accountUrl, credential);
export const containerClient = service.getContainerClient(container);
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

function ensureSlash(p: string){ return p.endsWith('/') ? p : p + '/'; }
function yyyyMmDd(){ const d=new Date(); return { y:d.getUTCFullYear(), m:String(d.getUTCMonth()+1).padStart(2,'0'), d:String(d.getUTCDate()).padStart(2,'0') }; }
function extFrom(filename?: string){ const ext = filename? path.extname(filename):''; return ext && ext.startsWith('.')? ext:''; }
export function buildBlobKey(prefix: string, originalName?: string){ const p=ensureSlash(prefix); const {y,m,d}=yyyyMmDd(); const id=nanoid(); const ext=extFrom(originalName); return `${p}${y}/${m}/${d}/${id}${ext}`; }
export function buildArchivedKey(storagePrefix: string, oldKey: string){
  const p = ensureSlash(storagePrefix);
  const base = path.basename(oldKey);
  const { y, m, d } = yyyyMmDd();
  return `${p}archived/${y}/${m}/${d}/${base}`;
}

export async function moveObject(oldKey: string, newKey: string){
  const src = containerClient.getBlobClient(oldKey);
  const dst = containerClient.getBlockBlobClient(newKey);
  const poller = await dst.beginCopyFromURL(src.url);
  await poller.pollUntilDone();
  await src.delete({ deleteSnapshots: 'include' }).catch((e:any)=> { if (e.statusCode===404) return; throw e; });
}

export class AzureBlobStorageProvider implements IStorageProvider {
  async initUpload(input: InitUploadInput): Promise<InitUploadResult> {
    const now = new Date();
    const startsOn = new Date(now.getTime() - 60_000);
    const expiresOn = new Date(now.getTime() + 5 * 60_000);
    const key = buildBlobKey(input.keyPrefix, (input as any).filename);
    const blobClient = containerClient.getBlobClient(key);
    const userDelegationKey = await service.getUserDelegationKey(startsOn, expiresOn);
    const perms = BlobSASPermissions.parse('cw');
    const sas = generateBlobSASQueryParameters({ containerName: container, blobName: key, permissions: perms, startsOn, expiresOn, contentType: input.mimeType }, userDelegationKey, account).toString();
    return { key, uploadUrl: `${blobClient.url}?${sas}`, headers: {}, expiresAt: expiresOn.toISOString() };
  }
  async getDownloadUrl(key: string, opts?: { expiresInSeconds?: number; filename?: string; mimeType?: string; }): Promise<string> {
    const now = new Date();
    const startsOn = new Date(now.getTime() - 60_000);
    const expiresOn = new Date(now.getTime() + (opts?.expiresInSeconds ?? 300) * 1000);
    const blobClient = containerClient.getBlobClient(key);
    const userDelegationKey = await service.getUserDelegationKey(startsOn, expiresOn);
    const perms = BlobSASPermissions.parse('r');
    const sas = generateBlobSASQueryParameters({ containerName: container, blobName: key, permissions: perms, startsOn, expiresOn, contentDisposition: opts?.filename? `attachment; filename="${opts.filename}"`: undefined, contentType: opts?.mimeType }, userDelegationKey, account).toString();
    return `${blobClient.url}?${sas}`;
  }
  async deleteObject(key: string): Promise<void> {
    await containerClient.deleteBlob(key, { deleteSnapshots: 'include' }).catch((e:any)=> { if (e.statusCode===404) return; throw e; });
  }
  async createFolderMarker(prefix: string, meta?: Record<string,string>): Promise<void> {
    const p = ensureSlash(prefix); const name = `${p}_folder`; const block = containerClient.getBlockBlobClient(name); await block.upload('',0,{ metadata: meta });
  }
  async listKeysByPrefix(prefix: string): Promise<string[]> {
    const p = ensureSlash(prefix); const out: string[] = []; for await (const b of containerClient.listBlobsFlat({ prefix: p })) out.push(b.name); return out;
  }
}
