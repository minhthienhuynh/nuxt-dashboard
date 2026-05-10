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
  const { extensionIds } = body as { extensionIds: number[] }

  if (!Array.isArray(extensionIds)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'extensionIds must be an array of extension IDs'
    })
  }

  // Verify all extension IDs exist
  const existingExtensions = await prisma.phpExtension.findMany({
    where: { id: { in: extensionIds } },
    select: { id: true }
  })
  const existingIds = new Set(existingExtensions.map((e) => e.id))
  const invalidIds = extensionIds.filter((eid) => !existingIds.has(eid))
  if (invalidIds.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid extension IDs: ${invalidIds.join(', ')}`
    })
  }

  // Replace all extensions for this website
  await prisma.websitePhpExtension.deleteMany({ where: { websiteId: id } })

  if (extensionIds.length > 0) {
    await prisma.websitePhpExtension.createMany({
      data: extensionIds.map((extensionId) => ({
        websiteId: id,
        extensionId,
        enabled: true
      }))
    })
  }

  // Return updated website with extensions
  const updated = await prisma.website.findUnique({
    where: { id },
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
