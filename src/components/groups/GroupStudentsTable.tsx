import { Table } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assignStudentGroup } from '@/lib/api/students';
import { showToast } from '@/components/common/Toast';

type StudentLite = {
  id: string;
  firstName?: string; lastName?: string; // new shape
  name?: string; // legacy combined
  username: string;
  email: string;
  age?: number | null;
  groupId?: string | null;
  groupName?: string | null;
};

interface GroupRef { id: string; name: string; }

export function GroupStudentsTable({ groupId, students, groups }: { groupId: string; students: StudentLite[]; groups: GroupRef[]; }) {
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: ({ studentId, nextGroupId }: { studentId: string; nextGroupId: string | null }) => assignStudentGroup(studentId, nextGroupId),
    onMutate: async ({ studentId, nextGroupId }) => {
      await qc.cancelQueries({ queryKey: ['group', groupId] });
      const prev = qc.getQueryData(['group', groupId]);
      const nextName = nextGroupId ? (groups.find(g=> g.id===nextGroupId)?.name ?? null) : null;
      qc.setQueryData<any>(['group', groupId], (old:any)=>{
        if(!old) return old;
        const list: StudentLite[] = old.students || old.data?.students || [];
        // moving away from this group => filter out
        if(nextGroupId !== groupId){
          return { ...old, students: list.filter(s=> s.id !== studentId) };
        }
        // moving into / staying in this group => upsert
        let found = false;
        const patched = list.map(s=> {
          if(s.id === studentId){ found = true; return { ...s, groupId: nextGroupId, groupName: nextName }; }
          return s;
        });
        if(!found){
          patched.push({ id: studentId, username: 'unknown', email: 'unknown', groupId: nextGroupId, groupName: nextName });
        }
        return { ...old, students: patched };
      });
      return { prev };
    },
    onError: (err:any,_vars,ctx)=> { 
      if(ctx?.prev) qc.setQueryData(['group', groupId], ctx.prev);
      const status = Number((err && err.status) || 0);
      const raw = String(err?.message || '');
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
    onSuccess: ()=> {
      qc.invalidateQueries({ queryKey: ['group', groupId] });
      qc.invalidateQueries({ queryKey: ['students'] }); // global
      qc.invalidateQueries({ queryKey: ['students', { groupId }] }); // scoped
      showToast({ variant: 'success', message: 'Group updated.' });
    }
  });

  if (!students.length) return <div>No students in this group.</div>;
  return (
    <Table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Username</th>
          <th>Email</th>
          <th>Age</th>
          <th>Group</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {students.map((student) => {
          const displayName = student.name || `${student.firstName||''} ${student.lastName||''}`.trim();
          return (
          <tr key={student.id}>
            <td>{displayName}</td>
            <td>{student.username}</td>
            <td>{student.email}</td>
            <td>{student.age ?? '—'}</td>
            <td>
              <select
                className="border rounded px-1 py-0.5 text-xs"
                value={student.groupId || ''}
                disabled={mut.isPending}
                onChange={e=> mut.mutate({ studentId: student.id, nextGroupId: e.target.value === '' ? null : e.target.value })}
              >
                <option value="">Unassigned</option>
                {groups.map(g=> <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </td>
            <td>
              <Button size="sm" variant="outline" onClick={() => {/* future remove action */}} disabled={mut.isPending}>Remove</Button>
            </td>
          </tr>
        );})}
      </tbody>
    </Table>
  );
}
