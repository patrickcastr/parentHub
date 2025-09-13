import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = 'Password123!';
const ROUNDS = 10;

function norm(v?: string | null){ return (v||'').trim().toLowerCase(); }

// Use loose typing (any) until client regenerated with new User/Role.
async function upsertBatch(emails: string[], role: 'STUDENT' | 'TEACHER', hash: string){
  for (const raw of emails){
    const email = norm(raw);
    if(!email) continue;
  await (prisma as any).user.upsert({
      where: { email },
      update: { role, passwordHash: hash },
      create: { email, role, passwordHash: hash }
    });
  }
}

async function main(){
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, ROUNDS);
  const students = await prisma.student.findMany({ select: { email: true }});
  const studentEmails = students.map(s=> s.email).filter(Boolean) as string[];
  let teacherEmails: string[] = [];
  try {
    // Optional teacher table - ignore if absent
    teacherEmails = (await (prisma as any).teacher.findMany({ select: { email: true }})).map((t:any)=> t.email).filter(Boolean);
  } catch {}
  await upsertBatch(studentEmails, 'STUDENT', hash);
  await upsertBatch(teacherEmails, 'TEACHER', hash);
  console.log(`[seed-auth-users] users upserted: students=${studentEmails.length} teachers=${teacherEmails.length}`);
  console.log(`[seed-auth-users] demo password: ${DEFAULT_PASSWORD}`);
}

main().catch(e=> { console.error(e); process.exit(1); }).finally(async()=> prisma.$disconnect());
