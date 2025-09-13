import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assignStudentGroup } from '@/lib/api/students';
import { showToast } from '@/components/common/Toast';
import type { StudentDTO } from '@/lib/types';
import React from 'react';
import { useAuth } from '@/state/authStore';

export interface SimpleGroup { id: string; name: string; }

export function StudentRow({ student, groups }: { student: StudentDTO; groups: SimpleGroup[] }) {
  const qc = useQueryClient();
  const { state } = useAuth();
  const isTeacher = state.status === 'signedIn' && state.user.role === 'TEACHER';
  const [overrideEnabled,setOverrideEnabled] = React.useState(false);
  const now = Date.now();

  const mut = useMutation({
    mutationFn: (nextId: string | null) => assignStudentGroup(student.id, nextId, overrideEnabled),
    onMutate: async (nextId) => {
      await qc.cancelQueries({ queryKey: ['students'] });
      const prev = qc.getQueryData(['students']);
      const nextName = nextId ? (groups.find(g => g.id === nextId)?.name ?? null) : null;

      qc.setQueryData<any>(['students'], (old: any) => {
        if (!old) return old;
        const list = Array.isArray(old) ? old : old.items || old.data;
        if (!Array.isArray(list)) return old;
        const patched = list.map((s: StudentDTO) => s.id === student.id ? { ...s, groupId: nextId, groupName: nextName } : s);
        if (Array.isArray(old)) return patched;
        if (old.items) return { ...old, items: patched };
        if (old.data) return { ...old, data: patched };
        return old;
      });
      return { prev };
    },
    onError: async (err: any, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['students'], ctx.prev);
      const status = Number((err && err.status) || 0);
      let raw = String(err?.message || '');
      let code:string|undefined; let startDate:string|undefined; let groupName:string|undefined;
      if(raw.startsWith('{')) { try { const j = JSON.parse(raw); code=j.code; startDate=j.startDate; groupName=j.groupName; } catch {/* ignore */} }
      if(code==='GROUP_START_IN_FUTURE' && groupName){
        showToast({ variant: 'error', message: `Can’t assign to ${groupName} — starts on ${startDate}.` });
        return;
      }
      if (status === 403) {
        showToast({ variant: 'error', message: 'You can’t assign to this group (inactive or no permission).' });
      } else if (status === 404 || /not found/i.test(raw)) {
        showToast({ variant: 'error', message: 'Group not found.' });
      } else if (status === 400 || /bad request/i.test(raw) || /invalid/.test(raw.toLowerCase())) {
        showToast({ variant: 'error', message: 'Invalid request. Please try again.' });
      } else {
        showToast({ variant: 'error', message: raw || 'Failed to update group.' });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      showToast({ variant: 'success', message: 'Group updated.' });
    }
  });

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    mut.mutate(v === '' ? null : v); // empty → null (unassign)
  }

  return (
    <tr>
      <td className="px-2 py-1 whitespace-nowrap">{student.firstName} {student.lastName}</td>
      <td className="px-2 py-1">{student.groupName ?? '—'}</td>
      <td className="px-2 py-1">
        <div className="flex flex-col gap-1">
          <select
            className="border rounded px-1 py-0.5 text-sm"
            value={student.groupId ?? ''}
            disabled={mut.isPending}
            onChange={handleChange}
          >
            <option value="">Unassigned</option>
            {groups.map(g => {
              const start = (g as any).startsOn || (g as any).startDate;
              const future = start ? new Date(start).getTime() > now : false;
              const disabled = future && !isTeacher;
              const title = future ? `Starts on ${start && new Date(start).toLocaleDateString()} — available once start date passes.${isTeacher? ' (Use override to allow early assignment)': ''}` : '';
              return <option key={g.id} value={g.id} disabled={disabled} title={title}>{g.name}</option>;
            })}
          </select>
          {isTeacher && <label className="inline-flex items-center gap-1 text-[10px] text-slate-600">
            <input type="checkbox" checked={overrideEnabled} onChange={e=> setOverrideEnabled(e.target.checked)} /> Override future start date
          </label>}
        </div>
      </td>
    </tr>
  );
}
