<script setup lang="ts">
import type { PlanCard, PlanSelection } from '../composables/usePlanComparisonDatabase'
import type { PlanComparisonPlanKey } from '../plan-colors'
import { formatUsd } from '../format-usd'
import { planColor } from '../plan-colors'

defineProps<{
  planCards: PlanCard[]
  /** Checked plans feed the charts; all checked by default ("full"). */
  selection: PlanSelection
}>()

const emit = defineEmits<{
  (event: 'toggle', key: PlanComparisonPlanKey, selected: boolean): void
}>()

/** A window is a share of the plan's own pool; `null` means it publishes none. */
function windowValue(plan: PlanCard, window: '5h' | 'weekly' | 'monthly'): string {
  const percent = plan.limitPercent?.[window]
  return percent == null ? '—' : `${percent}%`
}

/** 100% is the whole pool, so a monthly cap only earns a row when it is below. */
function showMonthlyCap(plan: PlanCard): boolean {
  return (plan.limitPercent?.monthly ?? 100) !== 100
}

/**
 * Vendors name their plans after ours ("Go Plan" for "Command Code Go", "Cmd
 * GOAT Plan" for "Command Code GOAT"), which reads like a duplicate label — and
 * printed a *short* vendor name there, which is where a stray "Cmd" came from.
 * Compare word sets, expanding the vendor's own abbreviations, and only surface
 * the vendor's name when it carries a word the label does not.
 */
const GENERIC_PLAN_WORDS = new Set(['plan', 'agent', 'pass', 'subscription', 'tier'])
const PLAN_WORD_ALIASES: Record<string, string[]> = {
  cmd: ['command', 'code'],
  commandcode: ['command', 'code']
}

function planWords(value: string, dropGenerics: boolean): Set<string> {
  const words = new Set<string>()
  for (const word of value.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!word || (dropGenerics && GENERIC_PLAN_WORDS.has(word))) continue
    for (const expanded of PLAN_WORD_ALIASES[word] ?? [word]) words.add(expanded)
  }
  return words
}

function vendorPlanName(plan: PlanCard): string {
  const name = planWords(plan.name, true)
  // "Agent Pass" is nothing but generic words: it names the tier, so it is all
  // new information next to "Token Harbor Agent".
  if (!name.size) return plan.name
  const label = planWords(plan.label, true)
  return [...name].some(word => !label.has(word)) ? plan.name : ''
}

const ROWS: Array<{ label: string, value: (plan: PlanCard) => string, show?: (plan: PlanCard) => boolean }> = [
  // No pool row: the word covers three different things here (Command Code's
  // $100 ceiling, OpenCode's hard $60 cap, OpenDesign's $60 baseline), and side by
  // side GOAT's "$100" reads richer than OpenCode's $60 although 43 of its 62
  // models fund $20. Start from what a reader gets on one model instead.
  { label: 'Per-model usage', value: plan => plan.creditRange ? `${formatUsd(plan.creditRange.min)}–${formatUsd(plan.creditRange.max)}` : '' },
  { label: '5-hour cap', value: plan => windowValue(plan, '5h') },
  { label: 'Weekly cap', value: plan => windowValue(plan, 'weekly') },
  { label: 'Monthly cap', value: plan => windowValue(plan, 'monthly'), show: showMonthlyCap },
  { label: 'Funded models', value: plan => String(plan.modelCount) }
]
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
    <UCard
      v-for="plan in planCards"
      :key="plan.id"
      :ui="{ body: 'gap-y-1.5' }"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex min-w-0 flex-wrap items-baseline gap-2">
          <span class="flex flex-wrap items-center gap-2 font-semibold text-highlighted">
            <span
              class="inline-block size-2.5 shrink-0 rounded-sm"
              :style="{ background: planColor(plan.id) }"
            />
            {{ plan.label }}
          </span>
          <!-- Vendor's own plan name, in parentheses and on the same line: as a
               line of its own reading "vendor plan: …" it showed up on exactly
               one card and looked like a rendering mistake. -->
          <span
            v-if="vendorPlanName(plan)"
            class="truncate text-xs font-normal text-muted"
          >({{ vendorPlanName(plan) }})</span>
        </div>
        <!-- Checked = this plan's models are listed in the charts. Unchecking
             takes them out; the charts stay empty rather than falling back to
             the full list. -->
        <!-- The box itself is 16px; the label grows the target to 24px, the
             minimum WCAG 2.5.8 asks for, and the negative margin keeps the box
             where it was. -->
        <label class="-m-1 flex shrink-0 cursor-pointer items-center justify-center p-1">
          <UCheckbox
            :model-value="selection[plan.key] !== false"
            :aria-label="`Show ${plan.label} models in the charts`"
            :title="`Show ${plan.label} models in the charts`"
            @update:model-value="value => emit('toggle', plan.key, value === true)"
          />
        </label>
      </div>

      <p class="text-3xl font-bold text-highlighted">
        {{ formatUsd(plan.price) }}<span class="text-sm font-normal text-muted"> /mo</span>
      </p>

      <dl class="mt-2 space-y-0.5 text-[13px] text-muted">
        <div
          v-for="row in ROWS.filter(candidate => candidate.value(plan) && (candidate.show?.(plan) ?? true))"
          :key="row.label"
          class="flex items-center justify-between gap-3"
        >
          <dt class="whitespace-nowrap">
            {{ row.label }}
          </dt>
          <dd class="whitespace-nowrap text-default">
            {{ row.value(plan) }}
          </dd>
        </div>
      </dl>
    </UCard>
  </div>
</template>
