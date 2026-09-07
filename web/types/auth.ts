export const roles = [
  'ADMIN',
  'AUTHORIZATION_SPECIALIST',
  'SUPERVISOR',
  'AUDITOR',
] as const;

export type UserRole = (typeof roles)[number];

export const permissions = [
  'cases.read',
  'cases.write',
  'cases.approve',
  'communications.generate',
  'users.manage',
  'policies.manage',
  'audit.read',
] as const;

export type Permission = (typeof permissions)[number];

export type AppUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ManagedUser = Omit<AppUser, 'permissions'>;
