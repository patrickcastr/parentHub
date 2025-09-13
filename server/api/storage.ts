import { Router } from 'express';
import { z } from 'zod';
import { getReadUrl, getUploadUrl } from '../services/storage';
import { log } from '../logger';

export const storageRouter = Router();

storageRouter.get('/storage/read-url/*', async (req, res) => {
  try {
  const raw = String((req.params as any)[0] || '').trim();
  const blob = z.string().min(1).parse(raw);
  if (blob.startsWith('/') || blob.includes('..')) throw new Error('invalid blob name');
    const url = await getReadUrl(blob);
    res.json({ url });
  } catch (err: any) {
    log.error({ err }, 'read-url failed');
    res.status(400).json({ error: err?.message || 'Bad request' });
  }
});

storageRouter.post('/storage/upload-url', async (req, res) => {
  try {
    const body = z.object({ blob: z.string().min(1) }).parse(req.body);
    const url = await getUploadUrl(body.blob);
    res.json({ url });
  } catch (err: any) {
    log.error({ err }, 'upload-url failed');
    res.status(400).json({ error: err?.message || 'Bad request' });
  }
});

export default storageRouter;
