// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // SSH feature (manager UI + terminal view) is packaged in its own layer so it
  // stays modular and separate from the dashboard template. Shared with the
  // web-terminal change.
  extends: ['./layers/termius'],

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/api/**': {
      cors: true
    }
  },

  compatibilityDate: '2024-07-11',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
