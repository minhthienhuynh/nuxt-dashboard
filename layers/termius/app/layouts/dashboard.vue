<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// Product dashboard shell for the SSH manager (hosts + keychain). Lives in the
// termius layer, separate from the template's root `default.vue` so the product
// pages don't inherit the demo navigation or placeholder team/user identity.
const router = useRouter()
const open = ref(false)

const links = [[{
  label: 'Hosts',
  icon: 'i-lucide-server',
  to: '/hosts',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Keychain',
  icon: 'i-lucide-key-round',
  to: '/keychain',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Snippets',
  icon: 'i-lucide-square-terminal',
  to: '/snippets',
  onSelect: () => {
    open.value = false
  }
}]] satisfies NavigationMenuItem[][]

const groups = computed(() => [{
  id: 'links',
  label: 'Go to',
  items: links.flat()
}])

// Product navigation shortcuts, registered here rather than via the template's
// demo `useDashboard` composable so the product shell stays self-contained.
defineShortcuts({
  'g-t': () => router.push('/hosts'),
  'g-k': () => router.push('/keychain'),
  'g-n': () => router.push('/snippets')
})
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="dashboard"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
    >
      <template #header>
        <span class="font-semibold text-highlighted">Termius</span>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />
      </template>

      <template #footer="{ collapsed }">
        <AppearanceMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />
  </UDashboardGroup>
</template>
