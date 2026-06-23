import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    // Infrastructure-only setup: no tests exist yet, so `pnpm test` should
    // still exit cleanly rather than failing with "no test files found".
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/*.{test,spec}.ts'],
          environment: 'node'
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
