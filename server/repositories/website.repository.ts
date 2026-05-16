import type { CreateWebsiteInput, UpdateWebsiteInput } from '../validators/website.schema'

const EXTENSIONS_INCLUDE = {
  extensions: {
    include: {
      extension: {
        select: { id: true, name: true, type: true }
      }
    }
  }
} as const

export class WebsiteRepository {
  static findAll(filters: { phpVersion?: string, search?: string }) {
    return prisma.website.findMany({
      include: EXTENSIONS_INCLUDE,
      where: {
        ...(filters.phpVersion ? { phpVersion: filters.phpVersion } : {}),
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search } },
                { domain: { contains: filters.search } }
              ]
            }
          : {})
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  static findById(id: number) {
    return prisma.website.findUnique({
      where: { id },
      include: EXTENSIONS_INCLUDE
    })
  }

  static findByDomain(domain: string) {
    return prisma.website.findUnique({ where: { domain } })
  }

  static create(data: CreateWebsiteInput) {
    return prisma.website.create({
      data,
      include: EXTENSIONS_INCLUDE
    })
  }

  static update(id: number, data: UpdateWebsiteInput) {
    return prisma.website.update({
      where: { id },
      data,
      include: EXTENSIONS_INCLUDE
    })
  }

  static remove(id: number) {
    return prisma.website.delete({ where: { id } })
  }

  static async replaceExtensions(websiteId: number, extensionIds: number[]) {
    await prisma.websitePhpExtension.deleteMany({ where: { websiteId } })
    if (extensionIds.length > 0) {
      await prisma.websitePhpExtension.createMany({
        data: extensionIds.map(extensionId => ({
          websiteId,
          extensionId,
          enabled: true
        }))
      })
    }
    return prisma.website.findUnique({
      where: { id: websiteId },
      include: EXTENSIONS_INCLUDE
    })
  }

  static async verifyExtensionIdsExist(extensionIds: number[]) {
    const existing = await prisma.phpExtension.findMany({
      where: { id: { in: extensionIds } },
      select: { id: true }
    })
    return new Set(existing.map(e => e.id))
  }
}
