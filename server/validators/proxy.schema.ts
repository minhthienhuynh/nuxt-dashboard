import { z } from 'zod'

export const updateProxySchema = z.object({
  type: z.enum(['caddy']).optional(),
  httpPort: z.coerce.number().int().min(1).max(65535).optional(),
  httpsPort: z.coerce.number().int().min(1).max(65535).optional(),
  adminPort: z.coerce.number().int().min(1).max(65535).optional(),
  domain: z.string().min(1).optional()
})

export const updateCaddyfileSchema = z.object({
  content: z.string().min(1, 'Caddyfile content is required')
})

export type UpdateCaddyfileInput = z.output<typeof updateCaddyfileSchema>
export type UpdateProxyInput = z.output<typeof updateProxySchema>
