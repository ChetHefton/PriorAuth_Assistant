import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt, lt } from 'drizzle-orm';

import { getDatabase, type DatabaseClient } from '@/db/client';
import { sessions, users, type UserRecord } from '@/db/schema';

export const SESSION_COOKIE_NAME = 'pa_session';

const DEFAULT_SESSION_TTL_HOURS = 12;

function sessionTtlMilliseconds(): number {
  const configured = Number.parseInt(process.env.SESSION_TTL_HOURS ?? '', 10);
  const hours =
    Number.isFinite(configured) && configured > 0 && configured <= 168
      ? configured
      : DEFAULT_SESSION_TTL_HOURS;
  return hours * 60 * 60 * 1000;
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSession(
  userId: string,
  db: DatabaseClient = getDatabase(),
): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionTtlMilliseconds());

  db.insert(sessions)
    .values({
      id: hashSessionToken(token),
      userId,
      createdAt: now,
      expiresAt,
    })
    .run();

  return { token, expiresAt };
}

export function deleteSession(
  token: string,
  db: DatabaseClient = getDatabase(),
): void {
  db.delete(sessions)
    .where(eq(sessions.id, hashSessionToken(token)))
    .run();
}

export function deleteExpiredSessions(
  db: DatabaseClient = getDatabase(),
): void {
  db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
}

export function findActiveUserBySessionToken(
  token: string,
  db: DatabaseClient = getDatabase(),
): UserRecord | undefined {
  const result = db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, hashSessionToken(token)),
        gt(sessions.expiresAt, new Date()),
        eq(users.isActive, true),
      ),
    )
    .get();

  return result?.user;
}
