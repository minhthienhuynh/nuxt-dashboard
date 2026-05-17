import type { WebsiteType } from '~/types'

export interface WebsiteTypeOption {
  label: string
  value: WebsiteType
  color: string
}

export const WEBSITE_TYPE_OPTIONS: WebsiteTypeOption[] = [
  { label: 'PHP-FPM', value: 'php-fpm', color: 'blue' },
  { label: 'PHP Serve', value: 'php-serve', color: 'amber' },
  { label: 'Octane', value: 'php-octane', color: 'purple' }
]

export function getTypeLabel(type: string): string {
  return WEBSITE_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type
}

export function getTypeColor(type: string): string {
  return WEBSITE_TYPE_OPTIONS.find(o => o.value === type)?.color ?? 'gray'
}
