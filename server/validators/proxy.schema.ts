import { z } from 'zod'

export const updateProxySchema = z.object({
  type: z.enum(['caddy']).optional(),
  httpPort: z.coerce.number().int().min(1).max(65535).optional(),
  httpsPort: z.coerce.number().int().min(1).max(65535).optional(),
  adminPort: z.coerce.number().int().min(1).max(65535).optional(),
  domain: z.string().min(1).optional()
})

export type UpdateProxyInput = z.output<typeof updateProxySchema>
