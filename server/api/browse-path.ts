import { getQuery, createError } from 'h3'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export default eventHandler(async (event) => {
  const query = getQuery(event)
  const pathParam = query.path as string

  if (!pathParam) {
    throw createError({ statusCode: 400, statusMessage: 'path query parameter is required' })
  }

  const resolved = pathParam.startsWith('~')
    ? join(process.env.HOME!, pathParam.slice(1))
    : pathParam

  try {
    const entries = readdirSync(resolved)
      .map((name) => {
        const fullPath = join(resolved, name)
        try {
          const stat = statSync(fullPath)
          return { name, isDirectory: stat.isDirectory() }
        } catch {
          return { name, isDirectory: false }
        }
      })
      .filter((e) => e.isDirectory)
      .sort((a, b) => a.name.localeCompare(b.name))

    const parentPath = join(resolved, '..')

    return {
      path: resolved,
      parentPath,
      entries
    }
  } catch {
    throw createError({
      statusCode: 404,
      statusMessage: `Cannot read directory: ${resolved}`
    })
  }
})
