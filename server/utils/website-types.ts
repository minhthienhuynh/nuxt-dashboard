import { slugify } from './slugify'

export interface WebsiteTypeConfig {
  key: string
  label: string
  phpTag: (phpVersion: string) => string
  supervisorCommand: (dirName: string) => string
  supervisorUser: string
  proxyPort: string
  proxyStub: string
}

export const WEBSITE_TYPE_CONFIGS: Record<string, WebsiteTypeConfig> = {
  'php-fpm': {
    key: 'php-fpm',
    label: 'PHP-FPM',
    phpTag: (v) => `${v}-fpm`,
    supervisorCommand: () => 'php-fpm -F',
    supervisorUser: 'root',
    proxyPort: '9000',
    proxyStub: 'fpm'
  },
  'php-serve': {
    key: 'php-serve',
    label: 'PHP Serve',
    phpTag: (v) => `${v}-cli`,
    supervisorCommand: () => 'php artisan serve --host=0.0.0.0 --port=8000',
    supervisorUser: 'sail',
    proxyPort: '8000',
    proxyStub: 'cli'
  },
  'php-octane': {
    key: 'php-octane',
    label: 'Octane',
    phpTag: (v) => `${v}-cli`,
    supervisorCommand: () => 'php artisan octane:start --server=swoole --host=0.0.0.0 --port=8000',
    supervisorUser: 'sail',
    proxyPort: '8000',
    proxyStub: 'cli'
  }
}

export const DEFAULT_WEBSITE_TYPE = 'php-fpm'

export function getWebsiteTypeConfig(type?: string): WebsiteTypeConfig {
  return WEBSITE_TYPE_CONFIGS[type ?? DEFAULT_WEBSITE_TYPE] ?? WEBSITE_TYPE_CONFIGS[DEFAULT_WEBSITE_TYPE]!
}

export function imageTagForType(name: string, phpVersion: string, type: string): string {
  const suffix = type.replace('php-', '')
  return `${slugify(name)}:php-${phpVersion}-${suffix}`
}
