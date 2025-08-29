import { useQuery } from "@tanstack/react-query";
import { getGroups } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { StudyGroup } from "@/lib/types";

export function StudyGroupList({ teacherId }: { teacherId?: string }) {
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups", teacherId],
    queryFn: () => getGroups(teacherId),
  });
  const navigate = useNavigate();

  if (isLoading) return <div>Loading groups...</div>;
  if (!groups.length) return <div>No study groups found.</div>;

  return (
    <div className="grid gap-4">
      {groups.map((group: StudyGroup) => (
        <Card key={group.groupID} className="flex items-center justify-between p-4">
          <div>
            <div className="font-semibold text-lg">{group.groupName}</div>
            <div className="text-xs text-muted-foreground">ID: {group.groupID}</div>
            <div className="text-xs">End Date: {group.endDate ? new Date(group.endDate).toLocaleDateString() : "—"}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={group.isActive ? "default" : "secondary"}>{group.isActive ? "Active" : "Ended"}</Badge>
            <Button size="sm" onClick={() => navigate(`/teachers/${group.groupID}`)}>
              Open
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
