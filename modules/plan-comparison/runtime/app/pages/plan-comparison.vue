<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>

<template>
  <UDashboardPanel id="plan-comparison">
    <template #header>
      <UDashboardNavbar title="So sánh plan theo model">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <PlanComparisonCard />
    </template>
  </UDashboardPanel>
</template>
