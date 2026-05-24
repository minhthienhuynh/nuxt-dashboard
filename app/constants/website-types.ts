import type { WebsiteType } from '~/types'

export interface WebsiteTypeOption {
  label: string
  value: WebsiteType
  color: 'primary' | 'warning' | 'secondary'
}

export const WEBSITE_TYPE_OPTIONS: WebsiteTypeOption[] = [
  { label: 'PHP-FPM', value: 'php-fpm', color: 'primary' },
  { label: 'PHP Serve', value: 'php-serve', color: 'warning' },
  { label: 'Octane', value: 'php-octane', color: 'secondary' }
]

export function getTypeLabel(type: string): string {
  return WEBSITE_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type
}

export function getTypeColor(type: string): 'primary' | 'warning' | 'secondary' | 'neutral' {
  return WEBSITE_TYPE_OPTIONS.find(o => o.value === type)?.color ?? 'neutral'
}
