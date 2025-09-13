import { describe, it, expect } from 'vitest';
import { createGroupSchema, createStudentSchema } from '@/lib/validators';

describe('validators', () => {
  it('createGroupSchema valid', () => {
    const r = createGroupSchema.safeParse({ name: 'Group A' });
    expect(r.success).toBe(true);
  });
  it('createStudentSchema requires password', () => {
    const r = createStudentSchema.safeParse({ firstName:'A', lastName:'B', username:'ab', email:'a@b.com' });
    expect(r.success).toBe(false);
  });
});
