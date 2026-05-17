import fs from 'node:fs'
import path from 'node:path'
import { handleError } from '~~/server/utils/errors'

const CADDYFILE_PATH = path.resolve(process.cwd(), 'docker/proxy/caddy/Caddyfile')

export default eventHandler(async () => {
  try {
    if (!fs.existsSync(CADDYFILE_PATH)) {
      return { content: '', exists: false }
    }
    const content = fs.readFileSync(CADDYFILE_PATH, 'utf-8')
    return { content, exists: true, path: CADDYFILE_PATH }
  } catch (error) {
    throw handleError(error)
  }
})
