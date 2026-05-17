import type { AvatarProps } from '@nuxt/ui'

export type UserStatus = 'subscribed' | 'unsubscribed' | 'bounced'
export type SaleStatus = 'paid' | 'failed' | 'refunded'

export interface User {
  id: number
  name: string
  email: string
  avatar?: AvatarProps
  status: UserStatus
  location: string
}

export interface Mail {
  id: number
  unread?: boolean
  from: User
  subject: string
  body: string
  date: string
}

export interface Member {
  name: string
  username: string
  role: 'member' | 'owner'
  avatar: AvatarProps
}

export interface Stat {
  title: string
  icon: string
  value: number | string
  variation: number
  formatter?: (value: number) => string
}

export interface Sale {
  id: string
  date: string
  status: SaleStatus
  email: string
  amount: number
}

export interface Notification {
  id: number
  unread?: boolean
  sender: User
  body: string
  date: string
}

export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
  start: Date
  end: Date
}

// Website management types
export type WebsiteType = 'php-fpm' | 'php-serve' | 'php-octane'
export type WebsiteStatus = 'running' | 'stopped' | 'error'

export interface Website {
  id: number
  name: string
  domain: string
  type: WebsiteType
  port: number
  documentRoot: string
  phpVersion: string
  sslEnabled: boolean
  status: WebsiteStatus
  buildHash: string | null
  createdAt: string
  updatedAt: string
  extensions?: WebsitePhpExtension[]
}

export interface WebsitePhpExtension {
  id: number
  websiteId: number
  extensionId: number
  enabled: boolean
  extension?: PhpExtensionInfo
}

export interface PhpExtensionInfo {
  id: number
  name: string
  type: string
}

export interface CreateWebsiteInput {
  name: string
  domain: string
  type?: WebsiteType
  port?: number
  documentRoot: string
  phpVersion: string
  sslEnabled?: boolean
}

export interface UpdateWebsiteInput {
  name?: string
  domain?: string
  type?: WebsiteType
  port?: number
  documentRoot?: string
  phpVersion?: string
  sslEnabled?: boolean
}

export interface UpdateWebsiteExtensionsInput {
  extensionIds: number[]
}

// ── Service Management Types ──

export type ServiceCategory = 'database' | 'cache' | 'search' | 'mail' | 'storage' | 'queue' | 'websocket' | 'testing'

export type ProxyType = 'caddy'

export type ServiceStatus = 'running' | 'stopped' | 'error'

export interface ProxyConfig {
  id: number
  type: ProxyType
  httpPort: number
  httpsPort: number
  adminPort: number
  domain: string
  updatedAt: string
}

export interface UpdateProxyInput {
  type?: ProxyType
  httpPort?: number
  httpsPort?: number
  adminPort?: number
  domain?: string
}

export interface ServiceTypeInfo {
  id: number
  key: string
  name: string
  category: ServiceCategory
  defaultImage: string | null
  defaultPorts: ServicePortInfo[]
  hasHealthcheck: boolean
  hasPersistence: boolean
}

export interface ServicePortInfo {
  hostPort: string
  containerPort: string
  protocol?: string
}

export interface InfrastructureService {
  id: number
  serviceTypeId: number
  containerName: string
  imageOverride: string | null
  status: ServiceStatus
  enabled: boolean
  createdAt: string
  updatedAt: string
  serviceType?: ServiceTypeInfo
  envVars?: ServiceEnvVar[]
  ports?: ServicePort[]
  volumes?: ServiceVolume[]
}

export interface ServiceEnvVar {
  id: number
  serviceId: number
  key: string
  value: string
  isSecret: boolean
}

export interface ServicePort {
  id: number
  serviceId: number
  hostPort: string
  containerPort: string
  protocol: string
}

export interface ServiceVolume {
  id: number
  serviceId: number
  source: string
  target: string
}

export interface CreateServiceInput {
  serviceTypeKey: string
  containerName?: string
  envVars?: { key: string, value: string, isSecret?: boolean }[]
  ports?: { hostPort: string, containerPort: string, protocol?: string }[]
  volumes?: { source: string, target: string }[]
}

export interface UpdateServiceInput {
  containerName?: string
  envVars?: { key: string, value: string, isSecret?: boolean }[]
  ports?: { hostPort: string, containerPort: string, protocol?: string }[]
  volumes?: { source: string, target: string }[]
  enabled?: boolean
}

export interface SyncResult {
  running: { containerName: string, state: string }[]
  stopped: { containerName: string, state: string }[]
  missing: string[]
  total: number
}

export interface DockerContainer {
  name: string
  image: string
  state: string
  status: string
}
