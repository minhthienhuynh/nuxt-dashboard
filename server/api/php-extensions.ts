import { getQuery } from 'h3'
import prisma from '~~/server/utils/prisma'

export default eventHandler(async (event) => {
  const query = getQuery(event)
  const { php, type, search } = query

  const extensions = await prisma.phpExtension.findMany({
    include: {
      versions: { select: { phpVersion: true } },
      specials: { select: { requirement: true } }
    },
    where: {
      ...(type ? { type: type as string } : {}),
      ...(search ? { name: { contains: search as string } } : {}),
      ...(php
        ? { versions: { some: { phpVersion: php as string } } }
        : {})
    },
    orderBy: { name: 'asc' }
  })

  return extensions
})
