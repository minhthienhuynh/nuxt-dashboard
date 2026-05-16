import { AppError } from '../utils/errors'
import { WebsiteRepository } from '../repositories/website.repository'
import type {
  CreateWebsiteInput,
  UpdateWebsiteInput,
  WebsiteQueryParams,
  WebsiteExtensionsInput
} from '../validators/website.schema'

export class WebsiteService {
  static async list(query: WebsiteQueryParams) {
    return WebsiteRepository.findAll(query)
  }

  static async getById(id: number) {
    const website = await WebsiteRepository.findById(id)
    if (!website) {
      throw new AppError('Website not found', 404)
    }
    return website
  }

  static async create(input: CreateWebsiteInput) {
    const existing = await WebsiteRepository.findByDomain(input.domain)
    if (existing) {
      throw new AppError(`Domain "${input.domain}" is already in use`, 409)
    }
    return WebsiteRepository.create(input)
  }

  static async update(id: number, input: UpdateWebsiteInput) {
    const website = await WebsiteRepository.findById(id)
    if (!website) {
      throw new AppError('Website not found', 404)
    }
    if (input.domain && input.domain !== website.domain) {
      const existing = await WebsiteRepository.findByDomain(input.domain)
      if (existing) {
        throw new AppError(`Domain "${input.domain}" is already in use`, 409)
      }
    }
    return WebsiteRepository.update(id, input)
  }

  static async remove(id: number) {
    const website = await WebsiteRepository.findById(id)
    if (!website) {
      throw new AppError('Website not found', 404)
    }
    await WebsiteRepository.remove(id)
    return { success: true }
  }

  static async updateExtensions(id: number, input: WebsiteExtensionsInput) {
    const website = await WebsiteRepository.findById(id)
    if (!website) {
      throw new AppError('Website not found', 404)
    }
    if (input.extensionIds.length > 0) {
      const validIds = await WebsiteRepository.verifyExtensionIdsExist(input.extensionIds)
      const invalidIds = input.extensionIds.filter(eid => !validIds.has(eid))
      if (invalidIds.length > 0) {
        throw new AppError(`Invalid extension IDs: ${invalidIds.join(', ')}`, 400)
      }
    }
    return WebsiteRepository.replaceExtensions(id, input.extensionIds)
  }
}
