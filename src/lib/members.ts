import { upsertEntity, queryEntities } from '@/lib/tables';
import { v4 as uuidv4 } from 'uuid';

const TABLE = 'CohortMembers';

export interface CohortMember {
  partitionKey: string; // cohortId
  rowKey: string; // membershipId
  userEmail: string;
  studentId: string;
  name: string;
  username: string;
  age: number;
  expiresAt?: string;
  disabled?: boolean;
}

export async function addMembers(
  cohortId: string,
  members: Omit<CohortMember, 'partitionKey' | 'rowKey'>[]
): Promise<void> {
  for (const m of members) {
    const membershipId = uuidv4();
    const entity: CohortMember = {
      partitionKey: cohortId,
      rowKey: membershipId,
      ...m
    };
    await upsertEntity<CohortMember>(TABLE, entity);
  }
}

export async function listMembers(cohortId?: string): Promise<CohortMember[]> {
  if (cohortId) {
    return queryEntities<CohortMember>(TABLE, `PartitionKey eq '${cohortId}'`);
  }
  return queryEntities<CohortMember>(TABLE, 'true');
}
