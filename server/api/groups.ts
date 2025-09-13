import { Router } from 'express';
import slugify from 'slugify';
import { prisma } from '../prisma/client';
import { buildGroupPrefix, ensureGroupFolder } from '../storage/storage-groups';
import { customAlphabet } from 'nanoid';
import { listKeysByPrefix, deleteObject } from '../storage/azure-blob';
import { getGroupByPrefix } from '../services/group-lookup';

const r = Router();
const cuid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24);

const useAzure =
  process.env.STORAGE_PROVIDER?.toLowerCase() === 'azure' ||
  (!!process.env.AZURE_STORAGE_ACCOUNT && !!process.env.AZURE_STORAGE_CONTAINER);

function requireAuth(req: any, _res: any, next: any) {
  req.user = { id: 'dev-user', role: 'TEACHER' };
  next();
}

/* ---------- helpers: dates (no prisma datamodel access) ---------- */

function toDateOrNull(v: any): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const s = String(v).trim();
  const iso = /T/.test(s) ? s : `${s}T00:00:00.000Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// Prefer select with endsOn; if Prisma rejects, fall back to endDate.
async function getGroupDates(id: string): Promise<{ g: any; using: 'endsOn' | 'endDate' }> {
  try {
    const g = await (prisma as any).group.findUnique({
      where: { id },
      select: { id: true, name: true, startsOn: true, endsOn: true },
    });
    return { g, using: 'endsOn' };
  } catch (_e) {
    const g = await (prisma as any).group.findUnique({
      where: { id },
      select: { id: true, name: true, startsOn: true, endDate: true },
    });
    return { g, using: 'endDate' };
  }
}

// Try update with endsOn; on “Unknown arg `endsOn`” retry with endDate.
async function updateGroupDates(
  id: string,
  data: { name?: string; startsOn?: Date | null; endInput?: Date | null }
): Promise<{ updated: any; using: 'endsOn' | 'endDate' }> {
  const base: any = {};
  if (data.name !== undefined) base.name = data.name;
  if (data.startsOn !== undefined) base.startsOn = data.startsOn;

  try {
    const d: any = { ...base };
    if (data.endInput !== undefined) d.endsOn = data.endInput;
    const updated = await (prisma as any).group.update({ where: { id }, data: d });
    return { updated, using: 'endsOn' };
  } catch (e: any) {
    if (!String(e?.message || '').includes('Unknown arg `endsOn`')) throw e;
    const d: any = { ...base };
    if (data.endInput !== undefined) d.endDate = data.endInput;
    const updated = await (prisma as any).group.update({ where: { id }, data: d });
    return { updated, using: 'endDate' };
  }
}

/* ------------------------------- routes ------------------------------- */

// GET /api/groups
r.get('/groups', requireAuth, async (req, res) => {
  try {
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const search = String(req.query.search || '').trim();

    const where: any = {};
    if (search) where.name = { contains: search, mode: 'insensitive' };

    // Try selecting with endsOn; fall back to endDate if the column doesn't exist.
    let itemsRaw: any[] = [];
    let using: 'endsOn' | 'endDate' = 'endsOn';
    try {
      itemsRaw = await (prisma as any).group.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          startsOn: true,
          endsOn: true,
          createdAt: true,
          storagePrefix: true,
        },
      });
      using = 'endsOn';
    } catch (_e) {
      itemsRaw = await (prisma as any).group.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          startsOn: true,
          endDate: true,
          createdAt: true,
          storagePrefix: true,
        },
      });
      using = 'endDate';
    }

    // Normalize to a single `endDate` field for the client.
    const items = itemsRaw.map((g: any) => ({
      id: g.id,
      name: g.name,
      startsOn: g.startsOn ?? null,
      endDate: using === 'endsOn' ? (g.endsOn ?? null) : (g.endDate ?? null),
      createdAt: g.createdAt,
      storagePrefix: g.storagePrefix,
    }));

    const total = await prisma.group.count({ where });

    res.json({
      items,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (e: any) {
    console.error('[groups:list] error', e);
    res.status(500).json({ error: e.message ?? 'list failed' });
  }
});

// POST /api/groups
r.post('/groups', requireAuth, async (req, res) => {
  try {
    const name: string = String(req.body?.name ?? '').trim();
    const startsOn = req.body?.startsOn ? new Date(req.body.startsOn) : null;

    if (!name) return res.status(400).json({ error: 'name is required' });
    if (req.body?.startsOn && isNaN(startsOn!.getTime()))
      return res.status(400).json({ error: 'startsOn is invalid' });

    const id = cuid();
    const slug = slugify(name, { lower: true, strict: true }).slice(0, 50);
    const prefix = buildGroupPrefix(id); // "groups/<id>/"

    const group = await (prisma as any).group.create({
      data: { id, name, slug, startsOn, storagePrefix: prefix },
      select: {
        id: true,
        name: true,
        slug: true,
        startsOn: true,
        createdAt: true,
        storagePrefix: true,
      },
    });

    if (useAzure) {
      try {
        await ensureGroupFolder(prefix, { displayName: name, slug });
      } catch (err: any) {
        console.error('[group:create] ensureGroupFolder FAILED', {
          code: err?.code,
          status: err?.statusCode,
          msg: err?.message,
        });
      }
    }

    return res.status(201).json({ ...group, blobPrefix: prefix });
  } catch (e: any) {
    const code = e?.code || e?.name;
    const message = e?.message || 'create failed';
    if (code === 'P2002') return res.status(409).json({ error: 'Group already exists' });
    return res.status(500).json({ error: message });
  }
});

// GET /api/groups/:id  → normalize end to `endDate`
r.get('/groups/:id', requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);

    let g: any;
    let using: 'endsOn' | 'endDate' = 'endsOn';
    try {
      g = await (prisma as any).group.findUnique({
        where: { id },
        select: { id: true, name: true, startsOn: true, endsOn: true },
      });
      using = 'endsOn';
    } catch (_e) {
      g = await (prisma as any).group.findUnique({
        where: { id },
        select: { id: true, name: true, startsOn: true, endDate: true },
      });
      using = 'endDate';
    }

    if (!g) return res.status(404).json({ error: 'Not found' });

    return res.json({
      id: g.id,
      name: g.name,
      startDate: g.startsOn ?? null,
      endDate: using === 'endsOn' ? g.endsOn ?? null : g.endDate ?? null,
    });
  } catch (e: any) {
    console.error('[groups:get] failed:', e);
    res.status(500).json({ error: e?.message || 'get failed' });
  }
});

// DELETE /api/groups/:id
r.delete('/groups/:id', requireAuth, async (req, res) => {
  try {
    const g = await prisma.group.findUnique({ where: { id: req.params.id } });
    if (!g) return res.status(404).json({ error: 'Not found' });

    if ((g as any).storagePrefix) {
      try {
        const keys = await listKeysByPrefix((g as any).storagePrefix as string);
        for (const k of keys) await deleteObject(k);
      } catch (e: any) {
        console.error('[groups] blob prefix delete failed:', e?.message || e);
      }
    }

    await prisma.group.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/groups/:id  (name, startDate, endDate)
r.patch('/groups/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);

  try {
    const body = req.body ?? {};
    const name = body.name !== undefined ? String(body.name || '').trim() : undefined;
    if (name !== undefined && !name) {
      return res.status(400).json({ error: 'name cannot be empty' });
    }

    const startInput = toDateOrNull(body.startDate);
    if (body.startDate !== undefined && startInput === null && body.startDate) {
      return res.status(400).json({ error: 'startDate invalid' });
    }

    const endInput = toDateOrNull(body.endDate);
    if (body.endDate !== undefined && endInput === null && body.endDate) {
      return res.status(400).json({ error: 'endDate invalid' });
    }

    if (body.startDate !== undefined && body.endDate !== undefined && startInput && endInput && startInput > endInput) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const exists = await prisma.group.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'Not found' });

    const { updated, using } = await updateGroupDates(id, {
      name,
      startsOn: startInput ?? undefined,
      endInput: endInput ?? undefined,
    });

    return res.json({
      id: updated.id,
      name: (updated as any).name,
      startDate: (updated as any).startsOn ?? null,
      endDate: using === 'endsOn' ? (updated as any).endsOn ?? null : (updated as any).endDate ?? null,
    });
  } catch (e: any) {
    console.error('[groups.patch] failed:', e);
    return res.status(500).json({ error: e?.message || 'update failed' });
  }
});

// GET /api/groups/:id/status
r.get('/groups/:id/status', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    const { g, using } = await getGroupDates(id);
    if (!g) return res.status(404).json({ error: 'Not found' });

    const now = Date.now();
    const opensAt: Date | null = (g as any).startsOn ?? null;
    const closesAt: Date | null = using === 'endsOn' ? (g as any).endsOn ?? null : (g as any).endDate ?? null;

    const isUpcoming = !!(opensAt && opensAt.getTime() > now);
    const isExpired = !!(closesAt && closesAt.getTime() < now);
    const isActive = !isUpcoming && !isExpired;

    res.json({ isActive, isUpcoming, isExpired, opensAt, closesAt });
  } catch (e: any) {
    console.error('[groups.status] failed:', e);
    res.status(500).json({ error: e?.message || 'status failed' });
  }
});

/* -------------------------- student guard -------------------------- */

export async function assertGroupActive(id: string) {
  const { g, using } = await getGroupDates(id);
  if (!g) {
    const err: any = new Error('Group not found');
    err.status = 404;
    throw err;
  }

  const now = Date.now();
  const opensAt: Date | null = (g as any).startsOn ?? null;
  const closesAt: Date | null = using === 'endsOn' ? (g as any).endsOn ?? null : (g as any).endDate ?? null;

  if (opensAt && opensAt.getTime() > now) {
    const err: any = new Error('Group not yet open');
    err.status = 403;
    throw err;
  }
  if (closesAt && closesAt.getTime() < now) {
    const err: any = new Error('Group expired');
    err.status = 403;
    throw err;
  }
  return true;
}

// GET /api/groups/by-prefix/*  (encoded prefix)
r.get('/groups/by-prefix/*', requireAuth, async (req, res) => {
  try {
    const raw = (req.params as any)[0] || '';
    const prefix = decodeURIComponent(raw);
    if (!prefix) return res.status(400).json({ error: 'prefix is required' });

    const group = await getGroupByPrefix(prefix);
    if (!group) return res.status(404).json({ error: 'Not found' });
    res.json(group);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'lookup failed' });
  }
});

export default r;
