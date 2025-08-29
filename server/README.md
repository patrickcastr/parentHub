# GreenSchool Student Hub Database

## Overview

This app uses SQLite via Prisma ORM. The core entities are StudyGroup, Student, and GroupStudent (join table).

### Entity Relationship Diagram (ERD)

- StudyGroup (1) — (M) GroupStudent (M) — (1) Student

## Schema

See `prisma/schema.prisma` for full model definitions.

- **StudyGroup**: id, groupID (unique), groupName, endDate, isActive, createdAt, updatedAt, teacherId (optional)
- **Student**: id, username (unique), name, email (unique), age, createdAt, updatedAt
- **GroupStudent**: id, studyGroupId, studentId (unique per group/student)

## Migrations

```bash
npx prisma migrate dev --name init
```

## Seeding

Add demo teacher and groups in a seed script (see `prisma/seed.ts`).

## Local Setup

```bash
cd server
npm i
npx prisma generate
npm run dev
```

## API Endpoints

Base URL: `http://localhost:5174/api`

| Method | Endpoint                        | Description                                 |
|--------|----------------------------------|---------------------------------------------|
| POST   | /api/groups                     | Create study group                          |
| GET    | /api/groups?teacherId=...       | List groups for teacher                     |
| GET    | /api/groups/:groupID            | Get group details + students                |
| PATCH  | /api/groups/:groupID            | Update group                                |
| DELETE | /api/groups/:groupID            | Delete group                                |
| GET    | /api/students?search=...        | Search students                             |
| POST   | /api/students                   | Create student                              |
| POST   | /api/groups/:groupID/students   | Add student to group                        |
| POST   | /api/groups/:groupID/import     | Import students via CSV                     |
| DELETE | /api/groups/:groupID/students/:studentId | Remove student from group         |

## Sample curl

```bash
# Create group
curl -X POST http://localhost:5174/api/groups -H "Content-Type: application/json" -d '{"groupName":"Math Study","endDate":"2025-12-31"}'

# List groups
curl http://localhost:5174/api/groups?teacherId=demo-teacher

# Import students CSV
curl -X POST http://localhost:5174/api/groups/12345678/import -F "file=@students.csv"
```

## Notes

- Table name is `study_groups` (not `group`, which is reserved in SQL).
- `groupID` is a random 6–8 digit string, unique per group.
- `isActive` auto-toggles false if `endDate` < today when listing groups.
- Backup: copy `server/prisma/dev.db` for local backup/restore.
- Future: migrate to Postgres, add authentication, row-level security.
