import { readBody, createError } from 'h3'
import prisma from '~~/server/utils/prisma'

export default eventHandler(async (event) => {
  const body = await readBody(event)
  const { name, domain, port, documentRoot, phpVersion, sslEnabled, status } = body

  if (!name || !domain || !documentRoot || !phpVersion) {
    throw createError({
      statusCode: 400,
      statusMessage: 'name, domain, documentRoot, and phpVersion are required'
    })
  }

  const existing = await prisma.website.findUnique({ where: { domain } })
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: `Domain "${domain}" is already in use`
    })
  }

  const website = await prisma.website.create({
    data: {
      name,
      domain,
      port: port ?? 80,
      documentRoot,
      phpVersion,
      sslEnabled: sslEnabled ?? false,
      status: status ?? 'stopped'
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

  return website
})
