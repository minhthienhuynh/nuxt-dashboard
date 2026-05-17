const EXTENSION_INCLUDE = {
  versions: { select: { phpVersion: true } },
  specials: { select: { requirement: true } }
} as const

export const PhpExtensionRepository = {
  findAll(filters?: { php?: string, type?: string, search?: string }) {
    return prisma.phpExtension.findMany({
      include: EXTENSION_INCLUDE,
      where: {
        ...(filters?.type ? { type: filters.type } : {}),
        ...(filters?.search ? { name: { contains: filters.search } } : {}),
        ...(filters?.php
          ? { versions: { some: { phpVersion: filters.php } } }
          : {})
      },
      orderBy: { name: 'asc' }
    })
  }
}
