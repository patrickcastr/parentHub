import { containerClient, createFolderMarker } from '../storage/azure-blob';
import { buildBlobKey } from '../storage/azure-blob';
process.env.AZURE_STORAGE_ACCOUNT  ||= 'parenthubstorage';
process.env.AZURE_STORAGE_CONTAINER ||= 'parenthub-dev';
async function main() {
    const env = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`[storage] Missing env ${k}`); return v; };
    const account   = 'parenthubstorage';
    const container = 'parenthub-dev';
    console.log('[smoke] starting');
    console.log('[init] container:', containerClient.containerName);
    await containerClient.createIfNotExists();
    const gid = 'smoke-' + Math.random().toString(36).slice(2,8);
    const prefix = `groups/${gid}/`;
    console.log('[provision] creating marker for', prefix);
    await createFolderMarker(prefix, { createdBy: 'smoke' });

    // optional: prove upload SAS works
    const key = buildBlobKey(prefix, 'hello.txt');
    console.log('[result] expect to see:', prefix + '_folder', 'and', key.split('/').slice(0,-1).join('/') + '/…');
}
main().catch(e => { console.error(e); process.exit(1); });