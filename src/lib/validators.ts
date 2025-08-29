import { z } from "zod";

export const createGroupSchema = z.object({
  groupName: z.string().min(2),
  endDate: z.string().optional().or(z.null()),
  teacherId: z.string().optional()
});

export const addStudentSchema = z.object({
  studentId: z.number().optional(),
  name: z.string().min(2).optional(),
  username: z.string().min(2).optional(),
  email: z.string().email().optional(),
  age: z.coerce.number().int().min(0).optional()
}).refine(d => d.studentId || (d.name && d.username && d.email), {
  message: "Provide studentId or full new student details."
});
