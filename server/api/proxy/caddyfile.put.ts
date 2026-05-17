import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { readBody } from 'h3'
import { execSync } from 'node:child_process'
import { handleError } from '~~/server/utils/errors'
import { updateCaddyfileSchema } from '~~/server/validators/proxy.schema'

const CADDYFILE_PATH = path.resolve(process.cwd(), 'docker/proxy/caddy/Caddyfile')

export default eventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { content } = updateCaddyfileSchema.parse(body)

    await mkdir(path.dirname(CADDYFILE_PATH), { recursive: true })
    await writeFile(CADDYFILE_PATH, content, 'utf-8')

    // Reload Caddy if running
    try {
      execSync('docker exec caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || true', {
        stdio: 'pipe',
        timeout: 5000
      })
    } catch (error) {
      console.error('Caddy reload failed:', error)
    }

    return { success: true }
  } catch (error) {
    throw handleError(error)
  }
})
