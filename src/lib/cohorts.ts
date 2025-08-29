import { upsertEntity, getEntity, queryEntities } from '@/lib/tables';
import { v4 as uuidv4 } from 'uuid';

const TABLE = 'Cohorts';

export interface CohortEntity {
  partitionKey: string;
  rowKey: string;
  name: string;
  expiresAt?: string;
  teacher?: string;
  archived?: boolean;
}

export async function createCohort(
  name: string,
  expiresAt?: string,
  teacher?: string
): Promise<CohortEntity> {
  const id = uuidv4();
  const entity: CohortEntity = {
    partitionKey: 'cohort',
    rowKey: id,
    name,
    expiresAt,
    teacher,
    archived: false
  };
  await upsertEntity<CohortEntity>(TABLE, entity);
  return entity;
}

export async function listCohorts(): Promise<CohortEntity[]> {
  return queryEntities<CohortEntity>(
    TABLE,
    `PartitionKey eq 'cohort' and (archived eq false or archived eq null)`
  );
}

export async function archiveCohort(id: string): Promise<void> {
  const ent = await getEntity<CohortEntity>(TABLE, 'cohort', id);
  if (ent) {
    ent.archived = true;
    await upsertEntity<CohortEntity>(TABLE, ent);
  }
}
