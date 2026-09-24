<script setup lang="ts">
import { computed } from 'vue'
import { fundingWithPlans, modelInfoFields } from '../model-info'
import type { EnrichedModelRow } from '../composables/usePlanComparisonDatabase'

const props = defineProps<{
  /** Hovered row; `null` renders nothing. */
  row: EnrichedModelRow | null
  /** Anchor for the popover, in viewport coordinates (clientX/Y). */
  x: number
  y: number
}>()

interface VirtualAnchor {
  getBoundingClientRect: () => DOMRect
}

// Virtual element (see the "following cursor" pattern in the Nuxt UI Popover
// docs): floating-ui measures it in viewport coordinates, which is what the
// stored clientX/Y already are — no container-relative conversion needed.
const anchor = computed<VirtualAnchor | null>(() => {
  if (props.row == null) return null
  return {
    getBoundingClientRect: () => ({
      width: 0,
      height: 0,
      left: props.x,
      right: props.x,
      top: props.y,
      bottom: props.y,
      x: props.x,
      y: props.y
    } as DOMRect)
  }
})

const emit = defineEmits<{ close: [], contentEnter: [], contentLeave: [] }>()

const specFields = computed(() => props.row ? modelInfoFields(props.row.model, props.row.pricing) : [])

// Funding rows carry the plan meta alongside the formatted value so the
// template can tint each plan name with its registry color.
const funding = computed(() => props.row ? fundingWithPlans(props.row) : [])
</script>

<template>
  <!--
    Hover mode (Reka HoverCard under the hood) with a virtual `reference` anchor
    in viewport coordinates. Open/close delays live in usePlanChartHover (a
    controlled `:open` would bypass HoverCard's own timers). `dismissible` stays
    on so touch users can tap outside or press Escape to close the tap-toggled
    tooltip.
  -->
  <UPopover
    v-if="row && anchor"
    mode="hover"
    enable-touch
    :open="true"
    :reference="anchor"
    :content="{ side: 'bottom', align: 'start' }"
    @update:open="(value: boolean) => { if (!value) emit('close') }"
  >
    <template #content>
      <div
        class="w-64 max-w-[calc(100vw-32px)] p-3 text-xs"
        data-plan-model-info
        role="tooltip"
        :aria-label="row.model.name"
        @pointerenter="emit('contentEnter')"
        @pointerleave="emit('contentLeave')"
      >
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-semibold text-highlighted">
            {{ row.model.name }}
          </p>
        </div>
        <dl v-if="specFields.length" class="mt-2 space-y-1">
          <div v-for="field in specFields" :key="field.label" class="flex justify-between gap-3">
            <dt class="shrink-0 text-dimmed">
              {{ field.label }}
            </dt>
            <dd class="text-right text-toned">
              {{ field.value }}
            </dd>
          </div>
        </dl>
        <dl v-if="funding.length" class="mt-2 space-y-1 border-t border-default pt-2">
          <div v-for="field in funding" :key="field.plan.key" class="flex justify-between gap-3">
            <dt class="flex shrink-0 items-center gap-1.5 text-dimmed">
              <span
                class="inline-block size-2 rounded-sm"
                :style="{ background: field.plan.color }"
              />
              {{ field.label }}
            </dt>
            <dd class="text-right text-toned">
              {{ field.value }}
            </dd>
          </div>
        </dl>
      </div>
    </template>
  </UPopover>
</template>
