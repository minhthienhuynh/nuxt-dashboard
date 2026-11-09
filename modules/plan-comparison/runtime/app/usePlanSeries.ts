import { computed } from 'vue'
import { planLegendItems } from './plan-colors'
import type { PlanComparisonPlanKey, PlanComparisonPlanMeta } from './plan-colors'

/**
 * The plans a chart draws, plus their legend rows. Both charts picked the same
 * two things out of the registry — the shared-pool plans for the footnote and
 * the legend items — so they read them here: one list, one derivation, and an
 * unchecked plan leaves the bars, the dots and the footnote together.
 */
export function usePlanSeries(plans: () => PlanComparisonPlanMeta[], sharedPoolKeys: () => PlanComparisonPlanKey[]) {
  const sharedPoolPlans = computed(() => plans().filter(plan => sharedPoolKeys().includes(plan.key)))
  const legend = computed(() => planLegendItems(plans(), sharedPoolKeys()))
  // The footnote reads "OpenDesign Go sells … its bars" for one plan and
  // "A and B sell … their bars" for two, so the verb and pronoun follow the
  // list the reader currently has checked.
  const sharedPoolNote = computed(() => {
    const labels = sharedPoolPlans.value.map(plan => plan.label)
    const plural = labels.length > 1
    return {
      names: labels.join(' and '),
      verb: plural ? 'sell' : 'sells',
      pronoun: plural ? 'their' : 'its'
    }
  })

  return { sharedPoolPlans, sharedPoolNote, legend }
}
