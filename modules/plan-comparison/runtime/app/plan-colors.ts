export type PlanComparisonPlanKey = 'cmd' | 'goat' | 'go' | 'od' | 'th' | 'th-office'

export interface PlanComparisonPlanColors {
  light: string
  dark: string
}

export interface PlanComparisonPlanMeta {
  key: PlanComparisonPlanKey
  planId: string
  label: string
  color: string
  colors: PlanComparisonPlanColors
}

// Order matches the bar/tooltip series order: Command Code Go, Command Code
// GOAT, OpenCode Go, OpenDesign Go, Token Harbor Agent, Token Harbor Office.
// Colors use CSS variables with Light and Dark mode values defined in plan-chart.css.
export const PLAN_COMPARISON_PLANS: PlanComparisonPlanMeta[] = [
  {
    key: 'cmd',
    planId: 'cmd-go',
    label: 'Command Code Go',
    color: 'var(--pc-plan-cmd-go)',
    colors: { light: '#059669', dark: '#10b981' }
  },
  {
    key: 'goat',
    planId: 'cmd-goat',
    label: 'Command Code GOAT',
    color: 'var(--pc-plan-cmd-goat)',
    colors: { light: '#4338ca', dark: '#4f46e5' }
  },
  {
    key: 'go',
    planId: 'oc-go',
    label: 'OpenCode Go',
    color: 'var(--pc-plan-oc-go)',
    colors: { light: '#a7bfd6', dark: '#4e81b1' }
  },
  {
    key: 'od',
    planId: 'od-go',
    label: 'OpenDesign Go',
    color: 'var(--pc-plan-od-go)',
    colors: { light: '#7e22ce', dark: '#a855f7' }
  },
  {
    key: 'th',
    planId: 'th-agent',
    label: 'Token Harbor Agent',
    color: 'var(--pc-plan-th-agent)',
    colors: { light: '#ea580c', dark: '#f97316' }
  },
  {
    key: 'th-office',
    planId: 'th-office',
    label: 'Token Harbor Office',
    color: 'var(--pc-plan-th-office)',
    colors: { light: '#b45309', dark: '#f59e0b' }
  }
]

/**
 * Legend rows for the plans a chart draws. Labels stay plain — the plan name is
 * the whole distinction; see `PlanLimitsPercent` in types.ts for the shared-pool
 * note.
 */
export function planLegendItems(plans: PlanComparisonPlanMeta[]): { name: string, color: string }[] {
  return plans.map(plan => ({ name: plan.label, color: plan.color }))
}

export function planColor(planId: string, mode?: 'light' | 'dark'): string {
  const plan = PLAN_COMPARISON_PLANS.find(p => p.planId === planId)
  if (!plan) return 'var(--ui-border-accented)'
  if (mode) return plan.colors[mode]
  return plan.color
}
