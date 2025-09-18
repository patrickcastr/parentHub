import { useQuery } from "@tanstack/react-query";
import { listGroups } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { StudyGroup } from "@/lib/types";

export function StudyGroupList({ teacherId }: { teacherId?: string }) {
  const { data: groupsData, isLoading } = useQuery({
    queryKey: ["groups", teacherId],
    queryFn: () => listGroups({ page:1, limit:50 }),
  });
  const groups = groupsData?.items ?? [];
  const navigate = useNavigate();

  if (isLoading) return <div>Loading groups...</div>;
  if (!groups.length) return <div>No study groups found.</div>;

  return (
    <div className="grid gap-4">
      {groups.map((group: any) => (
        <Card key={group.id} className="flex items-center justify-between p-4">
          <div>
            <div className="font-semibold text-lg">{group.name}</div>
            <div className="text-xs text-muted-foreground">ID: {group.id}</div>
            <div className="text-xs">Starts: {group.startsOn ? (()=>{ const d=new Date(group.startsOn); return isNaN(d.getTime())? '—': d.toLocaleDateString(); })() : "—"}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={!group.endsOn || (new Date(group.endsOn).getTime() > Date.now()) ? "default" : "secondary"}>{!group.endsOn || (new Date(group.endsOn).getTime() > Date.now()) ? "Active" : "Ended"}</Badge>
            <Button size="sm" onClick={() => navigate(`/teachers/${group.id}`)}>
              Open
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
