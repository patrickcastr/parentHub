import { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters } from '@azure/storage-blob';
import { ClientSecretCredential } from '@azure/identity';

const accountName = (process.env.AZURE_STORAGE_ACCOUNT || process.env.PARENTHUB_STORAGE_ACCOUNT)!;
const containerName = process.env.PARENTHUB_STORAGE_CONTAINER || process.env.AZURE_STORAGE_CONTAINER || 'parenthub-dev';
const sasTtlMinutes = Number(process.env.FILE_SAS_TTL_MINUTES || 15);

function getServiceClient() {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing AAD credentials: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET');
  }
  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  return new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, credential);
}

export async function getReadUrl(blobName: string) {
  const serviceClient = getServiceClient();
  const container = serviceClient.getContainerClient(containerName);
  const startsOn = new Date(Date.now() - 5 * 60 * 1000);
  const expiresOn = new Date(Date.now() + sasTtlMinutes * 60 * 1000);
  const udk = await serviceClient.getUserDelegationKey(startsOn, expiresOn);
  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
    },
    udk,
    accountName,
  ).toString();
  return `${container.getBlockBlobClient(blobName).url}?${sas}`;
}

export async function getUploadUrl(blobName: string) {
  const serviceClient = getServiceClient();
  const container = serviceClient.getContainerClient(containerName);
  const startsOn = new Date(Date.now() - 5 * 60 * 1000);
  const expiresOn = new Date(Date.now() + sasTtlMinutes * 60 * 1000);
  const udk = await serviceClient.getUserDelegationKey(startsOn, expiresOn);
  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('cw'),
      startsOn,
      expiresOn,
    },
    udk,
    accountName,
  ).toString();
  return `${container.getBlockBlobClient(blobName).url}?${sas}`;
}
