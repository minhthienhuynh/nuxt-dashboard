import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { handleError } from '~~/server/utils/errors'

const SITES_DIR = path.resolve(process.cwd(), 'docker/proxy/caddy/sites')

export default eventHandler(async () => {
  try {
    try {
      await access(SITES_DIR)
    } catch {
      return { sites: [] }
    }
    const files = (await readdir(SITES_DIR)).filter(f => f.endsWith('.conf'))
    const sites = await Promise.all(files.map(async f => ({
      name: f.replace('.conf', ''),
      content: await readFile(path.join(SITES_DIR, f), 'utf-8')
    })))
    return { sites }
  } catch (error) {
    throw handleError(error)
  }
})
