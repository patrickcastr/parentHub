import { Router } from 'express';
import { prisma } from '../prisma/client';

// Reuse global in-memory session store used by auth.ts
const SESS: Map<string, { id: string; email: string; role: string }> = (global as any).__SESS || new Map();
if(!(global as any).__SESS) (global as any).__SESS = SESS;

const router = Router();

// GET /api/student/portal
router.get('/portal', async (req: any, res) => {
  try {
    const sid = req.cookies && req.cookies['ph.sid'];
    const sessionUser = sid && SESS.get(sid);
    if(!sessionUser) return res.status(401).json({ error: 'Not authenticated' });
    // Resolve student by email (assumption per spec)
    const student = await prisma.student.findUnique({ where: { email: sessionUser.email } });
    let group = null;
    if(student?.groupId){
      group = await prisma.group.findUnique({ where: { id: student.groupId }, select: { id:true, name:true, startsOn:true, endsOn:true } });
    }
    // Files: group-specific (if groupId) + public (groupId IS NULL) -- current schema has File.groupId required
    // Since schema requires groupId, we interpret "public" as files whose groupId matches student.groupId OR (if no group) none.
    const filesWhere: any = {};
    if(student?.groupId){
      filesWhere.groupId = student.groupId;
    } else {
      // no group -> empty list (could extend later for real public files if schema changes)
      filesWhere.groupId = '__none__'; // impossible id to return empty
    }
    const files = await prisma.file.findMany({ where: filesWhere, orderBy: { createdAt: 'desc' }, select: { id:true, name:true, sizeBytes:true, createdAt:true, uploadedBy:true } });
    res.json({ group, files });
  } catch (e:any){
    console.error('[studentPortal] error', e);
    res.status(500).json({ error: 'Failed to load portal' });
  }
});

export default router;