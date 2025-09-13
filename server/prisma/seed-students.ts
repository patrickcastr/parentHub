import { PrismaClient } from '@prisma/client';
import { customAlphabet } from 'nanoid';
import bcrypt from 'bcrypt';
import 'dotenv/config';

/**
 * Non-destructive seed for deterministic sample Students.
 * - Re-runnable (uses upsert by unique username)
 * - Creates a sample Group if none exists
 * - Inserts / updates ~30 students with stable data
 */
const prisma = new PrismaClient();
const cuid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24);

// Deterministic sample name pools
const FIRST = ['Alex','Sam','Taylor','Jordan','Casey','Riley','Avery','Reese','Skyler','Shawn'];
const LAST  = ['Lee','Kim','Singh','Garcia','Patel','Nguyen','Brown','Khan','Rivera','Lopez'];

function mkFirst(n: number){ return FIRST[(n - 1) % FIRST.length]; }
function mkLast(n: number){ return LAST[Math.floor((n - 1) / FIRST.length) % LAST.length]; }

async function ensureGroup(){
  let g = await prisma.group.findFirst();
  if (g) return g;
  const id = cuid();
  g = await prisma.group.create({
    data: {
      id,
      name: 'Sample Group',
      slug: 'sample-group',
      startsOn: new Date(),
      storagePrefix: `groups/${id}/`,
    },
  } as any); // cast to any to bypass optional field variance in generated client
  return g;
}

async function main(){
  const group = await ensureGroup();
  const total = 30; // adjustable (20–40 per requirements)

  // Pre-compute password hash (same for all demo users)
  const rawPassword = 'Password123!';
  const passwordHash = bcrypt.hashSync(rawPassword, 10);

  let created = 0; let updated = 0;

  for (let i = 1; i <= total; i++) {
    const username = `student${i}`;
    const email = `${username}@example.com`;
    const firstName = mkFirst(i);
    const lastName  = mkLast(i);
    const age = 14 + (i % 5); // 14–18 range

    // Check existence first for clearer created/updated accounting
    const existing = await prisma.student.findUnique({ where: { username } });

    const up = await prisma.student.upsert({
      where: { username },
      create: {
        // id auto-generated (cuid())
        firstName,
        lastName,
        username,
        email,
        passwordHash,
        age,
        groupId: group.id,
      },
      update: {
        firstName,
        lastName,
        email, // keep email in sync if changed
        age,
        groupId: group.id,
        // Do NOT overwrite passwordHash intentionally on reseed
      },
    });

    if (existing) updated++; else created++;
  }

  console.log(`[seed-students] complete: created=${created}, updated=${updated}, groupId=${group.id}`);
  console.log('[seed-students] sample credentials -> username: student1  password: Password123!');
}

main().catch(err => {
  console.error('[seed-students] failed:', err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
