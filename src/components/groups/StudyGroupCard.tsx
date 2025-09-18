import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudyGroup } from "@/lib/types";

export function StudyGroupCard({ group }: { group: StudyGroup }) {
  const isActive = !group.endsOn || (new Date(group.endsOn).getTime() > Date.now());
  return (
    <Card className="p-4">
      <div className="font-semibold text-lg">{group.name}</div>
      <div className="text-xs text-muted-foreground">ID: {group.id}</div>
      <div className="text-xs">Ends: {group.endsOn ? (()=>{ const d=new Date(group.endsOn!); return isNaN(d.getTime())? '—': d.toLocaleDateString(); })() : "—"}</div>
      <Badge variant={isActive ? "default" : "secondary"}>{isActive ? "Active" : "Ended"}</Badge>
    </Card>
  );
}
