import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getGroup, importStudentsCsv, listGroups } from "@/lib/api";
import { fetchStudents } from '@/lib/api/students';
import { GroupStudentsTable } from "@/components/groups/GroupStudentsTable";
import { ToastHost, showToast } from '@/components/common/Toast';
import { ImportStudentsCsv } from "@/components/groups/ImportStudentsCsv";

export default function GroupDetailsPage() {
  const { groupId } = useParams();
  const queryClient = useQueryClient();
  const { data: group, isLoading } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getGroup(groupId!),
    enabled: !!groupId,
  });
  const { data: groupsData } = useQuery({
    queryKey: ['groups','all'],
    queryFn: ()=> listGroups({ page:1, limit:100 }),
    enabled: !!groupId,
  });
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', { groupId }],
    queryFn: ()=> fetchStudents({ groupId }),
    enabled: !!groupId,
  });

  const removeStudent = async (studentId: number) => {
    // TODO: Implement API call to remove student
  console.log("Student removed (mock)");
    queryClient.invalidateQueries({ queryKey: ["group", groupId] });
  };

  const handleImport = async (file: File) => {
    try {
  await importStudentsCsv(file);
  showToast({ variant: 'success', message: 'CSV imported.' });
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
  queryClient.invalidateQueries({ queryKey: ['students', { groupId }] });
    } catch (err: any) {
  showToast({ variant: 'error', message: err?.message || 'Import failed' });
    }
  };

  if (isLoading || studentsLoading) return <div>Loading group...</div>;
  if (!group) return <div>Group not found.</div>;

  return (
  <div className="max-w-2xl mx-auto py-8 relative">
  <ToastHost />
    <h1 className="text-2xl font-bold mb-2">{group.name}</h1>
    <div className="text-xs text-muted-foreground mb-2">ID: {group.id}</div>
      <ImportStudentsCsv onImport={handleImport} />
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Students</h2>
  {(() => {
    const raw:any = studentsData;
    const list = Array.isArray(raw) ? raw : raw?.items || raw?.data || [];
    return <GroupStudentsTable groupId={groupId!} students={list as any[]} groups={(groupsData?.items||[]).map((g:any)=> ({ id: g.id, name: g.name }))} />;
  })()}
      </div>
    </div>
  );
}
