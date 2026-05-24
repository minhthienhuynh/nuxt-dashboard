import { PassThrough } from 'node:stream'
import type { Writable } from 'node:stream'
import { getDocker } from '../utils/docker'

const APP_NAME = process.env.APP_NAME || 'lardo'
const LARDO_NETWORK = `${APP_NAME}_proxy`

interface DockerSdkContainer {
  Names?: string[]
  Image?: string
  State?: string
  Status?: string
}

export const DockerContainerService = {
  async createAndStartContainer(config: {
    image: string
    name: string
    env?: Record<string, string>
    ports?: { host: string, container: string, proto?: string }[]
    volumes?: { source: string, target: string }[]
    network?: string
    cmd?: string[]
  }): Promise<void> {
    const docker = await getDocker()

    const env = config.env ? Object.entries(config.env).map(([k, v]) => `${k}=${v}`) : undefined

    const portBindings: Record<string, Array<{ HostPort: string }>> = {}
    const exposedPorts: Record<string, Record<string, never>> = {}
    if (config.ports) {
      for (const p of config.ports) {
        const key = `${p.container}/${p.proto || 'tcp'}`
        exposedPorts[key] = {}
        portBindings[key] = [{ HostPort: p.host }]
      }
    }

    const binds = config.volumes?.map(v => `${v.source}:${v.target}`)

    try {
      await docker.networkInspect(LARDO_NETWORK)
    } catch {
      await docker.networkCreate({ Name: LARDO_NETWORK })
    }

    const createSpec: Record<string, unknown> = {
      Image: config.image,
      Env: env,
      ExposedPorts: exposedPorts,
      Labels: {
        'com.docker.compose.project': APP_NAME
      },
      HostConfig: {
        PortBindings: portBindings,
        Binds: binds,
        NetworkMode: config.network || LARDO_NETWORK
      }
    }
    if (config.cmd?.length) {
      createSpec.Cmd = config.cmd
    }
    await docker.containerCreate(
      createSpec,
      { name: config.name }
    )

    await docker.containerStart(config.name)
  },

  async stopAndRemoveContainer(name: string): Promise<void> {
    const docker = await getDocker()
    try {
      await docker.containerStop(name)
      await docker.containerDelete(name)
    } catch (err: unknown) {
      console.error(`[DockerContainerService] Failed to stop/remove container ${name}:`, err)
    }
  },

  async stopContainer(name: string): Promise<void> {
    const docker = await getDocker()
    await docker.containerStop(name)
  },

  async startContainer(name: string): Promise<void> {
    const docker = await getDocker()
    await docker.containerStart(name)
  },

  async restartContainer(name: string): Promise<void> {
    const docker = await getDocker()
    await docker.containerRestart(name)
  },

  async containerExists(name: string): Promise<boolean> {
    const docker = await getDocker()
    try {
      await docker.containerInspect(name)
      return true
    } catch {
      return false
    }
  },

  async* getLogStream(
    containerName: string,
    tail = 100,
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    const docker = await getDocker()
    const pt = new PassThrough()

    docker.containerLogs(containerName, pt as unknown as Writable, pt as unknown as Writable, {
      stdout: true,
      stderr: true,
      tail: String(tail),
      follow: true
    }).catch((err: unknown) => {
      pt.destroy(err instanceof Error ? err : new Error(String(err)))
    })

    signal?.addEventListener('abort', () => pt.destroy(), { once: true })

    let buffer = ''
    let resolve: (value: IteratorResult<string>) => void
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let promise = new Promise<IteratorResult<string>>((r) => { resolve = r })
    let done = false

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        resolve({ value: line, done: false })
        promise = new Promise<IteratorResult<string>>((r) => { resolve = r })
      }
    }

    const onEnd = () => {
      done = true
      resolve({ value: buffer || undefined as unknown as string, done: true })
    }

    const onError = () => {
      done = true
      resolve({ value: undefined as unknown as string, done: true })
    }

    pt.on('data', onData)
    pt.on('end', onEnd)
    pt.on('error', onError)

    try {
      while (true) {
        const result = await promise
        if (result.done) break
        yield result.value
      }
    } finally {
      pt.off('data', onData)
      pt.off('end', onEnd)
      pt.off('error', onError)
      if (!done) pt.destroy()
    }
  },

  async getLogs(containerName: string, tail = 100): Promise<string> {
    try {
      const docker = await getDocker()
      const chunks: Buffer[] = []
      const stdout = new PassThrough()
      const stderr = new PassThrough()
      stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
      stderr.on('data', (chunk: Buffer) => chunks.push(chunk))

      await docker.containerLogs(containerName, stdout as unknown as Writable, stderr as unknown as Writable, {
        stdout: true,
        stderr: true,
        tail: String(tail)
      })

      return Buffer.concat(chunks).toString('utf-8')
    } catch (err: unknown) {
      console.error(`[DockerContainerService] Failed to get logs for ${containerName}:`, err)
      return ''
    }
  },

  async listLardoContainers() {
    const docker = await getDocker()
    const containers = await docker.containerList({ all: true })
    return containers
      .filter((c: DockerSdkContainer) =>
        c.Names?.some((n: string) =>
          n.includes('website-') || n.includes('caddy') || n.includes('traefik') || n.includes('nginx')
        )
      )
      .map((c: DockerSdkContainer) => ({
        name: c.Names?.[0]?.replace('/', ''),
        image: c.Image ?? '',
        state: c.State ?? '',
        status: c.Status ?? ''
      }))
  },

  async getContainerStatus(name: string): Promise<'running' | 'stopped' | 'error'> {
    try {
      const docker = await getDocker()
      const info = await docker.containerInspect(name)
      const state = (info as unknown as { State?: { Status?: string, ExitCode?: number } })?.State
      if (state?.Status === 'running') return 'running'
      if (state?.ExitCode !== undefined && state.ExitCode !== 0) return 'error'
      return 'stopped'
    } catch (err: unknown) {
      console.error(`[DockerContainerService] Failed to inspect container ${name}:`, err)
      return 'stopped'
    }
  },

  async getContainerStatuses(): Promise<Map<string, 'running' | 'stopped'>> {
    const result = new Map<string, 'running' | 'stopped'>()
    try {
      const docker = await getDocker()
      const containers = await docker.containerList({ all: true })
      for (const c of containers) {
        const container = c as unknown as DockerSdkContainer
        const name = container.Names?.[0]?.replace('/', '')
        if (name) {
          result.set(name, container.State === 'running' ? 'running' : 'stopped')
        }
      }
    } catch (err: unknown) {
      console.error('[DockerContainerService] Failed to list containers:', err)
    }
    return result
  }
}
