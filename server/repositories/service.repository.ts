import type { UpdateServiceInput } from '../validators/service.schema'

const SERVICE_INCLUDE = {
  serviceType: true,
  envVars: true,
  ports: true,
  volumes: true
} as const

function formatServiceType<T extends { defaultPorts: string }>(t: T): Omit<T, 'defaultPorts'> & { defaultPorts: unknown } {
  return { ...t, defaultPorts: JSON.parse(t.defaultPorts) }
}

export const ServiceRepository = {
  async findAllTypes() {
    const types = await prisma.serviceType.findMany({ orderBy: { category: 'asc' } })
    return types.map(formatServiceType)
  },

  async findTypeByKey(key: string) {
    const type = await prisma.serviceType.findUnique({ where: { key } })
    return type ? formatServiceType(type) : null
  },

  async findAllServices() {
    const services = await prisma.infrastructureService.findMany({
      include: SERVICE_INCLUDE,
      orderBy: { createdAt: 'desc' }
    })
    return services.map(s => s.serviceType ? { ...s, serviceType: formatServiceType(s.serviceType) } : s)
  },

  async findServiceById(id: number) {
    const service = await prisma.infrastructureService.findUnique({
      where: { id },
      include: SERVICE_INCLUDE
    })
    if (service && service.serviceType) {
      return { ...service, serviceType: formatServiceType(service.serviceType) }
    }
    return service
  },

  findServiceByName(serviceTypeId: number, containerName: string) {
    return prisma.infrastructureService.findUnique({
      where: { serviceTypeId_containerName: { serviceTypeId, containerName } }
    })
  },

  async findAllUsedPorts() {
    const ports = await prisma.servicePort.findMany({
      select: { hostPort: true }
    })
    return ports.map(p => p.hostPort)
  },

  async createService(data: {
    serviceTypeId: number
    containerName: string
    envVars?: { key: string, value: string, isSecret?: boolean }[]
    ports?: { hostPort: string, containerPort: string, protocol?: string }[]
    volumes?: { source: string, target: string }[]
  }) {
    const result = await prisma.infrastructureService.create({
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
    if (result.serviceType) {
      return { ...result, serviceType: formatServiceType(result.serviceType) }
    }
    return result
  },

  async updateService(id: number, data: UpdateServiceInput) {
    return prisma.$transaction(async (tx) => {
      const { envVars, ports, volumes, ...serviceData } = data

      await tx.infrastructureService.update({
        where: { id },
        data: serviceData
      })

      if (envVars !== undefined) {
        await tx.serviceEnvVar.deleteMany({ where: { serviceId: id } })
        if (envVars.length > 0) {
          await tx.serviceEnvVar.createMany({
            data: envVars.map(v => ({ ...v, serviceId: id }))
          })
        }
      }

      if (ports !== undefined) {
        await tx.servicePort.deleteMany({ where: { serviceId: id } })
        if (ports.length > 0) {
          await tx.servicePort.createMany({
            data: ports.map(p => ({ ...p, serviceId: id }))
          })
        }
      }

      if (volumes !== undefined) {
        await tx.serviceVolume.deleteMany({ where: { serviceId: id } })
        if (volumes.length > 0) {
          await tx.serviceVolume.createMany({
            data: volumes.map(v => ({ ...v, serviceId: id }))
          })
        }
      }

      return tx.infrastructureService.findUnique({
        where: { id },
        include: SERVICE_INCLUDE
      })
    })
  },

  deleteService(id: number) {
    return prisma.infrastructureService.delete({ where: { id } })
  }
}
