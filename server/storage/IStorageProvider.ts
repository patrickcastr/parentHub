export type InitUploadInput = { keyPrefix: string; mimeType?: string; sizeBytes?: number; filename?: string };
export type InitUploadResult = { uploadUrl: string; key: string; headers?: Record<string,string>; expiresAt: string };
export interface IStorageProvider {
  initUpload(input: InitUploadInput): Promise<InitUploadResult>;
  getDownloadUrl(key: string, opts?: { expiresInSeconds?: number; filename?: string; mimeType?: string }): Promise<string>;
  deleteObject(key: string): Promise<void>;
  createFolderMarker?(prefix: string, meta?: Record<string,string>): Promise<void>;
  listKeysByPrefix?(prefix: string): Promise<string[]>;
}
