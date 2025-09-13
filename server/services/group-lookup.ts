import { prisma } from '../prisma/client';

export function findGroupsByName(q: string) {
  return prisma.group.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    select: { id: true, name: true, slug: true, storagePrefix: true, startsOn: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

export function getGroupByPrefix(prefix: string) {
  return prisma.group.findUnique({
    where: { storagePrefix: prefix },
    select: { id: true, name: true, slug: true, storagePrefix: true, startsOn: true, createdAt: true },
  });
}

export function prefixFromBlobKey(key: string) {
  const m = key.match(/^groups\/[^/]+\//);
  return m ? m[0] : null;
}
