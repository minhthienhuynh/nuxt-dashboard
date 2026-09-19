// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    './modules/plan-comparison'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  // S3 credentials are read at RUNTIME (modules/plan-comparison/runtime/server/
  // plugins/plan-comparison-storage.ts), never
  // inlined at build time. Override per-environment with NUXT_PLAN_COMPARISON_S3_* vars,
  // or fall back to the plain S3_* vars already used by Dokploy.
  runtimeConfig: {
    planComparison: {
      s3: {
        bucket: '',
        endpoint: '',
        region: '',
        accessKeyId: '',
        secretAccessKey: ''
      }
    }
  },

  routeRules: {
    '/api/**': {
      cors: true
    }
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
