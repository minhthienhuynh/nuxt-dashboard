import { addComponentsDir, createResolver, defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'plan-comparison',
    configKey: 'planComparison'
  },
  setup(_options, nuxt) {
    const resolver = createResolver(import.meta.url)

    addComponentsDir({
      path: resolver.resolve('./runtime/app/components')
    })

    nuxt.hook('pages:extend', (pages) => {
      pages.push({
        name: 'plan-comparison',
        path: '/plan-comparison',
        file: resolver.resolve('./runtime/app/pages/plan-comparison.vue')
      })
    })
  }
})
