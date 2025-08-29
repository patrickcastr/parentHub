import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import multer from "multer";
import path from "path";

const app = express();
const prisma = new PrismaClient();
const upload = multer();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Helper: compute isActive
type GroupRecord = { endDate: Date | string | null; isActive: boolean };
function computeIsActive(group: GroupRecord) {
  if (group.endDate) {
    return new Date(group.endDate) >= new Date();
  }
  return group.isActive;
}

// POST /api/groups
app.post("/api/groups", async (req: Request, res: Response) => {
  const schema = z.object({
    groupName: z.string().min(2),
    endDate: z.string().optional().or(z.null()),
    teacherId: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const groupID = Math.random().toString().slice(2, 10);
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
  const group = await prisma.studyGroup.create({
    data: {
      groupID,
      groupName: parsed.data.groupName,
      endDate,
      isActive: !endDate || endDate >= new Date(),
      teacherId: parsed.data.teacherId,
    },
  });
  res.json(group);
});

// GET /api/groups
app.get("/api/groups", async (req: Request, res: Response) => {
  const teacherId = req.query.teacherId as string | undefined;
  const groups = await prisma.studyGroup.findMany({
    where: teacherId ? { teacherId } : {},
    orderBy: { createdAt: "desc" },
  });
  res.json(groups.map(g => ({ ...g, isActive: computeIsActive(g) })));
});

// GET /api/groups/:groupID
app.get("/api/groups/:groupID", async (req: Request, res: Response) => {
  const group = await prisma.studyGroup.findUnique({
    where: { groupID: req.params.groupID },
    include: {
      members: { include: { student: true } },
    },
  });
  if (!group) return res.status(404).send("Group not found");
  res.json({
    ...group,
    students: group.members.map(m => m.student),
    isActive: computeIsActive(group),
  });
});

// PATCH /api/groups/:groupID
app.patch("/api/groups/:groupID", async (req: Request, res: Response) => {
  const schema = z.object({
    groupName: z.string().min(2).optional(),
    endDate: z.string().optional().or(z.null()),
    isActive: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : undefined;
  const group = await prisma.studyGroup.update({
    where: { groupID: req.params.groupID },
    data: {
      ...parsed.data,
      endDate,
    },
  });
  res.json(group);
});

// DELETE /api/groups/:groupID
app.delete("/api/groups/:groupID", async (req: Request, res: Response) => {
  await prisma.studyGroup.delete({ where: { groupID: req.params.groupID } });
  res.sendStatus(204);
});

// GET /api/students
app.get("/api/students", async (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { username: { contains: search } },
          { email: { contains: search } },
        ],
      }
    : {};
  const students = await prisma.student.findMany({ where });
  res.json(students);
});

// POST /api/students
app.post("/api/students", async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(2),
    username: z.string().min(2),
    email: z.string().email(),
    age: z.coerce.number().int().min(0).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const student = await prisma.student.create({ data: parsed.data });
  res.json(student);
});

// POST /api/groups/:groupID/students
app.post("/api/groups/:groupID/students", async (req: Request, res: Response) => {
  const schema = z.object({
    studentId: z.number().optional(),
    name: z.string().min(2).optional(),
    username: z.string().min(2).optional(),
    email: z.string().email().optional(),
    age: z.coerce.number().int().min(0).optional(),
  }).refine(d => d.studentId || (d.name && d.username && d.email), {
    message: "Provide studentId or full new student details."
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  let studentId = parsed.data.studentId;
  if (!studentId) {
    // Upsert student
    const student = await prisma.student.upsert({
      where: { email: parsed.data.email! },
      update: {},
      create: {
        name: parsed.data.name!,
        username: parsed.data.username!,
        email: parsed.data.email!,
        age: parsed.data.age,
      },
    });
    studentId = student.id;
  }
  // Attach to group
  const group = await prisma.studyGroup.findUnique({ where: { groupID: req.params.groupID } });
  if (!group) return res.status(404).send("Group not found");
  await prisma.groupStudent.upsert({
    where: { studyGroupId_studentId: { studyGroupId: group.id, studentId } },
    update: {},
    create: { studyGroupId: group.id, studentId },
  });
  res.sendStatus(204);
});

// POST /api/groups/:groupID/import
app.post("/api/groups/:groupID/import", upload.single("file"), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) return res.status(400).send("No file uploaded");
  const csv = file.buffer.toString("utf-8");
  const rows = csv.split(/\r?\n/).filter(Boolean);
  const header = rows[0].split(",");
  const errors: string[] = [];
  const group = await prisma.studyGroup.findUnique({ where: { groupID: req.params.groupID } });
  if (!group) return res.status(404).send("Group not found");
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(",");
    const data: any = {};
  header.forEach((h: string, idx: number) => { data[h.trim()] = cols[idx]?.trim(); });
    if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email)) {
      errors.push(`Row ${i + 1}: Invalid email`);
      continue;
    }
    try {
      const student = await prisma.student.upsert({
        where: { email: data.email },
        update: {},
        create: {
          name: data.name,
          username: data.username,
          email: data.email,
          age: data.age ? parseInt(data.age) : undefined,
        },
      });
      await prisma.groupStudent.upsert({
        where: { studyGroupId_studentId: { studyGroupId: group.id, studentId: student.id } },
        update: {},
        create: { studyGroupId: group.id, studentId: student.id },
      });
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }
  res.json({ errors });
});

// DELETE /api/groups/:groupID/students/:studentId
app.delete("/api/groups/:groupID/students/:studentId", async (req: Request, res: Response) => {
  const group = await prisma.studyGroup.findUnique({ where: { groupID: req.params.groupID } });
  if (!group) return res.status(404).send("Group not found");
  await prisma.groupStudent.deleteMany({
    where: { studyGroupId: group.id, studentId: Number(req.params.studentId) },
  });
  res.sendStatus(204);
});

const port = process.env.PORT || 5174;
app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
