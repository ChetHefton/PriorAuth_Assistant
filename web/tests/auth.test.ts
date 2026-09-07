import assert from 'node:assert/strict';
import test from 'node:test';

import { createIsolatedDatabase } from '@/db/client';
import { createUser, updateUser } from '@/db/repositories/users';
import { hashPassword, verifyPassword } from '@/lib/auth/passwords';
import { permissionsForRole, roleHasPermission } from '@/lib/auth/permissions';
import {
  createSession,
  findActiveUserBySessionToken,
  hashSessionToken,
} from '@/lib/auth/sessions';
import { createUserSchema } from '@/lib/auth/validation';

void test('role permissions use the expected granular mappings', () => {
  assert.equal(roleHasPermission('ADMIN', 'users.manage'), true);
  assert.equal(
    roleHasPermission('AUTHORIZATION_SPECIALIST', 'cases.write'),
    true,
  );
  assert.equal(
    roleHasPermission('AUTHORIZATION_SPECIALIST', 'users.manage'),
    false,
  );
  assert.equal(roleHasPermission('SUPERVISOR', 'cases.approve'), true);
  assert.deepEqual(permissionsForRole('AUDITOR'), ['cases.read', 'audit.read']);
});

void test('user input is normalized and weak passwords are rejected', () => {
  const valid = createUserSchema.safeParse({
    username: '  Morgan.Reed  ',
    displayName: 'Morgan Reed',
    password: 'a-strong-local-password',
    role: 'AUTHORIZATION_SPECIALIST',
  });
  assert.equal(valid.success, true);
  if (valid.success) assert.equal(valid.data.username, 'morgan.reed');

  const invalid = createUserSchema.safeParse({
    username: 'morgan',
    displayName: 'Morgan Reed',
    password: 'short',
    role: 'AUTHORIZATION_SPECIALIST',
  });
  assert.equal(invalid.success, false);
});

void test('passwords are hashed with Argon2id and verify securely', async () => {
  const password = 'a-strong-local-password';
  const passwordHash = await hashPassword(password);

  assert.match(passwordHash, /^\$argon2id\$/);
  assert.equal(passwordHash.includes(password), false);
  assert.equal(await verifyPassword(passwordHash, password), true);
  assert.equal(await verifyPassword(passwordHash, 'incorrect-password'), false);
});

void test('opaque sessions resolve active users and are revoked on deactivation', async () => {
  const db = createIsolatedDatabase();
  const user = createUser(
    {
      username: 'session.user',
      displayName: 'Session User',
      passwordHash: await hashPassword('another-strong-password'),
      role: 'AUDITOR',
    },
    db,
  );
  const session = createSession(user.id, db);

  assert.equal(session.token.length > 32, true);
  assert.notEqual(session.token, hashSessionToken(session.token));
  assert.equal(findActiveUserBySessionToken(session.token, db)?.id, user.id);

  updateUser(user.id, { isActive: false }, db);
  assert.equal(findActiveUserBySessionToken(session.token, db), undefined);
});
