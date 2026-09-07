import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['argon2', 'better-sqlite3'],
};

export default nextConfig;
