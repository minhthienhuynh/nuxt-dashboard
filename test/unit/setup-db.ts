import { execSync } from 'node:child_process'

// Vitest globalSetup for the `unit` project: apply the schema to the isolated
// test database once before the suite runs. DATABASE_URL is forced here so it
// wins over `.env` (dotenv does not override an already-set var).
export default function setup() {
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./prisma/test.db' }
  })
}
