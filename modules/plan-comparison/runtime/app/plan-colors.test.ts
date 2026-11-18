import { describe, expect, it } from 'vitest'
import {
  PLAN_COMPARISON_PLANS,
  planColor,
  planLegendItems
} from './plan-colors'

describe('PLAN_COMPARISON_PLANS', () => {
  it('defines 6 supported plans in the registry', () => {
    expect(PLAN_COMPARISON_PLANS).toHaveLength(6)
    expect(PLAN_COMPARISON_PLANS.map(p => p.key)).toEqual([
      'cmd',
      'goat',
      'go',
      'od',
      'th',
      'th-office'
    ])
  })

  it('provides CSS variable colors for dynamic theme adaptation', () => {
    for (const plan of PLAN_COMPARISON_PLANS) {
      expect(plan.color).toMatch(/^var\(--pc-plan-[a-z0-9-]+\)$/)
    }
  })

  it('defines light and dark colors for all plans', () => {
    for (const plan of PLAN_COMPARISON_PLANS) {
      expect(plan.colors.light).toMatch(/^#[0-9a-f]{6}$/i)
      expect(plan.colors.dark).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('matches official OpenCode Go console colors for light and dark modes', () => {
    const oc = PLAN_COMPARISON_PLANS.find(p => p.planId === 'oc-go')
    expect(oc?.colors.light).toBe('#a7bfd6')
    expect(oc?.colors.dark).toBe('#4e81b1')
  })
})

describe('planLegendItems', () => {
  it('maps plans to legend item objects with name and color', () => {
    const items = planLegendItems(PLAN_COMPARISON_PLANS)
    expect(items).toEqual(
      PLAN_COMPARISON_PLANS.map(p => ({ name: p.label, color: p.color }))
    )
  })
})

describe('planColor', () => {
  it('returns CSS variable by default', () => {
    expect(planColor('oc-go')).toBe('var(--pc-plan-oc-go)')
    expect(planColor('cmd-go')).toBe('var(--pc-plan-cmd-go)')
  })

  it('returns explicit mode color when requested', () => {
    expect(planColor('oc-go', 'light')).toBe('#a7bfd6')
    expect(planColor('oc-go', 'dark')).toBe('#4e81b1')
  })

  it('falls back to accent border for unknown plans', () => {
    expect(planColor('unknown-plan')).toBe('var(--ui-border-accented)')
  })
})
