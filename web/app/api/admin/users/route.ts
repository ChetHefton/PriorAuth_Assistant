import { NextRequest, NextResponse } from 'next/server';

import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  createUser,
  findUserByUsername,
  listUsers,
  toManagedUser,
} from '@/db/repositories/users';
import { hashPassword } from '@/lib/auth/passwords';
import {
  isSameOriginRequest,
  requestUserHasPermission,
} from '@/lib/auth/request-authorization';
import { createUserSchema } from '@/lib/auth/validation';

export async function GET(request: NextRequest) {
  if (!requestUserHasPermission(request, 'users.manage')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const response = NextResponse.json({ users: listUsers() });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: 'Request origin could not be verified.' },
      { status: 403 },
    );
  }

  const actor = requestUserHasPermission(request, 'users.manage');
  if (!actor) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid user details.' },
      { status: 400 },
    );
  }

  if (findUserByUsername(parsed.data.username)) {
    return NextResponse.json(
      { error: 'That username is already in use.' },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const created = createUser({
    username: parsed.data.username,
    displayName: parsed.data.displayName,
    role: parsed.data.role,
    passwordHash,
  });

  recordAuditEvent({
    userId: actor.id,
    action: 'users.create',
    resourceType: 'user',
    resourceId: created.id,
  });

  const response = NextResponse.json(
    { user: toManagedUser(created) },
    { status: 201 },
  );
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
