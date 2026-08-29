export type PlanComparisonPlanKey = 'cmd' | 'goat' | 'go'

export interface PlanComparisonPlanMeta {
  key: PlanComparisonPlanKey
  planId: string
  label: string
  color: string
}

// Order matches the bar/tooltip series order: Cmd Go, GOAT, OpenCode Go.
export const PLAN_COMPARISON_PLANS: PlanComparisonPlanMeta[] = [
  { key: 'cmd', planId: 'cmd-go', label: 'Cmd Go', color: '#10b981' },
  { key: 'goat', planId: 'cmd-goat', label: 'GOAT', color: '#2563eb' },
  { key: 'go', planId: 'oc-go', label: 'OpenCode Go', color: '#f59e0b' }
]

export function planColor(planId: string): string {
  return PLAN_COMPARISON_PLANS.find(plan => plan.planId === planId)?.color ?? 'var(--ui-border-accented)'
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;'
  })[ch] ?? ch)
}
