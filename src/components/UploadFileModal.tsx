import { useState, useEffect } from 'react';
import { initUpload, completeUpload } from '@/lib/api/files';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function Overlay({ children }: { children: any }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow w-full max-w-md p-4">{children}</div>
    </div>
  );
}

// Environment-driven config
declare const importMetaEnv: any;
// @ts-ignore
const MAX_MB = Number((typeof importMetaEnv !== 'undefined' && importMetaEnv.VITE_MAX_FILE_MB) || 25);
// @ts-ignore
const MIME_RAW =
  (typeof importMetaEnv !== 'undefined' && importMetaEnv.VITE_MIME_WHITELIST) ||
  'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg';
const ALLOWED = MIME_RAW.split(',');

export interface UploadFileModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string | null;
  onUploaded: () => void;
}

export default function UploadFileModal({
  open,
  onOpenChange,
  groupId,
  onUploaded,
}: UploadFileModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setError('');
      setProgress(0);
      setUploading(false);
    }
  }, [open]);

  function validate(f: File): string {
    if (!ALLOWED.includes(f.type)) return 'Unsupported file type';
    if (f.size > MAX_MB * 1024 * 1024) return `File exceeds ${MAX_MB}MB limit`;
    return '';
  }

  const onSubmit = async () => {
    if (!file || !groupId) return;

    const v = validate(file);
    if (v) {
      setError(v);
      return;
    }

    setUploading(true);
    setError('');
    setProgress(5);

    try {
      // ✅ Send ONLY the filename, server will prepend groups/<id>/
      const init = await initUpload(groupId, {
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      console.group('Upload debug');
      console.log('initUpload response:', init);

      const sasUrl: string | undefined = (init as any).uploadUrl ?? (init as any).url;
      if (!sasUrl || typeof sasUrl !== 'string' || !sasUrl.startsWith('http')) {
        console.error('No valid SAS URL in initUpload response', init);
        throw new Error('Server did not return uploadUrl/url');
      }

      const headers: Record<string, string> = {
        'x-ms-blob-type': 'BlockBlob',
        ...((init as any).headers || {}),
      };

      console.log('PUT to SAS URL:', sasUrl, 'with headers:', headers);
      console.groupEnd();

      // ✅ Single PUT
      const putRes = await fetch(sasUrl, { method: 'PUT', headers, body: file });
      if (!putRes.ok) {
        const txt = await putRes.text().catch(() => '');
        throw new Error(`Blob PUT failed: ${putRes.status} ${txt}`);
      }

      setProgress(90);

      // ✅ Notify backend of completion with server-resolved key
      const finalKey: string | undefined = (init as any).key;
      const resolvedFilename: string = (init as any).resolvedFilename || file.name;
      if (!finalKey) throw new Error('Server did not return a final key');

      await completeUpload({
        groupId,
        key: finalKey,
        filename: resolvedFilename,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      setProgress(100);
      onUploaded();
      onOpenChange(false);
    } catch (e: any) {
      console.error('Upload failed:', e);
      setError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;
  return (
    <Overlay>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">Upload File</h2>
          <button onClick={() => onOpenChange(false)} className="text-sm text-gray-500">
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <Input
            type="file"
            accept={ALLOWED.join(',')}
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              setError(f ? validate(f) : '');
            }}
          />
          {file && (
            <div className="text-xs text-gray-600">
              {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {uploading && (
            <div className="w-full bg-gray-200 h-2 rounded">
              <div className="bg-blue-600 h-2 rounded" style={{ width: progress + '%' }} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!file || !!error || uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
        <p className="text-[10px] text-gray-500">
          Allowed: {ALLOWED.join(', ')} • Max {MAX_MB}MB
        </p>
      </div>
    </Overlay>
  );
}