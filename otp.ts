import crypto from "crypto";
import { upsertEntity, getEntity } from "@/lib/tables";

const TABLE = "OtpCodes";

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

interface OtpEntity {
  partitionKey: string; // email
  rowKey: string;       // codeHash
  expiresAt: string;
  used: boolean;
}

export async function storeCode(email: string, code: string, ttlSeconds: number): Promise<void> {
  const now = Date.now();
  const expiresAt = new Date(now + ttlSeconds * 1000).toISOString();
  const entity: OtpEntity = {
    partitionKey: email.toLowerCase(),
    rowKey: hashCode(code),
    expiresAt,
    used: false
  };
  await upsertEntity<OtpEntity>(TABLE, entity);
}

export async function verifyCode(email: string, code: string): Promise<boolean> {
  const codeHash = hashCode(code);
  const entity = await getEntity<OtpEntity>(TABLE, email.toLowerCase(), codeHash);
  if (!entity) return false;
  const now = new Date();
  const expiresAtDate = new Date(entity.expiresAt);
  if (entity.used || expiresAtDate < now) {
    return false;
  }
  entity.used = true;
  await upsertEntity<OtpEntity>(TABLE, entity);
  return true;
}

export async function deleteExpiredCodes(): Promise<void> {
  // optional periodic cleanup - not implemented in this skeleton
}