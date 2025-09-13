import 'dotenv/config';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';

const accountName = process.env.AZURE_STORAGE_ACCOUNT || process.env.PARENTHUB_STORAGE_ACCOUNT;
const containerName = process.env.PARENTHUB_STORAGE_CONTAINER || process.env.AZURE_STORAGE_CONTAINER;

let credential: DefaultAzureCredential | ClientSecretCredential;
if (process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET) {
  credential = new ClientSecretCredential(process.env.AZURE_TENANT_ID, process.env.AZURE_CLIENT_ID, process.env.AZURE_CLIENT_SECRET);
} else {
  credential = new DefaultAzureCredential();
}

if (!accountName) {
  console.error('[storage] Missing AZURE_STORAGE_ACCOUNT (or PARENTHUB_STORAGE_ACCOUNT)');
}
if (!containerName) {
  console.error('[storage] Missing PARENTHUB_STORAGE_CONTAINER (or AZURE_STORAGE_CONTAINER). Tip: set it in server/.env');
}

const service = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, credential);
export const containerClient: ContainerClient = service.getContainerClient(containerName || '');

console.log('[storage] config', { accountUrl: service.url, containerName });
