import { getQuery } from 'h3'
import { readdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { homedir } from 'node:os'
import { z } from 'zod'
import { handleError, AppError } from '~~/server/utils/errors'

const ALLOWED_ROOTS = [process.cwd(), resolve(homedir(), 'Workspaces')]

const browsePathSchema = z.object({
  path: z.string().default('.'),
})

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const { path: pathParam } = browsePathSchema.parse(query)

    const expandedPath = pathParam.startsWith('~')
      ? resolve(homedir(), pathParam.slice(2))
      : pathParam
    const resolved = resolve(expandedPath)

    const isAllowed = ALLOWED_ROOTS.some(root => resolved.startsWith(root))
    if (!isAllowed) {
      throw new AppError('Access denied: path is outside allowed directories', 403)
    }

    const parent = dirname(resolved)
    const parentPath = ALLOWED_ROOTS.some(root => parent.startsWith(root))
      ? parent
      : null

    const names = await readdir(resolved, { withFileTypes: true })
    const entries = names
      .filter(dirent => dirent.isDirectory())
      .map(dirent => ({
        name: dirent.name,
        isDirectory: true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return {
      path: resolved,
      parentPath,
      entries,
    }
  } catch (error) {
    throw handleError(error)
  }
})
