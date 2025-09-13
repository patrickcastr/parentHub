import { useState } from "react";
import { initUpload, completeUpload } from "@/lib/api/files";

export default function UploadFileModal({ groupId, onClose, onDone }:{ groupId:string; onClose:()=>void; onDone:()=>void; }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  async function onSubmit(){
    if(!file) return;
    setBusy(true);
    try{
      const { uploadUrl, key, headers } = await initUpload(groupId, { filename:file.name, mimeType:file.type, sizeBytes:file.size });
      const put = await fetch(uploadUrl, { method:"PUT", headers, body: file });
      if(!put.ok) throw new Error("upload failed");
      await completeUpload({ groupId, key, filename:file.name, mimeType:file.type, sizeBytes:file.size });
      onDone();
    }catch(e){ alert((e as Error).message); }
    finally{ setBusy(false); onClose(); }
  }
  return (
    <div className="p-4 space-y-3">
      <input type="file" onChange={e=>setFile(e.target.files?.[0] ?? null)} />
      <div className="flex gap-2 justify-end">
        <button className="border px-3 py-1 rounded" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="bg-black text-white px-3 py-1 rounded" onClick={onSubmit} disabled={!file || busy}>{busy ? "Uploading..." : "Upload"}</button>
      </div>
    </div>
  );
}
