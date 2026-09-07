import { randomUUID } from 'node:crypto';

import { getDatabase, type DatabaseClient } from '@/db/client';
import { auditEvents } from '@/db/schema';

export type AuditEventInput = {
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
};

export function recordAuditEvent(
  input: AuditEventInput,
  db: DatabaseClient = getDatabase(),
): void {
  db.insert(auditEvents)
    .values({
      id: randomUUID(),
      userId: input.userId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      timestamp: new Date(),
    })
    .run();
}
