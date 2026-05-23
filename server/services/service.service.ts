import { AppError } from '../utils/errors'
import { ServiceRepository } from '../repositories/service.repository'
import { SERVICE_DEFAULTS } from '../utils/service-defaults'
import type { CreateServiceInput, UpdateServiceInput } from '../validators/service.schema'

export const ServiceService = {
  async listTypes() {
    return ServiceRepository.findAllTypes()
  },

  async listServices() {
    return ServiceRepository.findAllServices()
  },

  async getById(id: number) {
    const service = await ServiceRepository.findServiceById(id)
    if (!service) {
      throw new AppError('Service not found', 404)
    }
    return service
  },

  async create(input: CreateServiceInput) {
    const type = await ServiceRepository.findTypeByKey(input.serviceTypeKey)
    if (!type) {
      throw new AppError(`Unknown service type: ${input.serviceTypeKey}`, 400)
    }

    // Auto-fill required env vars with defaults if not provided
    const defaults = SERVICE_DEFAULTS[type.key]
    const existingKeys = new Set(input.envVars?.map(e => e.key) || [])
    const defaultEnvVars = defaults?.requiredEnv
      ? Object.entries(defaults.requiredEnv)
          .filter(([k]) => !existingKeys.has(k))
          .map(([key, value]) => ({ key, value }))
      : []
    const envVars = [...(input.envVars || []), ...defaultEnvVars]

    const containerName = input.containerName || `${type.key}-${Date.now()}`

    const existing = await ServiceRepository.findServiceByName(type.id, containerName)
    if (existing) {
      throw new AppError(`Service "${containerName}" already exists`, 409)
    }

    return ServiceRepository.createService({
      serviceTypeId: type.id,
      containerName,
      envVars,
      ports: input.ports,
      volumes: input.volumes
    })
  },

  async update(id: number, input: UpdateServiceInput) {
    const service = await ServiceRepository.findServiceById(id)
    if (!service) {
      throw new AppError('Service not found', 404)
    }
    return ServiceRepository.updateService(id, input)
  },

  async remove(id: number) {
    const service = await ServiceRepository.findServiceById(id)
    if (!service) {
      throw new AppError('Service not found', 404)
    }
    await ServiceRepository.deleteService(id)
    return { success: true }
  }
}
