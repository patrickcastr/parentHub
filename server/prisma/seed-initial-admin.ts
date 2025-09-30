import { prisma } from './client';
import bcrypt from 'bcryptjs';

async function main(){
  const email = 'teacher@parenthub.com';
  const password = 'teacher';
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
  const hash = await bcrypt.hash(password, rounds);
  const user = await (prisma as any).user.upsert({
    where: { email },
    update: { role: 'TEACHER', passwordHash: hash },
    create: { email, role: 'TEACHER', passwordHash: hash }
  });
  console.log('[seed-initial-admin] ensured teacher user', { email: user.email });
  console.log('[seed-initial-admin] credentials ->', email, '/', password);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(()=> prisma.$disconnect());
