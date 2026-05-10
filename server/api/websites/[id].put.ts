import { getRouterParam, readBody, createError } from 'h3'
import prisma from '~~/server/utils/prisma'

export default eventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))

  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid website ID' })
  }

  const website = await prisma.website.findUnique({ where: { id } })
  if (!website) {
    throw createError({ statusCode: 404, statusMessage: 'Website not found' })
  }

  const body = await readBody(event)
  const { name, domain, port, documentRoot, phpVersion, sslEnabled, status } = body

  if (domain && domain !== website.domain) {
    const existing = await prisma.website.findUnique({ where: { domain } })
    if (existing) {
      throw createError({
        statusCode: 409,
        statusMessage: `Domain "${domain}" is already in use`
      })
    }
  }

  const updated = await prisma.website.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(domain !== undefined ? { domain } : {}),
      ...(port !== undefined ? { port } : {}),
      ...(documentRoot !== undefined ? { documentRoot } : {}),
      ...(phpVersion !== undefined ? { phpVersion } : {}),
      ...(sslEnabled !== undefined ? { sslEnabled } : {}),
      ...(status !== undefined ? { status } : {})
    },
    include: {
      extensions: {
        include: {
          extension: {
            select: { id: true, name: true, type: true }
          }
        }
      }
    }
  })

  return updated
})
