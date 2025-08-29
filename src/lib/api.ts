// API helpers for Study Groups
import { StudyGroup, Student, GroupWithStudents } from "./types";

const API_BASE = "/api";

export async function createGroup(data: Partial<StudyGroup>) {
  const res = await fetch(`${API_BASE}/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getGroups(teacherId?: string): Promise<StudyGroup[]> {
  const url = teacherId ? `${API_BASE}/groups?teacherId=${teacherId}` : `${API_BASE}/groups`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getGroup(groupID: string): Promise<GroupWithStudents> {
  const res = await fetch(`${API_BASE}/groups/${groupID}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addStudentToGroup(groupID: string, data: any) {
  const res = await fetch(`${API_BASE}/groups/${groupID}/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function importStudentsCsv(groupID: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/groups/${groupID}/import`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
