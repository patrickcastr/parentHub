import { Router } from 'express';
import { prisma } from '../prisma/client';
import { initUpload, getDownloadUrl, moveObject, deleteObject } from '../storage/azure-blob';
import { z } from 'zod';

const router = Router();

// TEMP auth (replace with real auth middleware already present elsewhere)
function requireAuth(req: any,_res:any,next:any){ req.user={ id:'dev-user', role:'TEACHER'}; next(); }
async function ensureCanViewGroup(_user:any,_groupId:string){ return; }
async function ensureCanManageGroup(_user:any,_groupId:string){ return; }

const initSchema = z.object({ filename: z.string().min(1), mimeType: z.string().optional(), sizeBytes: z.number().int().positive().optional() });
const completeSchema = z.object({ groupId: z.string().min(1), key: z.string().min(1), filename: z.string().min(1), mimeType: z.string().optional(), sizeBytes: z.number().int().nonnegative().optional() });

// List
router.get('/groups/:groupId/files', requireAuth, async (req:any,res) => {
  const { groupId } = req.params;
  await ensureCanViewGroup(req.user, groupId);
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
  const search = (req.query.search as string)||'';
  const status = (req.query.status as string)||'ACTIVE';
  const where: any = { groupId };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (status === 'ACTIVE' || status === 'ARCHIVED') where.status = status;
  const [items,total] = await Promise.all([
    prisma.file.findMany({ where, skip:(page-1)*limit, take:limit, orderBy:{ createdAt:'desc' } }),
    prisma.file.count({ where })
  ]);
  const pages = Math.max(1, Math.ceil(total/limit));
  res.json({ items, page, limit, total, pages });
});

// Init upload
router.post('/groups/:id/files/init-upload', requireAuth, async (req:any,res) => {
  try {
    const groupId = req.params.id;
    await ensureCanManageGroup(req.user, groupId);
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true, storagePrefix: true } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const body = initSchema.parse(req.body);
    const { key, uploadUrl, headers, expiresAt } = await initUpload({ keyPrefix: group.storagePrefix, filename: body.filename, mimeType: body.mimeType });
    res.json({ key, uploadUrl, headers, expiresAt });
  } catch (e:any) { res.status(400).json({ error: e.message || 'init-upload failed' }); }
});

// Complete
router.post('/files/complete', requireAuth, async (req:any,res) => {
  try {
    const b = completeSchema.parse(req.body);
    await ensureCanManageGroup(req.user, b.groupId);
  const file = await prisma.file.create({ data: { name: b.filename, key: b.key, url: `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${process.env.AZURE_STORAGE_CONTAINER}/${b.key}`, mimeType: b.mimeType, sizeBytes: b.sizeBytes ?? null, uploadedBy: req.user.id, groupId: b.groupId, status: 'ACTIVE' } });
  await prisma.fileAccessLog.create({ data: { fileId: file.id, actorId: req.user.id, action: 'upload', ip: req.ip, userAgent: req.get('user-agent') ?? undefined } });
    res.status(201).json(file);
  } catch (e:any) { res.status(400).json({ error: e.message || 'complete failed' }); }
});

// Download
router.get('/files/:id/download', requireAuth, async (req:any,res) => {
  try {
  const file = await prisma.file.findUnique({ where: { id: req.params.id } });
    if (!file) return res.status(404).json({ error: 'Not found' });
    await ensureCanViewGroup(req.user, file.groupId);
    const url = await getDownloadUrl(file.key, { filename: file.name, mimeType: file.mimeType ?? undefined });
  await prisma.fileAccessLog.create({ data: { fileId: file.id, actorId: req.user.id, action: 'download', ip: req.ip, userAgent: req.get('user-agent') ?? undefined } });
    res.redirect(302, url);
  } catch (e:any) { res.status(400).json({ error: e.message || 'download failed' }); }
});

// Archive
router.patch('/files/:id/archive', requireAuth, async (req:any,res) => {
  try {
  const file = await prisma.file.findUnique({ where: { id: req.params.id }, include: { group: { select: { id: true, storagePrefix: true } } } });
    if (!file) return res.status(404).json({ error: 'Not found' });
    await ensureCanManageGroup(req.user, file.groupId);
    if (file.status === 'ARCHIVED') return res.status(409).json({ error: 'Already archived' });
    const base = file.key.split('/').pop();
    const prefix = file.group.storagePrefix.endsWith('/') ? file.group.storagePrefix : file.group.storagePrefix + '/';
    const d = new Date(); const yyyy=String(d.getUTCFullYear()); const mm=String(d.getUTCMonth()+1).padStart(2,'0'); const dd=String(d.getUTCDate()).padStart(2,'0');
    const newKey = `${prefix}archived/${yyyy}/${mm}/${dd}/${base}`;
    await moveObject(file.key, newKey);
  const updated = await prisma.file.update({ where: { id: file.id }, data: { status: 'ARCHIVED', archivedAt: new Date(), archivedBy: req.user.id, key: newKey, url: `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${process.env.AZURE_STORAGE_CONTAINER}/${newKey}` } });
  await prisma.fileAccessLog.create({ data: { fileId: file.id, actorId: req.user.id, action: 'archive', ip: req.ip, userAgent: req.get('user-agent') ?? undefined } });
    res.json(updated);
  } catch (e:any) { res.status(400).json({ error: e.message || 'archive failed' }); }
});

// Purge
router.delete('/files/:id/purge', requireAuth, async (req:any,res) => {
  try {
  const file = await prisma.file.findUnique({ where: { id: req.params.id } });
    if (!file) return res.status(404).json({ error: 'Not found' });
    await ensureCanManageGroup(req.user, file.groupId);
    await deleteObject(file.key);
  await prisma.fileAccessLog.create({ data: { fileId: file.id, actorId: req.user.id, action: 'purge', ip: req.ip, userAgent: req.get('user-agent') ?? undefined } });
  await prisma.file.delete({ where: { id: file.id } });
    res.json({ ok: true });
  } catch (e:any) { res.status(400).json({ error: e.message || 'purge failed' }); }
});

export default router;