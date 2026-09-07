import { randomUUID } from 'node:crypto';

import { asc, eq } from 'drizzle-orm';

import { getDatabase, type DatabaseClient } from '@/db/client';
import { sessions, users, type UserRecord } from '@/db/schema';
import type { ManagedUser, UserRole } from '@/types/auth';

export type CreateUserInput = {
  username: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
};

export type UpdateUserInput = Partial<
  Pick<UserRecord, 'displayName' | 'role' | 'isActive' | 'passwordHash'>
>;

export function toManagedUser(user: UserRecord): ManagedUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function findUserById(
  id: string,
  db: DatabaseClient = getDatabase(),
): UserRecord | undefined {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export function findUserByUsername(
  username: string,
  db: DatabaseClient = getDatabase(),
): UserRecord | undefined {
  return db.select().from(users).where(eq(users.username, username)).get();
}

export function listUsers(db: DatabaseClient = getDatabase()): ManagedUser[] {
  return db
    .select()
    .from(users)
    .orderBy(asc(users.displayName), asc(users.username))
    .all()
    .map(toManagedUser);
}

export function createUser(
  input: CreateUserInput,
  db: DatabaseClient = getDatabase(),
): UserRecord {
  const now = new Date();
  const user: UserRecord = {
    id: randomUUID(),
    username: input.username,
    passwordHash: input.passwordHash,
    displayName: input.displayName,
    role: input.role,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(users).values(user).run();
  return user;
}

export function updateUser(
  userId: string,
  changes: UpdateUserInput,
  db: DatabaseClient = getDatabase(),
): UserRecord | undefined {
  const updated = db
    .update(users)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning()
    .get();

  if (
    updated &&
    (changes.passwordHash !== undefined || changes.isActive === false)
  ) {
    db.delete(sessions).where(eq(sessions.userId, userId)).run();
  }

  return updated;
}
