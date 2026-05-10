import { getRouterParam, createError } from 'h3'
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

  await prisma.website.delete({ where: { id } })

  return { success: true }
})
