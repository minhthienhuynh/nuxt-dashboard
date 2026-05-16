import { AppError } from '../utils/errors'
import { ServiceRepository } from '../repositories/service.repository'
import type { CreateServiceInput, UpdateServiceInput } from '../validators/service.schema'

export class ServiceService {
  static async listTypes() {
    return ServiceRepository.findAllTypes()
  }

  static async listServices() {
    return ServiceRepository.findAllServices()
  }

  static async getById(id: number) {
    const service = await ServiceRepository.findServiceById(id)
    if (!service) {
      throw new AppError('Service not found', 404)
    }
    return service
  }

  static async create(input: CreateServiceInput) {
    const type = await ServiceRepository.findTypeByKey(input.serviceTypeKey)
    if (!type) {
      throw new AppError(`Unknown service type: ${input.serviceTypeKey}`, 400)
    }

    const containerName = input.containerName || `${type.key}-${Date.now()}`

    const existing = await ServiceRepository.findServiceByName(type.id, containerName)
    if (existing) {
      throw new AppError(`Service "${containerName}" already exists`, 409)
    }

    return ServiceRepository.createService({
      serviceTypeId: type.id,
      containerName,
      envVars: input.envVars,
      ports: input.ports,
      volumes: input.volumes
    })
  }

  static async update(id: number, input: UpdateServiceInput) {
    const service = await ServiceRepository.findServiceById(id)
    if (!service) {
      throw new AppError('Service not found', 404)
    }
    return ServiceRepository.updateService(id, input)
  }

  static async remove(id: number) {
    const service = await ServiceRepository.findServiceById(id)
    if (!service) {
      throw new AppError('Service not found', 404)
    }
    await ServiceRepository.deleteService(id)
    return { success: true }
  }
}
