import { z } from 'zod'

export const serviceEnvVarSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  isSecret: z.boolean().default(false)
})

export const servicePortSchema = z.object({
  hostPort: z.string().min(1),
  containerPort: z.string().min(1),
  protocol: z.enum(['tcp', 'udp']).default('tcp')
})

export const serviceVolumeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1)
})

export const createServiceSchema = z.object({
  serviceTypeKey: z.string().min(1),
  containerName: z.string().optional(),
  envVars: z.array(serviceEnvVarSchema).optional(),
  ports: z.array(servicePortSchema).optional(),
  volumes: z.array(serviceVolumeSchema).optional()
})

export const updateServiceSchema = z.object({
  containerName: z.string().optional(),
  envVars: z.array(serviceEnvVarSchema).optional(),
  ports: z.array(servicePortSchema).optional(),
  volumes: z.array(serviceVolumeSchema).optional(),
  enabled: z.boolean().optional()
})

export const serviceIdSchema = z.coerce.number().int().positive('Invalid service ID')

export type CreateServiceInput = z.output<typeof createServiceSchema>
export type UpdateServiceInput = z.output<typeof updateServiceSchema>
