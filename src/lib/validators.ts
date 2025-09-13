import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().min(2).max(64),
  startsOn: z.string().optional().or(z.literal('')),
});

export const createStudentSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  username: z.string().min(2),
  email: z.string().email(),
  passwordPlaintext: z.string().min(8),
  age: z.coerce.number().int().min(4).optional(),
  groupId: z.string().cuid().optional(),
});

export const patchStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  username: z.string().min(2).optional(),
  email: z.string().email().optional(),
  age: z.coerce.number().int().min(4).nullable().optional(),
  groupId: z.string().cuid().nullable().optional(),
  newPasswordPlaintext: z.string().min(8).optional(),
});

export const assignGroupSchema = z.object({ groupId: z.string().cuid().nullable() });
