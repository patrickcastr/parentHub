import { useEffect, useState } from 'react';
import { listGroupFilesStorage, readFileUrl, deleteFile, GroupBlobItem } from '@/lib/api/files';
import { Button } from '@/components/ui/button';
import UploadFileModal from '@/components/UploadFileModal';

interface Props { open: boolean; onOpenChange: (v:boolean)=>void; groupId: string | null; groupName?: string; }

export default function GroupFilesModal({ open, onOpenChange, groupId, groupName }: Props){
  const [items,setItems] = useState<GroupBlobItem[]>([]);
  const [cursor,setCursor] = useState<string|null>(null);
  const [nextCursor,setNextCursor] = useState<string|null>(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState<string>('');
  const [uploadOpen,setUploadOpen] = useState(false);
  const [refreshTick,setRefreshTick] = useState(0);

  useEffect(()=>{ if(open){ reload(); } }, [open, groupId, refreshTick]);

  function reload(){
    setItems([]); setCursor(null); setNextCursor(null); loadPage(null, true);
  }

  async function loadPage(c: string | null, replace = false){
    if(!groupId) return; setLoading(true); setError('');
    try {
      const data = await listGroupFilesStorage(groupId, c || undefined, 50);
      setItems(prev => (c && !replace ? [...prev, ...data.items] : data.items));
      setCursor(c);
      setNextCursor(data.nextCursor);
    } catch(e:any){ setError(e?.message || 'Failed to load files'); }
    finally { setLoading(false); }
  }

  async function onDownload(it: GroupBlobItem){
    if(!groupId) return; try {
      const { url } = await readFileUrl(groupId, it.key);
      window.open(url, '_blank');
    } catch(e:any){ alert(e?.message || 'Failed to download'); }
  }
  async function onDeleteItem(it: GroupBlobItem){
    if(!groupId) return; if(!confirm(`Delete ${it.name}?`)) return; try {
      await deleteFile(groupId, it.key);
      reload();
    } catch(e:any){ alert(e?.message || 'Delete failed'); }
  }
  async function onCopy(it: GroupBlobItem){
    if(!groupId) return; try { const { url } = await readFileUrl(groupId, it.key); await navigator.clipboard.writeText(url); } catch(e:any){ alert(e?.message||'Copy failed'); }
  }

  if(!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-4xl rounded shadow p-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center mb-4 gap-3">
          <h2 className="text-lg font-semibold">Files — {groupName || groupId}</h2>
          <div className="ml-auto flex gap-2 items-center">
            <Button variant="outline" onClick={()=> reload()} disabled={loading}>Refresh</Button>
            <Button variant="outline" onClick={()=> setUploadOpen(true)} disabled={!groupId || loading}>Upload</Button>
            <Button variant="outline" onClick={()=> onOpenChange(false)}>Close</Button>
          </div>
        </div>
        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
        <div className="overflow-auto border rounded flex-1">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-right px-3 py-2">Size</th>
                <th className="text-left px-3 py-2">Last Modified</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length===0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Loading…</td></tr>}
              {!loading && items.length===0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No files yet</td></tr>}
              {items.map(it => (
                <tr key={it.key} className="border-t">
                  <td className="px-3 py-2 break-all">{it.name}</td>
                  <td className="px-3 py-2 text-right">{it.size != null ? humanSize(it.size) : '—'}</td>
                  <td className="px-3 py-2">{it.lastModified ? new Date(it.lastModified).toLocaleString(): '—'}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button className="underline disabled:opacity-40" disabled={loading} onClick={()=> onDownload(it)}>Download</button>
                    <button className="underline disabled:opacity-40" disabled={loading} onClick={()=> onCopy(it)}>Copy Link</button>
                    <button className="underline text-red-600 disabled:opacity-40" disabled={loading} onClick={()=> onDeleteItem(it)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-3 text-sm">
          <div>{items.length} item(s)</div>
          <div className="flex gap-2 items-center">
            <Button variant="outline" disabled={loading || !nextCursor} onClick={()=> loadPage(nextCursor, false)}>Load more</Button>
          </div>
        </div>
        <UploadFileModal open={uploadOpen} onOpenChange={setUploadOpen} groupId={groupId} onUploaded={()=> { setUploadOpen(false); reload(); }} />
      </div>
    </div>
  );
}

function humanSize(bytes:number){
  if(bytes<1024) return bytes+' B';
  const units=['KB','MB','GB'];
  let v=bytes/1024, i=0; while(v>=1024 && i<units.length-1){ v/=1024; i++; }
  return v.toFixed(1)+' '+units[i];
}
