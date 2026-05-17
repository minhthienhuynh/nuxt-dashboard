import fs from 'node:fs'
import path from 'node:path'
import { readBody } from 'h3'
import { execSync } from 'node:child_process'
import { handleError } from '~~/server/utils/errors'

const CADDYFILE_PATH = path.resolve(process.cwd(), 'docker/proxy/caddy/Caddyfile')

export default eventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const content: string = body.content ?? ''

    fs.mkdirSync(path.dirname(CADDYFILE_PATH), { recursive: true })
    fs.writeFileSync(CADDYFILE_PATH, content, 'utf-8')

    // Reload Caddy if running
    try {
      execSync('docker exec caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || true', {
        stdio: 'pipe',
        timeout: 5000
      })
    } catch {
      // Caddy might not be running — ignore reload errors
    }

    return { success: true }
  } catch (error) {
    throw handleError(error)
  }
})
