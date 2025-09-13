import { Router } from 'express';
import { prisma } from './prisma/client';

const r = Router();

r.get('/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (e:any) { res.status(500).json({ ok: false, error: e.message }); }
});

r.get('/sample', async (_req, res) => {
  const [groups, students, files] = await Promise.all([
    (prisma as any).group.count(),
    (prisma as any).student.count(),
    (prisma as any).file.count(),
  ]);
  res.json({ groups, students, files });
});

export default r;
