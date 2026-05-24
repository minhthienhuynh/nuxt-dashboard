import { getQuery } from 'h3'
import { readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import { handleError, AppError } from '~~/server/utils/errors'

const ALLOWED_ROOTS = [process.cwd()]

const browsePathSchema = z.object({
  path: z.string().default('.'),
})

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const { path: pathParam } = browsePathSchema.parse(query)

    const resolved = resolve(pathParam)

    const isAllowed = ALLOWED_ROOTS.some(root => resolved.startsWith(root))
    if (!isAllowed) {
      throw new AppError('Access denied: path is outside allowed directories', 403)
    }

    const names = await readdir(resolved)
    const entries = await Promise.all(
      names.map(async (name) => {
        const fullPath = resolve(resolved, name)
        try {
          const s = await stat(fullPath)
          return {
            name,
            type: s.isDirectory() ? 'directory' : 'file',
            size: s.isFile() ? s.size : null,
            path: fullPath,
          }
        } catch {
          return {
            name,
            type: 'file',
            size: null,
            path: fullPath,
          }
        }
      })
    )

    return entries
  } catch (error) {
    throw handleError(error)
  }
})
