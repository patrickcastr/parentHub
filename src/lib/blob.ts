import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential
} from '@azure/storage-blob';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';

export function getContainerClient(containerName: string) {
  const service = BlobServiceClient.fromConnectionString(connectionString);
  return service.getContainerClient(containerName);
}

export async function uploadFile(
  containerName: string,
  blobName: string,
  content: Buffer,
  contentType: string
): Promise<void> {
  const containerClient = getContainerClient(containerName);
  await containerClient.createIfNotExists();
  const blockBlob = containerClient.getBlockBlobClient(blobName);
  await blockBlob.upload(content, content.length, { blobHTTPHeaders: { blobContentType: contentType } });
}

export function getSignedUrl(containerName: string, blobName: string, expirySeconds: number): string {
  const service = BlobServiceClient.fromConnectionString(connectionString);
  const accountName = service.accountName;
  // Narrow credential type
  const cred = service.credential as unknown as { accountKey?: string };
  const key = cred?.accountKey || '';
  const credential = new StorageSharedKeyCredential(accountName, key);
  const now = new Date();
  const expiresOn = new Date(now.getTime() + expirySeconds * 1000);
  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn
    },
    credential
  );
  return `${service.url}/${containerName}/${blobName}?${sas}`;
}
