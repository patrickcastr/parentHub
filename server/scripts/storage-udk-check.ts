import 'dotenv/config';
import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';
import { ClientSecretCredential } from '@azure/identity';

async function main() {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_CONTAINER } = process.env as Record<string, string | undefined>;
  const containerName = AZURE_STORAGE_CONTAINER || 'parenthub-dev';
  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_STORAGE_ACCOUNT) {
    throw new Error('Missing env vars.');
  }

  const cred = new ClientSecretCredential(AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET);
  const svc  = new BlobServiceClient(`https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`, cred);

  const startsOn  = new Date(Date.now() - 5 * 60 * 1000);
  const expiresOn = new Date(Date.now() + 15 * 60 * 1000);
  const udk = await svc.getUserDelegationKey(startsOn, expiresOn);
  console.log('✅ Acquired User Delegation Key. Expires:', expiresOn.toISOString());

  const sas = generateBlobSASQueryParameters({
    containerName,
    blobName: 'healthcheck.txt',
    permissions: BlobSASPermissions.parse('r'),
    startsOn,
    expiresOn,
  }, udk, AZURE_STORAGE_ACCOUNT).toString();
  console.log('✅ Generated sample SAS string (length):', sas.length);
}

main().catch(e => { console.error('❌ UDK check FAILED:', e?.message || e); process.exit(1); });
