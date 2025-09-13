// LEGACY local-disk files router (deprecated). Replaced by Azure Blob implementation in src/server/routes/files.ts
import { Router } from 'express';
import { prisma } from '../prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { buildArchivedKey, moveObject } from '../storage/providers/azure-blob';

export const filesRouter = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(process.cwd(), 'server', 'uploads');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
      cb(null, `${randomUUID()}-${safe}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','image/png','image/jpeg'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Invalid file type'));
    cb(null, true);
  }
});

// helper auth checks via JWT claims
async function resolveStudent(req: any){
  const claims = req.auth || {};
  const email: string | undefined = (claims.emails?.[0]) || claims.preferred_username;
  if (!email) return null;
  return prisma.student.findUnique({ where: { email } }) as any;
}
async function isTeacher(req: any){
  const s = await resolveStudent(req);
  return !s; // if not a student record, treat as teacher
}
async function assertGroupAccess(req: any, groupId: string){
  if (await isTeacher(req)) return true;
  const s = await resolveStudent(req);
  return s?.groupId === groupId;
}

// GET /api/groups/:groupId/files
filesRouter.get('/groups/:groupId/files', async (req: any, res) => {
  const { groupId } = req.params;
  if (!(await assertGroupAccess(req, groupId))) return res.status(403).json({ error: 'Forbidden' });
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const size = Math.min(100, Math.max(1, parseInt(req.query.size as string) || 20));
  const search = (req.query.search as string) || '';
  const status = (req.query.status as string) || 'ACTIVE';
  const where: any = { groupId };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (status === 'ACTIVE' || status === 'ARCHIVED') where.status = status;
  const [items, total] = await Promise.all([
    prisma.file.findMany({ where, skip: (page-1)*size, take: size, orderBy: { createdAt: 'desc' } }),
    prisma.file.count({ where })
  ]);
  res.json({ items, total });
});

// POST /api/groups/:groupId/files
filesRouter.post('/groups/:groupId/files', upload.single('file'), async (req: any, res) => {
  const { groupId } = req.params;
  const allowStudentUpload = (process.env.ALLOW_STUDENT_UPLOAD || 'true') === 'true';
  const teacher = await isTeacher(req);
  if (!(await assertGroupAccess(req, groupId))) return res.status(403).json({ error: 'Forbidden' });
  if (teacher) return res.status(403).json({ error: 'Preview mode: write blocked' });
  if (!teacher && !allowStudentUpload) return res.status(403).json({ error: 'Uploads disabled' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
  const created = await (prisma as any).file.create({ data: { groupId, name: req.file.originalname, url: `/uploads/${req.file.filename}`, key: req.file.filename, sizeBytes: req.file.size, mimeType: req.file.mimetype, uploadedBy: 'user' } });
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// PATCH /api/files/:id/archive
filesRouter.patch('/files/:id/archive', async (req: any, res) => {
  const teacher = await isTeacher(req);
  if (!teacher) return res.status(403).json({ error: 'Forbidden' });
  try {
    const file = await (prisma as any).file.findUnique({ where: { id: req.params.id }, include: { group: true } });
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.status === 'ARCHIVED') return res.status(409).json({ error: 'Already archived' });
    if (!(await assertGroupAccess(req, file.groupId))) return res.status(403).json({ error: 'Forbidden' });
    const newKey = buildArchivedKey(file.group.storagePrefix, file.key);
    await moveObject(file.key, newKey);
    const updated = await (prisma as any).file.update({ where: { id: file.id }, data: { status: 'ARCHIVED', archivedAt: new Date(), archivedBy: 'user', key: newKey, url: `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net/${process.env.AZURE_STORAGE_CONTAINER}/${newKey}` } });
    await (prisma as any).fileAccessLog.create({ data: { fileId: file.id, actorId: 'user', action: 'archive', ip: req.ip, userAgent: req.get('user-agent') || undefined } });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
