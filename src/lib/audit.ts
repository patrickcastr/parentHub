import { upsertEntity } from '@/lib/tables';
import { v4 as uuidv4 } from 'uuid';

const TABLE = 'AuditLog';

export interface AuditEntity {
  partitionKey: string; // userEmail
  rowKey: string; // auditId
  action: string;
  cohortId?: string;
  objectKey?: string;
  timestamp: string;
}

export async function logAction(
  userEmail: string,
  action: string,
  cohortId?: string,
  objectKey?: string
) {
  const entity: AuditEntity = {
    partitionKey: userEmail,
    rowKey: uuidv4(),
    action,
    cohortId,
    objectKey,
    timestamp: new Date().toISOString()
  };
  await upsertEntity<AuditEntity>(TABLE, entity);
}
