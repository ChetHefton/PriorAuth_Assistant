import type { Permission, UserRole } from '@/types/auth';

export const rolePermissions: Readonly<
  Record<UserRole, readonly Permission[]>
> = {
  ADMIN: [
    'cases.read',
    'cases.write',
    'cases.approve',
    'communications.generate',
    'users.manage',
    'policies.manage',
    'audit.read',
  ],
  AUTHORIZATION_SPECIALIST: [
    'cases.read',
    'cases.write',
    'communications.generate',
  ],
  SUPERVISOR: [
    'cases.read',
    'cases.write',
    'cases.approve',
    'communications.generate',
    'audit.read',
  ],
  AUDITOR: ['cases.read', 'audit.read'],
};

export function permissionsForRole(role: UserRole): Permission[] {
  return [...rolePermissions[role]];
}

export function roleHasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  return rolePermissions[role].includes(permission);
}
