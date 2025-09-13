import StudentsTable from '@/components/students/StudentsTable';

export default function StudentsPage(){
  return <div className="p-4 space-y-4">
    <h1 className="text-lg font-semibold">Students</h1>
    <StudentsTable />
  </div>;
}
