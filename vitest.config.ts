import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

const rootDir = fileURLToPath(new URL('./', import.meta.url))

export default defineConfig({
  test: {
    // Infrastructure-only setup: no tests exist yet, so `pnpm test` should
    // still exit cleanly rather than failing with "no test files found".
    passWithNoTests: true,
    projects: [
      {
        // Server-side code (repositories, Prisma) runs in the node env so the
        // better-sqlite3 native adapter loads. `~~` alias mirrors Nuxt so
        // `server/utils/prisma.ts` resolves the generated client. DATABASE_URL
        // points at an isolated test db (migrated once via globalSetup) so
        // tests never touch prisma/dev.db.
        resolve: {
          alias: { '~~': rootDir }
        },
        test: {
          name: 'unit',
          include: ['test/unit/*.{test,spec}.ts'],
          environment: 'node',
          env: { DATABASE_URL: 'file:./prisma/test.db' },
          globalSetup: ['test/unit/setup-db.ts'],
          setupFiles: ['test/unit/setup-each.ts'],
          // All repo tests share one SQLite test db; run files serially so one
          // file's beforeEach reset never wipes another file's data mid-test.
          fileParallelism: false
        }
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/*.{test,spec}.ts'],
          environment: 'nuxt'
        }
      })
    ]
  }
})
