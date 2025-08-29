import { TableClient } from '@azure/data-tables';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';

export function getTableClient(tableName: string): TableClient {
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
  }
  return TableClient.fromConnectionString(connectionString, tableName);
}

export async function upsertEntity<T extends { partitionKey: string; rowKey: string }>(
  table: string,
  entity: T
): Promise<void> {
  const client = getTableClient(table);
  await client.upsertEntity(entity);
}

export async function getEntity<T>(
  table: string,
  partitionKey: string,
  rowKey: string
): Promise<T | null> {
  const client = getTableClient(table);
  try {
    const entity = await client.getEntity(partitionKey, rowKey);
    return entity as unknown as T;
  } catch (err) {
    const e = err as { statusCode?: number };
    if (e.statusCode === 404) {
      return null;
    }
    throw err;
  }
}

export async function deleteEntity(
  table: string,
  partitionKey: string,
  rowKey: string
): Promise<void> {
  const client = getTableClient(table);
  await client.deleteEntity(partitionKey, rowKey);
}

export async function queryEntities<T extends Record<string, unknown>>(table: string, filter: string): Promise<T[]> {
  const client = getTableClient(table);
  const entities: T[] = [];
  for await (const entity of client.listEntities<T>({ queryOptions: { filter } })) {
    entities.push(entity);
  }
  return entities;
}
