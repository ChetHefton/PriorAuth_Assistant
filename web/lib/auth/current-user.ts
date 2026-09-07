import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { permissionsForRole, roleHasPermission } from '@/lib/auth/permissions';
import {
  findActiveUserBySessionToken,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/sessions';
import type { AppUser, Permission } from '@/types/auth';

export async function getCurrentUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const user = findActiveUserBySessionToken(token);
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

export async function requireCurrentUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

export async function requirePermission(
  permission: Permission,
): Promise<AppUser> {
  const user = await requireCurrentUser();
  if (!roleHasPermission(user.role, permission)) {
    redirect('/forbidden');
  }
  return user;
}
