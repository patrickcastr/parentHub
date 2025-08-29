import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createGroupSchema } from "@/lib/validators";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createGroup } from "@/lib/api";
import { toast } from "@/components/ui/toast";

export function CreateStudyGroupForm() {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<z.infer<typeof createGroupSchema>>({
    resolver: zodResolver(createGroupSchema),
  });

  const mutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      toast.success("Study group created!");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      reset();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create group");
    },
  });

  return (
    <Card className="max-w-md mx-auto p-6">
      <h2 className="text-lg font-semibold mb-4">Create Study Group</h2>
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <div className="mb-4">
          <label className="block mb-1">Group Name</label>
          <Input {...register("groupName")} disabled={isSubmitting} />
          {errors.groupName && (
            <span className="text-red-500 text-xs">{errors.groupName.message}</span>
          )}
        </div>
        <div className="mb-4">
          <label className="block mb-1">End Date</label>
          <Input type="date" {...register("endDate")} disabled={isSubmitting} />
          {errors.endDate && (
            <span className="text-red-500 text-xs">{errors.endDate.message}</span>
          )}
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create"}
        </Button>
      </form>
    </Card>
  );
}
