import { z } from 'zod'

export const websiteTypeSchema = z.enum(['php-fpm', 'php-serve', 'php-octane'])

export const websiteCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  domain: z.string().min(1, 'Domain is required'),
  type: websiteTypeSchema.default('php-fpm'),
  port: z.coerce.number().int().min(1).max(65535).default(80),
  documentRoot: z.string().min(1, 'Document root is required'),
  phpVersion: z.string().min(1, 'PHP version is required'),
  sslEnabled: z.boolean().default(false)
})

export const websiteUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  domain: z.string().min(1).optional(),
  type: websiteTypeSchema.optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  documentRoot: z.string().min(1).optional(),
  phpVersion: z.string().min(1).optional(),
  sslEnabled: z.boolean().optional()
})

export const websiteQuerySchema = z.object({
  phpVersion: z.string().optional(),
  search: z.string().optional()
})

export const websiteExtensionsSchema = z.object({
  extensionIds: z.array(z.number().int().positive()).min(0)
})

export const websiteIdSchema = z.coerce.number().int().positive('Invalid website ID')

export type CreateWebsiteInput = z.output<typeof websiteCreateSchema>
export type UpdateWebsiteInput = z.output<typeof websiteUpdateSchema>
export type WebsiteQueryParams = z.output<typeof websiteQuerySchema>
export type WebsiteExtensionsInput = z.output<typeof websiteExtensionsSchema>
