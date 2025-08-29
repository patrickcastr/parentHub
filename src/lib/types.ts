export type StudyGroup = {
  id: number;
  groupID: string;
  groupName: string;
  endDate?: string | null;
  isActive: boolean;
  teacherId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Student = {
  id: number;
  username: string;
  name: string;
  email: string;
  age?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type GroupWithStudents = StudyGroup & { students: Student[] };
