import { z } from 'zod';

import { roles } from '@/types/auth';

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must contain at least 3 characters.')
  .max(64, 'Username must contain at most 64 characters.')
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    'Use only letters, numbers, periods, underscores, or hyphens.',
  )
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(12, 'Password must contain at least 12 characters.')
  .max(128, 'Password must contain at most 128 characters.');

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(128),
});

export const createUserSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(2).max(100),
  password: passwordSchema,
  role: z.enum(roles),
});

export const updateUserSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100).optional(),
    role: z.enum(roles).optional(),
    isActive: z.boolean().optional(),
    password: passwordSchema.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one change is required.',
  );
