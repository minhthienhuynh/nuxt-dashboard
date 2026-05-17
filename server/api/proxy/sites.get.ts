import fs from 'node:fs'
import path from 'node:path'
import { handleError } from '~~/server/utils/errors'

const SITES_DIR = path.resolve(process.cwd(), 'docker/proxy/caddy/sites')

export default eventHandler(async () => {
  try {
    if (!fs.existsSync(SITES_DIR)) return { sites: [] }
    const files = fs.readdirSync(SITES_DIR).filter(f => f.endsWith('.conf'))
    const sites = files.map(f => ({
      name: f.replace('.conf', ''),
      content: fs.readFileSync(path.join(SITES_DIR, f), 'utf-8')
    }))
    return { sites }
  } catch (error) {
    throw handleError(error)
  }
})
