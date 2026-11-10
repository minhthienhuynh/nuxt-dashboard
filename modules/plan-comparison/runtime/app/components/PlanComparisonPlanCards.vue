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

/**
 * Every plan sizes its windows as a share of its own pool, so the card shows
 * percentages throughout: dollars would compare $3 of Go's $10 with $20 of
 * GOAT's $100 and read as if the second buys six times the headroom. The share
 * is also what actually caps a request, because a model's window is that share
 * of the model's own allocation (a $20 GOAT model gets 20% of $20).
 *
 * A `null` window means the plan publishes no such cap at all (Token Harbor
 * Agent sells one monthly pool), so the card shows a dash rather than inventing
 * one.
 */
function windowValue(plan: PlanCard, window: '5h' | 'weekly' | 'monthly'): string {
  if (plan.limitPercent) {
    const percent = plan.limitPercent[window]
    return percent == null ? '—' : `${percent}%`
  }
  const limit = plan.limits[window]
  return limit == null ? '—' : formatUsd(limit)
}

/**
 * 100% is the whole pool by definition, so a monthly cap at 100% says nothing the
 * other rows do not; it is only listed when a plan caps the month below — nothing
 * today does, and the row will appear if one ever does.
 */
function showMonthlyCap(plan: PlanCard): boolean {
  if (plan.limitPercent) return plan.limitPercent.monthly !== 100
  const monthly = plan.limits.monthly
  return monthly != null && monthly !== plan.monthlyCredit
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
  // NO pool row: the same word means three things across these vendors — Command
  // Code's $100 is a ceiling that a standard $20 model spends whole, OpenCode's
  // $60 is a hard cap its $100 model allocation exceeds, OpenDesign's $60 is only
  // a normalisation baseline under a $220 headline. Side by side they invite
  // exactly the wrong read (GOAT "$100" looks richest, yet 43 of its 62 models
  // fund $20 against OpenCode's $60), so the card starts from the number a reader
  // actually gets: what the plan funds on one model.
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
          <span class="flex items-center gap-2 font-semibold text-highlighted">
            <span
              class="inline-block size-2.5 shrink-0 rounded-sm"
              :style="{ background: planColor(plan.id) }"
            />
            {{ plan.label }}
          </span>
          <!-- Vendor's own plan name, only when it says something new. -->
          <span
            v-if="vendorPlanName(plan)"
            class="truncate text-xs text-muted"
          >
            vendor plan: {{ vendorPlanName(plan) }}
          </span>
        </div>
        <!-- Checked = this plan's models are listed in the charts. Unchecking
             takes them out; the charts stay empty rather than falling back to
             the full list. -->
        <UCheckbox
          :model-value="selection[plan.key] !== false"
          :aria-label="`Show ${plan.label} models in the charts`"
          :title="`Show ${plan.label} models in the charts`"
          class="shrink-0 pt-0.5"
          @update:model-value="value => emit('toggle', plan.key, value === true)"
        />
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
