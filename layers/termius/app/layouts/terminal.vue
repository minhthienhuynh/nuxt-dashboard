<script setup lang="ts">
// Full-screen terminal layout (no dashboard sidebar). Each terminal opens in
// its own browser window for a single session; the page provides its own
// toolbar and pane.
</script>

<template>
  <div class="h-screen w-screen overflow-hidden bg-default">
    <slot />
  </div>
</template>
