import 'dotenv/config';
import { prisma } from '../prisma/client';
import { buildGroupPrefix, ensureGroupFolder } from '../storage/storage-groups';

async function main() {
  const groups = await prisma.group.findMany();
  for (const g of groups) {
    const desired = g.storagePrefix && g.storagePrefix.length ? g.storagePrefix : buildGroupPrefix(g.id);
    await ensureGroupFolder(desired);
    if (g.storagePrefix !== desired) {
      await prisma.group.update({ where: { id: g.id }, data: { storagePrefix: desired } });
    }
    console.log('✅ ensured:', g.id, '→', desired);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
