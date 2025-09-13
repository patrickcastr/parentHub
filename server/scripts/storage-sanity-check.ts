import 'dotenv/config';
import { BlobServiceClient } from '@azure/storage-blob';
import { ClientSecretCredential } from '@azure/identity';

async function main() {
  // Read ONLY. Do not attempt to write .env.
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const accountName = process.env.AZURE_STORAGE_ACCOUNT;

  if (!tenantId || !clientId || !clientSecret || !accountName) {
    throw new Error('Missing env vars: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_STORAGE_ACCOUNT');
  }

  const cred = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const svc = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, cred);

  const info = await svc.getAccountInfo();
  console.log('✅ Azure Storage reachable.');
  console.log('Account SKU:', info.skuName);
  console.log('Account Kind:', info.accountKind);
}

main().catch((err) => {
  console.error('❌ Sanity check FAILED.');
  console.error(err?.message || err);
  process.exit(1);
});
