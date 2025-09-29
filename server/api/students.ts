import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
import { prisma } from '../prisma/client';
import multer from 'multer';
import { assertGroupActive } from './groups';

const upload = multer();
export const studentsRouter = Router();

const createStudentSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  username: z.string().min(2),
  email: z.string().email(),
  passwordPlaintext: z.string().min(8),
  age: z.number().int().min(4).optional(),
  groupId: z.string().cuid().optional(),
});

const patchStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  username: z.string().min(2).optional(),
  email: z.string().email().optional(),
  age: z.number().int().min(4).nullable().optional(),
  groupId: z.string().cuid().nullable().optional(),
  newPasswordPlaintext: z.string().min(8).optional(),
});

function parsePagination(query: any) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const size = Math.min(100, Math.max(1, parseInt(query.size as string) || 20));
  return { page, size, skip: (page - 1) * size, take: size };
}

// GET /api/students
studentsRouter.get('/', async (req, res) => {
  const { search, groupId } = req.query as { search?: string; groupId?: string };
  try {
    if (groupId) await assertGroupActive(String(groupId));
  } catch(e:any){ return res.status(e.status||403).json({ error: e.message||'Access denied' }); }
  const { skip, take } = parsePagination(req.query);
  const where: any = {};
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (groupId) where.groupId = groupId;
  const [items, total] = await Promise.all([
    prisma.student.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { group: true } }),
    prisma.student.count({ where }),
  ]);
  res.json({ items: items.map((s: any) => ({
    id: s.id,
    firstName: (s as any).firstName,
    lastName: (s as any).lastName,
    username: s.username,
    email: s.email,
    age: s.age,
    groupId: (s as any).groupId,
    groupName: (s as any).group?.name || null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  })), total });
});

// POST /api/students
studentsRouter.post('/', async (req, res) => {
  const parsed = createStudentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const data = parsed.data;
  const passwordHash = await bcrypt.hash(data.passwordPlaintext, SALT_ROUNDS);
  try {
  const created = await prisma.student.create({ data: { firstName: data.firstName, lastName: data.lastName, username: data.username, email: data.email, passwordHash, age: data.age, groupId: data.groupId } as any });
    res.status(201).json(created);
  } catch (e:any) {
    res.status(400).json({ error: e.message });
  }
});

// PATCH /api/students/:id
studentsRouter.patch('/:id', async (req, res) => {
  const parsed = patchStudentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { newPasswordPlaintext, ...rest } = parsed.data;
  const data: any = { ...rest };
  if (newPasswordPlaintext) data.passwordHash = await bcrypt.hash(newPasswordPlaintext, SALT_ROUNDS);
  try {
  const updated = await prisma.student.update({ where: { id: req.params.id as string }, data: data as any });
    res.json(updated);
  } catch {
    res.status(404).json({ error: 'Student not found' });
  }
});

// POST /api/students/:id/assign-group
studentsRouter.post('/:id/assign-group', async (req, res) => {
  try {
    const studentId = String(req.params.id);
  let { groupId, override } = (req.body || {}) as { groupId?: string | null; override?: boolean };
    if (groupId === '') groupId = null; // empty string => unassign

    if (groupId != null) {
      if (typeof groupId !== 'string' || groupId.length < 1) {
        return res.status(400).json({ error: 'Invalid groupId' });
      }
      const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true, name: true, startsOn: true } });
      if (!group) return res.status(400).json({ error: 'Invalid groupId' });
      const now = Date.now();
      const startsAt = group.startsOn ? group.startsOn.getTime() : null;
      // Future start date check (before assertGroupActive to customize message)
      if (startsAt && startsAt > now) {
        const startISO = group.startsOn!.toISOString().slice(0,10);
        if (!override) {
          return res.status(403).json({
            error: `Cannot assign: group start date is in the future (${startISO})`,
            code: 'GROUP_START_IN_FUTURE',
            startDate: startISO,
            groupId: group.id,
            groupName: group.name
          });
        } else {
          // Allow override for TEACHER role (two-role model)
          const sessStore: Map<string, any> | undefined = (global as any).__SESS;
          const sid = (req.cookies && req.cookies['ph.sid']) || '';
          const sessionUser: any = (sid && sessStore) ? sessStore.get(sid) : null;
          const role = sessionUser?.role || 'STUDENT';
          if (role !== 'TEACHER') {
            return res.status(403).json({ error: 'Override not permitted (teacher only).', code: 'OVERRIDE_NOT_ALLOWED' });
          }
          console.info('[ASSIGN]', { by: sessionUser.email, role, studentId, groupId: group.id, override: true, reason: 'OVERRIDE' });
        }
      } else {
        // Fallback to existing active window guard (expired, not yet open, etc.)
        try { await assertGroupActive(groupId); } catch (e: any) { return res.status(e.status || 403).json({ error: e.message || 'Access denied' }); }
      }
    }

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: { groupId: groupId ?? null },
      include: { group: true }
    });
    if (groupId) {
      const sessStore: Map<string, any> | undefined = (global as any).__SESS;
      const sid = (req.cookies && req.cookies['ph.sid']) || '';
      const sessionUser: any = (sid && sessStore) ? sessStore.get(sid) : null;
      const role = sessionUser?.role || 'STUDENT';
      console.info('[ASSIGN]', { by: sessionUser?.email, role, studentId, groupId, override: !!override, reason: override ? 'OVERRIDE' : 'NORMAL' });
    }
    return res.json({ groupId: updated.groupId, groupName: updated.group?.name ?? '-' });
  } catch (e: any) {
    if (String(e?.message || '').includes('Record to update not found')) {
      return res.status(404).json({ error: 'Student not found' });
    }
    return res.status(500).json({ error: 'Failed to assign group' });
  }
});

// POST /api/students/import-csv
studentsRouter.post('/import-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  if (req.file.size > 2 * 1024 * 1024) return res.status(400).json({ error: 'File too large (2MB limit)' });
  const text = req.file.buffer.toString('utf-8');
  const rows = text.split(/\r?\n/).filter(r => r.trim());
  if (rows.length > 10000) return res.status(400).json({ error: 'Too many rows (max 10k)' });
  if (rows.length <= 1) return res.json({ results: [], total: 0 });
  const header = rows[0].split(',').map(h => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());
  const results: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(',').map(c => c.trim());
    if (!cols.length) continue;
    try {
      const firstName = cols[idx('firstname')];
      const lastName = cols[idx('lastname')];
      const username = cols[idx('username')];
      const email = cols[idx('email')];
      const password = cols[idx('password')];
      const ageStr = cols[idx('age')];
      const groupName = cols[idx('groupname')];
      if (!firstName || !lastName || !username || !email || !password) throw new Error('Missing required field');
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      let groupId: string | undefined = undefined;
      if (groupName) {
  const group = await (prisma as any).group.upsert({ where: { name: groupName }, update: {}, create: { name: groupName } });
        groupId = group.id;
      }
      const age = ageStr ? parseInt(ageStr) : undefined;
      const student = await prisma.student.upsert({
        where: { email },
        update: { firstName, lastName, username, age, groupId } as any,
        create: { firstName, lastName, username, email, passwordHash, age, groupId } as any,
      });
      results.push({ row: i + 1, status: 'ok', studentId: student.id });
    } catch (e:any) {
      results.push({ row: i + 1, status: 'error', message: e.message });
    }
  }
  res.json({ results, total: results.length });
});
