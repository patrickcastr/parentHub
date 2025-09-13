import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updateGroup } from '@/lib/api/groups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Lightweight dialog replacement (since shadcn dialog component not present in repo). If you add one later, swap markup.
function Overlay({ children }: { children: any }) { return <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded shadow w-full max-w-md p-4">{children}</div></div>; }

// Minimal shape passed in from list row (may not include normalized startDate/endDate fields yet)
export type GroupLike = { id:string; name:string; startsOn?: string | null; endsOn?: string | null; startDate?: string|null; endDate?: string|null };
export type EditGroupModalProps = { open: boolean; onOpenChange:(v:boolean)=>void; group: GroupLike | null; onSaved: ()=>void; };

const toInputDate = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export default function EditGroupModal({ open, onOpenChange, group, onSaved }: EditGroupModalProps){
  const [name,setName]=useState('');
  const [start,setStart]=useState('');
  const [end,setEnd]=useState('');
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const qc = useQueryClient();

  // Load fresh group with normalized startDate/endDate when modal opens
  useEffect(()=>{
    let cancelled = false;
    async function load(){
      setError('');
      if(!group || !open){ return; }
      try {
        const res = await fetch(`/api/groups/${group.id}`, { credentials: 'include' });
        if(!res.ok) throw new Error(`load failed (${res.status})`);
        const g = await res.json();
        if(cancelled) return;
        setName(g.name || '');
        setStart(toInputDate(g.startDate ?? g.startsOn ?? null));
        setEnd(toInputDate(g.endDate ?? g.endsOn ?? null));
      } catch(e:any){
        if(cancelled) return;
        setError(e?.message || 'Failed to load group');
      }
    }
    load();
    return ()=> { cancelled = true; };
  },[group?.id, open]);

  function validate(): string {
    if(!name.trim()) return 'Name is required.';
    if(start && end){
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      if(e < s) return 'End date must be on or after start date.';
    }
    return '';
  }

  async function onSubmit(){
    const msg = validate();
    if(msg){ setError(msg); return; }
    if(!group) return;
    setSaving(true);
    try{
      const startDate = start ? start : null; // YYYY-MM-DD or null
      const endDate = end ? end : null;       // YYYY-MM-DD or null
      await updateGroup(group.id, { name: name.trim(), startDate, endDate });
      try {
        await qc.invalidateQueries({ queryKey: ['groups'], exact: false });
        console.debug('[groups] refetched after update');
      } catch (e) {
        console.warn('Failed to invalidate groups queries', e);
      }
      onSaved(); // downstream hook (may also refetch explicitly)
      onOpenChange(false); // close after refetch triggered
    }catch(e:any){
      setError(e?.message || 'Failed to save');
    }finally{ setSaving(false); }
  }

  if(!open) return null;

  return <Overlay>
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold">Edit Group</h2>
        <button onClick={()=> onOpenChange(false)} className="text-sm text-gray-500 hover:text-gray-800">✕</button>
      </div>
      <div className="space-y-3">
        <label className="block text-sm">Name
          <Input value={name} onChange={e=>setName(e.target.value)} placeholder="Group name" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Start date
            <Input type="date" value={start} onChange={e=>setStart(e.target.value)} />
          </label>
          <label className="block text-sm">End date
            <Input type="date" value={end} onChange={e=>setEnd(e.target.value)} />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={()=> onOpenChange(false)} disabled={saving}>Cancel</Button>
        <Button onClick={onSubmit} disabled={saving}>{saving? 'Saving…':'Save'}</Button>
      </div>
    </div>
  </Overlay>;
}
