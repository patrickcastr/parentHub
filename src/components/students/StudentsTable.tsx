import { useQuery } from '@tanstack/react-query';
import { fetchStudents } from '@/lib/api/students';
import { fetchGroups } from '@/lib/api/groups';
import type { StudentDTO } from '@/lib/types';
import { StudentRow } from './StudentRow';

interface GroupLite { id:string; name:string; }

export default function StudentsTable(){
  const studentsQ = useQuery({ queryKey:['students'], queryFn: () => fetchStudents() });
  const groupsQ = useQuery({ queryKey:['groups'], queryFn: fetchGroups });

  if(studentsQ.isLoading || groupsQ.isLoading) return <div>Loading…</div>;
  if(studentsQ.isError) return <div>Error loading students</div>;
  if(groupsQ.isError) return <div>Error loading groups</div>;

  const studentsRaw:any = studentsQ.data;
  const groupsRaw:any = groupsQ.data;
  const students: StudentDTO[] = Array.isArray(studentsRaw) ? studentsRaw : studentsRaw.items || studentsRaw.data || [];
  const groups: GroupLite[] = Array.isArray(groupsRaw) ? groupsRaw : groupsRaw.items || groupsRaw.data || groupsRaw;

  return <div className="overflow-x-auto">
    <table className="min-w-full text-sm border">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-2 py-1 text-left">Name</th>
          <th className="px-2 py-1 text-left">Group</th>
          <th className="px-2 py-1 text-left">Assign</th>
        </tr>
      </thead>
      <tbody>
        {students.map(s=> <StudentRow key={s.id} student={s} groups={groups} />)}
        {!students.length && <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500">No students</td></tr>}
      </tbody>
    </table>
  </div>;
}
