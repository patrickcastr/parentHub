import { CreateStudyGroupForm } from "@/components/groups/CreateStudyGroupForm";
import { StudyGroupList } from "@/components/groups/StudyGroupList";

export default function TeachersPage() {
  // TODO: Replace with actual teacherId from auth
  const teacherId = "demo-teacher";
  return (
    <div className="max-w-2xl mx-auto py-8">
      <CreateStudyGroupForm />
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Your Study Groups</h2>
        <StudyGroupList teacherId={teacherId} />
      </div>
    </div>
  );
}
