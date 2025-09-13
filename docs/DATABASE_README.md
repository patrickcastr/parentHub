# ParentHub Database

## ERD
```
Group 1 --- * Student
Group 1 --- * File
```
Group(id, name, startsOn, createdAt, updatedAt)
Student(id, firstName, lastName, username, email, passwordHash, age?, groupId?, createdAt, updatedAt)
File(id, groupId, name, url, size, contentType, uploadedBy, createdAt, updatedAt)

## Field Definitions
- Group.name: string 2-64
- Group.startsOn: optional date
- Student.firstName/lastName: required strings
- Student.username: unique
- Student.email: unique
- Student.passwordHash: bcrypt hashed (cost 12)
- Student.groupId: nullable FK to Group

## CSV Import Format
Headers (case-insensitive):
firstName,lastName,username,email,password,age,groupName

## API Routes
Groups:
GET /api/groups?search=&page=&size=
POST /api/groups { name, startsOn? }
PATCH /api/groups/:id { name?, startsOn? }
DELETE /api/groups/:id -> { ok: true }

Students:
GET /api/students?groupId=&search=&page=&size=
POST /api/students { firstName,lastName,username,email,passwordPlaintext,age?,groupId? }
PATCH /api/students/:id { firstName?, lastName?, username?, email?, age?, groupId?, newPasswordPlaintext? }
POST /api/students/:id/assign-group { groupId|null }
POST /api/students/import-csv (multipart/form-data file)

Auth:
GET /api/me -> { userId, role, student? }

Files (group scoped):
GET /api/groups/:groupId/files?search=&page=&size=
POST /api/groups/:groupId/files (multipart) field: file
DELETE /api/files/:id (teacher only)

File limits: <=20MB; allowed types pdf, docx, xlsx, pptx, png, jpg.
Uploads stored under /uploads/<uuid>-<originalName> served statically.

## Security Notes
- Passwords hashed with bcrypt cost 12. Plaintext never stored.
- Input validated with Zod; 400 on validation errors.
- File endpoints verify group membership (student) or teacher role header.

## Flows
1. Create Group -> POST /api/groups
2. Create Student -> POST /api/students (optional groupId)
3. Import CSV -> auto upsert students & groups by groupName
4. Assign / Unassign group -> POST /api/students/:id/assign-group
