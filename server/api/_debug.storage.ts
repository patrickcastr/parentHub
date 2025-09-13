import { Router } from 'express';
import { containerClient } from '../storage/azure-blob';
import { log } from '../logger';

const r = Router();

r.get('/_storage/health', async (_req, res) => {
  try {
    const props = await containerClient.getProperties();
    log.info({ container: containerClient.containerName, lastModified: props.lastModified }, '[storage:health] OK');
    res.json({ ok: true, container: containerClient.containerName, lastModified: props.lastModified });
  } catch (err: any) {
    log.error({ err }, '[storage:health] FAILED');
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

r.post('/_storage/marker', async (_req, res) => {
  const prefix = `groups/debug-${Date.now()}/`;
  try {
    const block = containerClient.getBlockBlobClient(prefix + '_folder');
    await block.upload('', 0, { metadata: { test: 'ok' } });
    log.info({ prefix }, '[storage:marker] OK');
    res.json({ ok: true, prefix });
  } catch (err: any) {
    log.error({ prefix, err }, '[storage:marker] FAILED');
    res.status(500).json({ ok: false, error: err?.message || String(err), prefix });
  }
});

export default r;
