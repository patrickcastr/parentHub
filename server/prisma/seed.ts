import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Demo teacher
  const teacherId = 'demo-teacher';

  // Create groups
  const group1 = await prisma.studyGroup.create({
    data: {
      groupID: '12345678',
      groupName: 'Math Study',
      endDate: new Date('2025-12-31'),
      teacherId,
    },
  });
  const group2 = await prisma.studyGroup.create({
    data: {
      groupID: '87654321',
      groupName: 'Science Study',
      endDate: new Date('2025-11-30'),
      teacherId,
    },
  });

  // Create students
  const student1 = await prisma.student.create({
    data: {
      username: 'alice',
      name: 'Alice Smith',
      email: 'alice@example.com',
      age: 15,
    },
  });
  const student2 = await prisma.student.create({
    data: {
      username: 'bob',
      name: 'Bob Lee',
      email: 'bob@example.com',
      age: 16,
    },
  });

  // Attach students to groups
  await prisma.groupStudent.create({
    data: {
      studyGroupId: group1.id,
      studentId: student1.id,
    },
  });
  await prisma.groupStudent.create({
    data: {
      studyGroupId: group2.id,
      studentId: student2.id,
    },
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
