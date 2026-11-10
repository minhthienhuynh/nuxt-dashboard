<script setup lang="ts">
definePageMeta({ layout: 'default' })

// Without this the tab keeps the template's `<title>`, which says nothing about
// the page someone actually has open.
useHead({ title: 'Plan comparison by model' })
</script>

<template>
  <UDashboardPanel id="plan-comparison">
    <template #header>
      <UDashboardNavbar title="Plan comparison by model">
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
