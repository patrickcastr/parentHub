import { Router } from 'express';
import { prisma } from '../prisma/client';
import { getReadUrl, getUploadUrl } from '../services/storage';
import { assertPathInPrefix } from '../util/pathScope';

const r = Router();

// GET /api/groups/:id/files/read-url?blob=relative/path.txt
r.get('/groups/:id/files/read-url', async (req, res) => {
  try {
    const g = await prisma.group.findUnique({ where: { id: String(req.params.id) } });
    if (!g?.storagePrefix) return res.status(404).json({ error: 'Group not found' });
    const blob = String(req.query.blob || '');
    if (!blob) return res.status(400).json({ error: 'blob is required' });
    const path = assertPathInPrefix(`${g.storagePrefix}${blob}`, g.storagePrefix);
    const url = await getReadUrl(path);
    res.json({ url });
  } catch (e:any) { res.status(400).json({ error: e?.message || 'failed' }); }
});

// POST /api/groups/:id/files/upload-url  { blob: "docs/file.pdf" }
r.post('/groups/:id/files/upload-url', async (req, res) => {
  try {
    const g = await prisma.group.findUnique({ where: { id: String(req.params.id) } });
    if (!g?.storagePrefix) return res.status(404).json({ error: 'Group not found' });
    const blob = String(req.body?.blob || '');
    if (!blob) return res.status(400).json({ error: 'blob is required' });
    const path = assertPathInPrefix(`${g.storagePrefix}${blob}`, g.storagePrefix);
    const url = await getUploadUrl(path);
    res.json({ url });
  } catch (e:any) { res.status(400).json({ error: e?.message || 'failed' }); }
});

export default r;
