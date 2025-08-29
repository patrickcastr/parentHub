import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudyGroup } from "@/lib/types";

export function StudyGroupCard({ group }: { group: StudyGroup }) {
  return (
    <Card className="p-4">
      <div className="font-semibold text-lg">{group.groupName}</div>
      <div className="text-xs text-muted-foreground">ID: {group.groupID}</div>
      <div className="text-xs">End Date: {group.endDate ? new Date(group.endDate).toLocaleDateString() : "—"}</div>
      <Badge variant={group.isActive ? "default" : "secondary"}>{group.isActive ? "Active" : "Ended"}</Badge>
    </Card>
  );
}
