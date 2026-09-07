import { desc } from 'drizzle-orm';
import { priorAuthorizationCases } from '@/db/schema';
import type { DatabaseClient } from '@/db/client';

export function nextCanonicalCaseId(db: DatabaseClient): string {
  const rows = db.select({ id: priorAuthorizationCases.id }).from(priorAuthorizationCases).orderBy(desc(priorAuthorizationCases.id)).all();
  const used = new Set(rows.map((row) => row.id));
  let number = rows.reduce((max, row) => {
    const match = /^RM-PA-(\d{4})$/.exec(row.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  let candidate = `RM-PA-${String(number).padStart(4, '0')}`;
  while (used.has(candidate)) candidate = `RM-PA-${String(++number).padStart(4, '0')}`;
  return candidate;
}
