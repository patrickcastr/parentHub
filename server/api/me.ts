import { Router } from 'express';

// In-memory session map shared with auth route (simple dev session store)
const SESS: Map<string, { id: string; email: string; role: string }> = (global as any).__SESS || new Map();
if(!(global as any).__SESS) (global as any).__SESS = SESS;

const meRouter = Router();

meRouter.get('/auth/me', (req, res) => {
  const sid = (req.cookies && req.cookies['ph.sid']) || '';
  const user = SESS.get(sid);
  if(!user) return res.status(401).json({ error: 'Not authenticated' });
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Vary', 'Cookie');
  res.json({ id: user.id, email: user.email, role: user.role });
});

export default meRouter;
