import { hashPassword } from '../lib/auth/passwords';
import { passwordSchema, usernameSchema } from '../lib/auth/validation';
import {
  createUser,
  findUserByUsername,
  updateUser,
} from '../db/repositories/users';

const EXAMPLE_PASSWORD = 'replace-with-a-strong-local-password';

async function seedAdministrator(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'The administrator seed command is disabled in production.',
    );
  }

  const usernameResult = usernameSchema.safeParse(
    process.env.SEED_ADMIN_USERNAME,
  );
  const passwordResult = passwordSchema.safeParse(
    process.env.SEED_ADMIN_PASSWORD,
  );
  const displayName = process.env.SEED_ADMIN_DISPLAY_NAME?.trim();

  if (
    !usernameResult.success ||
    !passwordResult.success ||
    passwordResult.data === EXAMPLE_PASSWORD ||
    !displayName
  ) {
    throw new Error(
      'Set SEED_ADMIN_USERNAME, SEED_ADMIN_DISPLAY_NAME, and a 12+ character SEED_ADMIN_PASSWORD before seeding.',
    );
  }

  const passwordHash = await hashPassword(passwordResult.data);
  const existing = findUserByUsername(usernameResult.data);

  if (existing) {
    updateUser(existing.id, {
      displayName,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    });
    process.stdout.write(
      `Development administrator updated: ${usernameResult.data}\n`,
    );
    return;
  }

  createUser({
    username: usernameResult.data,
    displayName,
    passwordHash,
    role: 'ADMIN',
  });
  process.stdout.write(
    `Development administrator created: ${usernameResult.data}\n`,
  );
}

seedAdministrator().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Administrator seed failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
