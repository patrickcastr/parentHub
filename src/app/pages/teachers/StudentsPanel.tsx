import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listStudents, listGroups, assignStudentGroup, importStudentsCsv } from '@/lib/api';
import { useState } from 'react';
import { useAuth } from '@/state/authStore';

export function StudentsPanel(){
  const qc = useQueryClient();
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(1);
  const studentsQ = useQuery({ queryKey:['students',search,page], queryFn: ()=> listStudents({search,page,limit:10}) });
  const groupsQ = useQuery({ queryKey:['groups','for-students'], queryFn: ()=> listGroups({limit:100})});
  const assignMut = useMutation({
    mutationFn: ({id, groupId, override}:{id:string; groupId:string|null; override?: boolean})=> assignStudentGroup(id, groupId, override),
    onSuccess:()=> qc.invalidateQueries({queryKey:['students']}),
    onError:(err:any)=>{
      let msg = String(err?.message||'');
      if(msg.startsWith('{')){
        try { const j = JSON.parse(msg); if(j.code==='GROUP_START_IN_FUTURE'){ msg = `Can’t assign to ${j.groupName} — starts on ${j.startDate}.`; } } catch {}
      }
      // Basic surfacing; elsewhere we have toast util, but keeping simple here
      alert(msg);
    }
  });
  const csvMut = useMutation({ mutationFn: (file:File)=> importStudentsCsv(file), onSuccess:()=> qc.invalidateQueries({queryKey:['students']}) });
  const { state } = useAuth();
  const isTeacher = state.status === 'signedIn' && state.user.role === 'TEACHER';
  const now = Date.now();
  const [overrideEnabled,setOverrideEnabled] = useState(false);
  return <div className="space-y-4">
    <h2 className="text-xl font-semibold">Students</h2>
    <form onSubmit={e=>{e.preventDefault(); const f=(e.currentTarget.elements.namedItem('file') as HTMLInputElement); if(f.files?.[0]) csvMut.mutate(f.files[0]);}} className="flex items-end gap-2 flex-wrap border p-3 rounded">
      <div className="flex flex-col"><label className="text-xs">CSV Import</label><input name="file" type="file" accept='.csv' className="border rounded px-2 py-1"/></div>
      <button className="bg-blue-600 text-white px-3 py-1 rounded" disabled={csvMut.isPending}>{csvMut.isPending? 'Importing...':'Import CSV'}</button>
  {csvMut.data ? (<span className="text-xs text-green-600">Imported {(csvMut.data as any).results?.filter((r:any)=> r.status==='ok').length ?? 0} / {(csvMut.data as any).total ?? 0}</span>) : null}
    </form>
    <div className="flex gap-2 items-center"><input placeholder="Search" value={search} onChange={e=>{setSearch(e.target.value); setPage(1);}} className="border px-2 py-1 rounded"/> {studentsQ.isLoading && <span className="text-xs">Loading...</span>}</div>
    <table className="w-full text-sm border">
      <thead><tr className="bg-gray-50 text-left"><th className="p-2">Name</th><th className="p-2">Username</th><th className="p-2">Email</th><th className="p-2">Group</th><th className="p-2">Actions</th></tr></thead>
      <tbody>
        {studentsQ.data?.items.map(s=> <tr key={s.id} className="border-t">
          <td className="p-2">{s.firstName} {s.lastName}</td>
          <td className="p-2">{s.username}</td>
          <td className="p-2">{s.email}</td>
          <td className="p-2">
            {s.groupName || '-'}
            {(function(){
              const grp = groupsQ.data?.items.find((g:any)=> g.id===s.groupId);
              if(!grp) return null;
              const start = grp.startDate || grp.startsOn; if(!start) return null;
              const ms = new Date(start).getTime(); if(isNaN(ms) || ms <= now) return null;
              return <span className="ml-2 text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">Starts {new Date(start).toLocaleDateString()}</span>;
            })()}
          </td>
          <td className="p-2">
            <div className="flex flex-col gap-1">
              <select defaultValue={s.groupId || ''} onChange={e=> assignMut.mutate({id:s.id, groupId: e.target.value || null, override: overrideEnabled })} className="border px-1 py-0.5 rounded text-xs">
                <option value=''>Unassigned</option>
                {groupsQ.data?.items.map(g=> {
                  const start = g.startDate || g.startsOn; const disabled = !!(start && new Date(start).getTime() > now);
                  const label = g.name;
                  return <option key={g.id} value={g.id} disabled={disabled && !isTeacher} title={disabled ? `Starts on ${start && new Date(start).toLocaleDateString()} — students can be assigned when the start date has passed.`: ''}>{label}</option>;
                })}
              </select>
              {isTeacher && <label className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                <input type="checkbox" checked={overrideEnabled} onChange={e=> setOverrideEnabled(e.target.checked)} /> Allow early assignment (override)
              </label>}
            </div>
          </td>
        </tr>)}
        {!studentsQ.data?.items.length && <tr><td colSpan={5} className="p-4 text-center text-gray-500">No students yet.</td></tr>}
      </tbody>
    </table>
    <div className="flex gap-2 items-center justify-end">
      <button disabled={page===1} onClick={()=> setPage(p=>p-1)} className="px-2 py-1 border rounded">Prev</button>
      <span className="text-xs">Page {page}</span>
      <button disabled={(studentsQ.data?.items.length||0)<10} onClick={()=> setPage(p=>p+1)} className="px-2 py-1 border rounded">Next</button>
    </div>
  </div>;
}
