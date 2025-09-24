import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listGroups, createGroup, deleteGroup, GroupRow, API } from '@/lib/api';
import EditGroupModal, { GroupLike } from '@/components/EditGroupModal';
import GroupFilesModal from '@/components/GroupFilesModal';
import UploadFileModal from '@/components/UploadFileModal';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

export function GroupsPanel(){
  const qc = useQueryClient();
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [statusFilter,setStatusFilter] = useState<'ALL'|'ACTIVE'|'UPCOMING'>('ALL');
  const { data, isLoading, refetch } = useQuery({ queryKey:['groups',search,page], queryFn: ()=> listGroups({search,page,limit:10}) });
  const createMut = useMutation({ mutationFn: createGroup, onSuccess:()=> qc.invalidateQueries({queryKey:['groups']}) });
  const delMut = useMutation({ mutationFn: (id:string)=> deleteGroup(id), onSuccess:()=> qc.invalidateQueries({queryKey:['groups']}) });
  const [editOpen,setEditOpen]=useState(false);
  const [editing,setEditing]=useState<GroupLike|null>(null);
  const [uploadOpen,setUploadOpen]=useState(false);
  const [uploadGroup,setUploadGroup]=useState<string|null>(null);
  const [filesModal,setFilesModal]=useState<{open:boolean; groupId:string|null; groupName?:string}>({open:false, groupId:null});
  const role = 'teacher'; // TODO: integrate real auth hook
  function openEdit(row:any){ setEditing(row); setEditOpen(true); }
  async function refresh(){ await refetch(); }
  return <div className="space-y-4">
    <h2 className="text-xl font-semibold">Groups</h2>
    <form onSubmit={async (e)=>{
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement; // capture synchronously
      const body = {
        name: name.trim(),
        startsOn: startDate ? new Date(startDate).toISOString() : null,
      };
  const url = `${API}/api/groups`;
      console.group('Create Group');
      try {
        console.log('Request →', { url, body });
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
        console.log('Response status →', `${res.status} ${res.statusText}`);
        let json: any = null;
        try { json = await res.json(); console.log('Response body →', json); } catch (err) { console.warn('Response parse error →', (err as any)?.message || err); }
        if (!res.ok) { console.error('Create group error →', json || `HTTP ${res.status}`); return; }
        // clear inputs safely
        setName('');
        setStartDate('');
        form?.reset?.();
        await qc.invalidateQueries({ queryKey:['groups'] });
      } catch (err:any) {
        console.error('Create group error →', err?.message || err);
      } finally {
        console.groupEnd();
      }
    }} className="flex gap-2 flex-wrap items-end border p-3 rounded">
      <div className="flex flex-col"><label className="text-xs">Name</label><input name="name" required className="border px-2 py-1 rounded" value={name} onChange={e=> setName(e.target.value)} /></div>
      <div className="flex flex-col">
        <label className="text-xs">Start Date</label>
        <input type="date" name="startsOn" className="border px-2 py-1 rounded" value={startDate} onChange={e=> setStartDate(e.target.value)} />
        {startDate && new Date(startDate+'T00:00:00Z').getTime() > Date.now() && (
          <span className="text-[10px] text-amber-600 mt-1">Heads up: you won’t be able to assign students until this date.</span>
        )}
      </div>
      <button disabled={createMut.isPending} className="bg-blue-600 text-white px-3 py-1 rounded">{createMut.isPending? 'Creating...':'Create Group'}</button>
    </form>
    <div className="flex gap-2 items-center flex-wrap">
      <input placeholder="Search" value={search} onChange={e=>{setSearch(e.target.value); setPage(1);}} className="border px-2 py-1 rounded"/>
      <div className="flex items-center gap-1 text-xs">
        <span>Status:</span>
        {(['ALL','ACTIVE','UPCOMING'] as const).map(f=> <button key={f} onClick={()=> setStatusFilter(f)} className={`px-2 py-0.5 rounded border ${statusFilter===f? 'bg-slate-800 text-white':'bg-white'}`}>{f}</button>)}
      </div>
      {isLoading && <span className="text-xs">Loading...</span>}
    </div>
    <table className="w-full text-sm border">
      <thead><tr className="bg-gray-50 text-left"><th className="p-2">Name</th><th className="p-2">Start</th><th className="p-2">End</th><th className="p-2">Members</th><th className="p-2">Created</th><th className="p-2">Actions</th></tr></thead>
      <tbody>
        {data?.items.filter((g:GroupRow)=> {
          const start = g.startDate || g.startsOn; const startMs = start ? new Date(start).getTime() : null; const now=Date.now();
          const upcoming = !!(startMs && startMs>now);
          if(statusFilter==='UPCOMING') return upcoming; if(statusFilter==='ACTIVE') return !upcoming; return true;
        }).map((g:GroupRow)=> <tr key={g.id} className="border-t">
          <td className="p-2">{g.name}</td>
          <td className="p-2">{g.startDate ? new Date(g.startDate).toLocaleDateString() : '—'} {(() => { const s=g.startDate||g.startsOn; if(!s) return null; const ms=new Date(s).getTime(); if(isNaN(ms)) return null; if(ms>Date.now()) return <span className="ml-1 inline-block text-[10px] px-1 py-0.5 bg-amber-100 text-amber-700 rounded">Upcoming</span>; return <span className="ml-1 inline-block text-[10px] px-1 py-0.5 bg-green-100 text-green-700 rounded">Active</span>; })()}</td>
          <td className="p-2">{g.endDate ? new Date(g.endDate).toLocaleDateString() : '—'}</td>
          <td className="p-2 text-center">{(g as any).memberCount ?? '-'}</td>
          <td className="p-2">{g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '—'}</td>
          <td className="p-2">
            <div className="relative inline-block text-left">
              <Menu g={g} role={role} onEdit={()=> openEdit(g)} onDelete={()=> { if(confirm('Delete this group?')) delMut.mutate(g.id); }} onViewFiles={()=> { setFilesModal({ open:true, groupId:g.id, groupName:g.name }); }} onUpload={()=> { setUploadGroup(g.id); setUploadOpen(true); }} />
            </div>
          </td>
        </tr>)}
        {!data?.items.length && <tr><td colSpan={6} className="p-4 text-center text-gray-500">No groups yet.</td></tr>}
      </tbody>
    </table>
    <div className="flex gap-2 items-center justify-end">
      <button disabled={page===1} onClick={()=> setPage(p=>p-1)} className="px-2 py-1 border rounded">Prev</button>
      <span className="text-xs">Page {page}</span>
  <button disabled={(data?.items.length||0)<10} onClick={()=> setPage(p=>p+1)} className="px-2 py-1 border rounded">Next</button>
    </div>
    <EditGroupModal open={editOpen} onOpenChange={setEditOpen} group={editing} onSaved={refresh} />
    <UploadFileModal open={uploadOpen} onOpenChange={setUploadOpen} groupId={uploadGroup} onUploaded={refresh} />
  <GroupFilesModal open={filesModal.open} onOpenChange={(v)=> setFilesModal(m=> ({...m, open:v}))} groupId={filesModal.groupId} groupName={filesModal.groupName} />
  </div>;
}

function Menu({ g, role, onEdit, onDelete, onViewFiles, onUpload }: { g:any; role:string; onEdit:()=>void; onDelete:()=>void; onViewFiles:()=>void; onUpload:()=>void; }){
  const [open,setOpen]=useState(false);
  return <div>
    <button onClick={(e)=> { e.stopPropagation(); setOpen(o=>!o); }} className="p-1 rounded hover:bg-gray-200"><MoreHorizontal className="w-4 h-4" /></button>
    {open && <div className="absolute right-0 mt-1 w-44 bg-white border rounded shadow z-10 text-xs" onClick={e=> e.stopPropagation()}>
      <button className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={()=> { onViewFiles(); setOpen(false); }}>View Files</button>
  {role==='TEACHER' && <button className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={()=> { onUpload(); setOpen(false); }}>Upload File</button>}
  {role==='TEACHER' && <button className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={()=> { onEdit(); setOpen(false); }}>Edit Group</button>}
  {role==='TEACHER' && <button className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600" onClick={()=> { onDelete(); setOpen(false); }}>Delete Group</button>}
    </div>}
  </div>;
}
