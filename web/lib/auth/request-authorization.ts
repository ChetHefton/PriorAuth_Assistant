import type { NextRequest } from 'next/server';

import type { DatabaseClient } from '@/db/client';
import {
  findActiveUserBySessionToken,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/sessions';
import { permissionsForRole, roleHasPermission } from '@/lib/auth/permissions';
import type { AppUser, Permission } from '@/types/auth';

export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  return origin !== null && origin === request.nextUrl.origin;
}

export function getRequestUser(
  request: NextRequest,
  db?: DatabaseClient,
): AppUser | null {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const user = findActiveUserBySessionToken(token, db);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    permissions: permissionsForRole(user.role),
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function requestUserHasPermission(
  request: NextRequest,
  permission: Permission,
  db?: DatabaseClient,
): AppUser | null {
  const user = getRequestUser(request, db);
  return user && roleHasPermission(user.role, permission) ? user : null;
}
