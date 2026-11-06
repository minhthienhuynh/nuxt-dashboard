export type PlanComparisonPlanKey = 'cmd' | 'goat' | 'go' | 'od'

export interface PlanComparisonPlanMeta {
  key: PlanComparisonPlanKey
  planId: string
  label: string
  color: string
}

// Order matches the bar/tooltip series order: Cmd Go, GOAT, OpenCode Go,
// OpenDesign Go.
export const PLAN_COMPARISON_PLANS: PlanComparisonPlanMeta[] = [
  { key: 'cmd', planId: 'cmd-go', label: 'Cmd Go', color: '#10b981' },
  { key: 'goat', planId: 'cmd-goat', label: 'Cmd GOAT', color: '#2563eb' },
  { key: 'go', planId: 'oc-go', label: 'OpenCode Go', color: '#bdc053' },
  { key: 'od', planId: 'od-go', label: 'OpenDesign Go', color: '#8b5cf6' }
]

export function planColor(planId: string): string {
  return PLAN_COMPARISON_PLANS.find(plan => plan.planId === planId)?.color ?? 'var(--ui-border-accented)'
}
