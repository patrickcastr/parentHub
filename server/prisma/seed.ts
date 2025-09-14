import { prisma } from './client';
import { buildGroupPrefix, ensureGroupFolder } from '../storage/storage-groups';
import bcrypt from 'bcryptjs';
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

async function main() {
  await prisma.group.deleteMany();
  await prisma.student.deleteMany();

  const mathId = 'seed-math-'+Math.random().toString(36).slice(2,8);
  const sciId = 'seed-sci-'+Math.random().toString(36).slice(2,8);
  const mathPrefix = buildGroupPrefix(mathId);
  const sciPrefix = buildGroupPrefix(sciId);
  await ensureGroupFolder(mathPrefix);
  await ensureGroupFolder(sciPrefix);
  const math = await prisma.group.create({ data: { id: mathId, name: 'Math Study', storagePrefix: mathPrefix } });
  const sci = await prisma.group.create({ data: { id: sciId, name: 'Science Study', storagePrefix: sciPrefix } });

  const pass = await bcrypt.hash('Password123!', SALT_ROUNDS);
  await prisma.student.create({ data: { firstName: 'Alice', lastName: 'Smith', username: 'alice', email: 'alice@example.com', passwordHash: pass, age: 15, groupId: math.id } });
  await prisma.student.create({ data: { firstName: 'Bob', lastName: 'Lee', username: 'bob', email: 'bob@example.com', passwordHash: pass, age: 16, groupId: sci.id } });
}

main().catch(e => { console.error(e); process.exit(1); }).finally(()=> prisma.$disconnect());
