import { Router } from 'express';
import { prisma } from '../prisma/client';
import { buildGroupPrefix, ensureGroupFolder } from '../storage/storage-groups';

const r = Router();

r.post('/provision-group/:id', async (req, res) => {
  const id = String(req.params.id);
  const g = await prisma.group.findUnique({ where: { id } });
  if (!g) return res.status(404).json({ error: 'Group not found' });
  const prefix = buildGroupPrefix(id);
  await ensureGroupFolder(prefix);
  await prisma.group.update({ where: { id }, data: { storagePrefix: prefix } });
  res.json({ ok: true, prefix });
});

export default r;
