import type { UpdateServiceInput } from '../validators/service.schema'

const SERVICE_INCLUDE = {
  serviceType: true,
  envVars: true,
  ports: true,
  volumes: true
} as const

export const ServiceRepository = {
  findAllTypes() {
    return prisma.serviceType.findMany({ orderBy: { category: 'asc' } })
  },

  findTypeByKey(key: string) {
    return prisma.serviceType.findUnique({ where: { key } })
  },

  findAllServices() {
    return prisma.infrastructureService.findMany({
      include: SERVICE_INCLUDE,
      orderBy: { createdAt: 'desc' }
    })
  },

  findServiceById(id: number) {
    return prisma.infrastructureService.findUnique({
      where: { id },
      include: SERVICE_INCLUDE
    })
  },

  findServiceByName(serviceTypeId: number, containerName: string) {
    return prisma.infrastructureService.findUnique({
      where: { serviceTypeId_containerName: { serviceTypeId, containerName } }
    })
  },

  createService(data: {
    serviceTypeId: number
    containerName: string
    envVars?: { key: string, value: string, isSecret?: boolean }[]
    ports?: { hostPort: string, containerPort: string, protocol?: string }[]
    volumes?: { source: string, target: string }[]
  }) {
    return prisma.infrastructureService.create({
      data: {
        serviceTypeId: data.serviceTypeId,
        containerName: data.containerName,
        envVars: data.envVars?.length
          ? { createMany: { data: data.envVars } }
          : undefined,
        ports: data.ports?.length
          ? { createMany: { data: data.ports.map(p => ({ ...p, protocol: p.protocol ?? 'tcp' })) } }
          : undefined,
        volumes: data.volumes?.length
          ? { createMany: { data: data.volumes } }
          : undefined
      },
      include: SERVICE_INCLUDE
    })
  },

  async updateService(id: number, data: UpdateServiceInput) {
    if (data.envVars) {
      await prisma.serviceEnvVar.deleteMany({ where: { serviceId: id } })
      if (data.envVars.length > 0) {
        await prisma.serviceEnvVar.createMany({
          data: data.envVars.map(e => ({ serviceId: id, ...e }))
        })
      }
    }
    if (data.ports) {
      await prisma.servicePort.deleteMany({ where: { serviceId: id } })
      if (data.ports.length > 0) {
        await prisma.servicePort.createMany({
          data: data.ports.map(p => ({ serviceId: id, ...p, protocol: p.protocol ?? 'tcp' }))
        })
      }
    }
    if (data.volumes) {
      await prisma.serviceVolume.deleteMany({ where: { serviceId: id } })
      if (data.volumes.length > 0) {
        await prisma.serviceVolume.createMany({
          data: data.volumes.map(v => ({ serviceId: id, ...v }))
        })
      }
    }

    return prisma.infrastructureService.update({
      where: { id },
      data: {
        ...(data.containerName !== undefined ? { containerName: data.containerName } : {}),
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {})
      },
      include: SERVICE_INCLUDE
    })
  },

  deleteService(id: number) {
    return prisma.infrastructureService.delete({ where: { id } })
  }
}
