import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listGroupFiles, uploadGroupFile } from '@/lib/api';
import { useStudentPreview } from '@/lib/useSession';
import { useState, useRef, DragEvent } from 'react';

function humanSize(bytes:number){
  if(bytes<1024) return bytes+' B';
  const units=['KB','MB','GB'];
  let v=bytes/1024, i=0; while(v>=1024 && i<units.length-1){ v/=1024; i++; }
  return v.toFixed(1)+' '+units[i];
}

export default function FilesPanel({ groupId, groupName, canUpload=true }:{ groupId:string; groupName?:string|null; canUpload?:boolean; }){
  const { preview, editable } = useStudentPreview();
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1);
  const qc = useQueryClient();
  const filesQ = useQuery<any>({ queryKey:['files', groupId, search, page], queryFn: ()=> listGroupFiles({ groupId, search, page, size:20 }) });
  const uploadMut = useMutation({ mutationFn: ({file}:{file:File})=> uploadGroupFile({ groupId, file }), onSuccess:()=> qc.invalidateQueries({ queryKey:['files', groupId] }),
    onMutate: async()=> { if(!editable) throw new Error('Preview mode'); }
  });
  const inputRef = useRef<HTMLInputElement|null>(null);

  function onFiles(files: FileList|null){
    if(!files) return; const arr=Array.from(files); if(!arr.length) return; uploadMut.mutate({file: arr[0]});
  }
  function onDrop(e:DragEvent){ e.preventDefault(); if(!canUpload) return; onFiles(e.dataTransfer.files); }

  return <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-semibold">Your Group: {groupName || 'Unknown'}</h2>
    </div>
    {preview && <div className="p-3 text-xs bg-amber-100 border border-amber-300 rounded">Preview mode: You’re viewing the Student Hub as a teacher. Uploads and destructive actions are disabled.</div>}
    <div className="flex gap-2 items-center">
      <input placeholder="Search files" value={search} onChange={e=>{setSearch(e.target.value); setPage(1);}} className="border px-2 py-1 rounded" />
      {filesQ.isLoading && <span className="text-xs">Loading...</span>}
    </div>
    {canUpload && <div onClick={()=> editable && inputRef.current?.click()} onDragOver={e=>{e.preventDefault();}} onDrop={e=> { if(editable) onDrop(e); }} className={`border-2 border-dashed rounded p-6 text-center text-sm ${editable? 'cursor-pointer':'opacity-50 cursor-not-allowed'}`}>
      {uploadMut.isPending? 'Uploading...' : editable? 'Drag & drop file here or click to upload':'Uploads disabled in preview'}
      <input ref={inputRef} type="file" className="hidden" disabled={!editable} onChange={e=> editable && onFiles(e.target.files)} />
    </div>}
    <table className="w-full text-sm border">
      <thead><tr className="bg-gray-50 text-left"><th className="p-2">Name</th><th className="p-2">Type</th><th className="p-2">Size</th><th className="p-2">Uploaded</th><th className="p-2">Actions</th></tr></thead>
      <tbody>
        {filesQ.data?.items.map((f:any)=><tr key={f.id} className="border-t">
          <td className="p-2"><a className="text-blue-600 hover:underline" href={f.url} target="_blank" rel="noreferrer">{f.name}</a></td>
          <td className="p-2">{f.contentType}</td>
          <td className="p-2">{humanSize(f.size)}</td>
          <td className="p-2">{new Date(f.createdAt).toLocaleString()}</td>
          <td className="p-2 space-x-2"><a href={f.url} download className="text-xs text-blue-600">Download</a></td>
        </tr>)}
        {!filesQ.data?.items.length && !filesQ.isLoading && <tr><td colSpan={5} className="p-4 text-center text-gray-500">No files yet.</td></tr>}
      </tbody>
    </table>
    <div className="flex gap-2 items-center justify-end">
      <button disabled={page===1} onClick={()=> setPage(p=>p-1)} className="px-2 py-1 border rounded">Prev</button>
      <span className="text-xs">Page {page}</span>
      <button disabled={(filesQ.data?.items.length||0)<20} onClick={()=> setPage(p=>p+1)} className="px-2 py-1 border rounded">Next</button>
    </div>
  </div>;
}
