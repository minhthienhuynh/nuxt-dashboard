import { getQuery } from 'h3'
import prisma from '~~/server/utils/prisma'

export default eventHandler(async (event) => {
  const query = getQuery(event)
  const { phpVersion, status, search } = query

  const websites = await prisma.website.findMany({
    include: {
      extensions: {
        include: {
          extension: {
            select: { id: true, name: true, type: true }
          }
        }
      }
    },
    where: {
      ...(phpVersion ? { phpVersion: phpVersion as string } : {}),
      ...(status ? { status: status as string } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search as string } },
              { domain: { contains: search as string } }
            ]
          }
        : {})
    },
    orderBy: { createdAt: 'desc' }
  })

  return websites
})
