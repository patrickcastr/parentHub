export type Group = {
  id: string;
  name: string;
  startsOn?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GroupWithCount = Group & { memberCount: number };

export type StudentDTO = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  age?: number | null;
  groupId?: string | null;
  groupName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Paginated<T> = { items: T[]; total: number };

export type FileDTO = {
  id: string;
  groupId: string;
  name: string;
  url: string;
  size: number;
  contentType: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type StudyGroup = {
  id: string;
  name: string;
  startsOn?: string | null;
  endsOn?: string | null;
  memberCount?: number;
  fileCount?: number;
};

export type GroupRow = {
  id: string;
  name: string;
  startsOn?: string | null;
  endsOn?: string | null;
  members?: number;
  files?: number;
  createdAt?: string | null;
  memberCount?: number;
  fileCount?: number;
};

export interface CohortEntity {
  id: string;
  name: string;
  [key: string]: unknown;
}
export interface CohortMember {
  id: string;
  groupId: string;
  [key: string]: unknown;
}
