import { Table } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Student } from "@/lib/types";

export function GroupStudentsTable({ students, onRemove }: { students: Student[]; onRemove: (id: number) => void }) {
  if (!students.length) return <div>No students in this group.</div>;
  return (
    <Table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Username</th>
          <th>Email</th>
          <th>Age</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {students.map((student) => (
          <tr key={student.id}>
            <td>{student.name}</td>
            <td>{student.username}</td>
            <td>{student.email}</td>
            <td>{student.age ?? "—"}</td>
            <td>
              <Button size="sm" variant="destructive" onClick={() => onRemove(student.id)}>
                Remove
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
