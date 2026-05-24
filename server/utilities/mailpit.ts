import { ServiceRepository } from '../repositories/service.repository'
import { DockerService } from '../services/docker.service'

const MAILPIT_DASHBOARD_PORT = '8025'

interface MailpitConnection {
  baseUrl: string
  hostPort: string
  containerName: string
}

/**
 * Find the first mailpit service (by serviceType key) and resolve its API URL.
 * Returns null if mailpit is not registered or not running.
 */
async function getMailpitConnection(): Promise<MailpitConnection | null> {
  const types = await ServiceRepository.findAllTypes()
  const mailpitType = types.find(t => t.key === 'mailpit')
  if (!mailpitType) return null

  const services = await ServiceRepository.findAllServices()
  const mailpit = services.find(s => s.serviceTypeId === mailpitType.id)
  if (!mailpit) return null

  // Find the dashboard port mapping
  const dashboardPort = (mailpit.ports || []).find(
    p => p.containerPort === MAILPIT_DASHBOARD_PORT
  )
  if (!dashboardPort) return null

  const containerStatus = await DockerService.getContainerStatus(mailpit.containerName)
  if (containerStatus !== 'running') return null

  return {
    baseUrl: `http://localhost:${dashboardPort.hostPort}/api/v1`,
    hostPort: dashboardPort.hostPort,
    containerName: mailpit.containerName
  }
}

/**
 * Fetch from mailpit API. Returns null if mailpit is not available.
 */
async function mailpitFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  const conn = await getMailpitConnection()
  if (!conn) return null

  const res = await fetch(`${conn.baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers }
  })
  if (!res.ok) {
    throw new Error(`Mailpit API error: ${res.status} ${res.statusText}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>
  }
  return { success: true } as unknown as T
}

/**
 * Get the mailpit dashboard URL for opening in browser.
 */
async function getMailpitDashboardUrl(): Promise<string | null> {
  const conn = await getMailpitConnection()
  if (!conn) return null
  return `http://localhost:${conn.hostPort}`
}

export { getMailpitConnection, mailpitFetch, getMailpitDashboardUrl }
