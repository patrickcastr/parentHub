import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getGroup, addStudentToGroup, importStudentsCsv } from "@/lib/api";
import { GroupStudentsTable } from "@/components/groups/GroupStudentsTable";
import { ImportStudentsCsv } from "@/components/groups/ImportStudentsCsv";
import { toast } from "@/components/ui/toast";

export default function GroupDetailsPage() {
  const { groupId } = useParams();
  const queryClient = useQueryClient();
  const { data: group, isLoading } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getGroup(groupId!),
    enabled: !!groupId,
  });

  const removeStudent = async (studentId: number) => {
    // TODO: Implement API call to remove student
    toast.success("Student removed (mock)");
    queryClient.invalidateQueries({ queryKey: ["group", groupId] });
  };

  const handleImport = async (file: File) => {
    try {
      await importStudentsCsv(groupId!, file);
      toast.success("CSV imported!");
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    } catch (err: any) {
      toast.error(err?.message || "Import failed");
    }
  };

  if (isLoading) return <div>Loading group...</div>;
  if (!group) return <div>Group not found.</div>;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2">{group.groupName}</h1>
      <div className="text-xs text-muted-foreground mb-2">ID: {group.groupID}</div>
      <div className="mb-4">
        <span className={`badge ${group.isActive ? "bg-green-500" : "bg-gray-400"}`}>{group.isActive ? "Active" : "Ended"}</span>
      </div>
      <ImportStudentsCsv onImport={handleImport} />
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Students</h2>
        <GroupStudentsTable students={group.students} onRemove={removeStudent} />
      </div>
    </div>
  );
}
