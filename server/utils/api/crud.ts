import { createError, eventHandler, getValidatedRouterParams, readValidatedBody } from 'h3'
import type { H3Event } from 'h3'
import { idParamSchema } from './schemas'

// Minimal repository shape the factory drives. `any` in arg positions lets the
// concrete (precisely typed) repositories satisfy it; precise types live at the
// repository layer.
interface CrudRepo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findMany: (args?: any) => Promise<any[]> | any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findById: (id: string) => Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (data: any) => Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (id: string, data: any) => Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remove: (id: string) => Promise<any>
}

interface CrudOptions {
  repo: CrudRepo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createSchema: { parse: (data: unknown) => any }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateSchema: { parse: (data: unknown) => any }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serialize?: (row: any) => any
  // Transform the validated body before it reaches the repo (e.g. encrypt secrets).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformInput?: (data: any) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listQuery?: (event: H3Event) => Promise<any[]> | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findOne?: (id: string, event: H3Event) => Promise<any>
}

// Build a `collection` handler (GET list / POST create on /api/<resource>) and
// an `item` handler (GET / PUT / DELETE on /api/<resource>/:id) from a repo,
// Zod schemas, and an optional response serializer.
//
// h3 v1 note: Nitro bundles h3 v1 at runtime, whose readValidatedBody/
// getValidatedRouterParams expect a validate *function*, not a Standard Schema
// object — so Zod schemas are wrapped as `data => schema.parse(data)`. A thrown
// ZodError is turned into a 400 by h3's validateData.
export function createCrudHandlers(opts: CrudOptions) {
  const out = (row: unknown) => (opts.serialize && row ? opts.serialize(row) : row)
  const transform = (data: unknown) => (opts.transformInput ? opts.transformInput(data) : data)

  const collection = eventHandler(async (event) => {
    if (event.method === 'POST') {
      const data = transform(await readValidatedBody(event, body => opts.createSchema.parse(body)))
      return out(await opts.repo.create(data))
    }
    const rows = (await opts.listQuery?.(event)) ?? (await opts.repo.findMany())
    return rows.map(out)
  })

  const item = eventHandler(async (event) => {
    const { id } = await getValidatedRouterParams(event, params => idParamSchema.parse(params))
    if (event.method === 'DELETE') return out(await opts.repo.remove(id))
    if (event.method === 'PUT') {
      const data = transform(await readValidatedBody(event, body => opts.updateSchema.parse(body)))
      return out(await opts.repo.update(id, data))
    }
    const row = (await opts.findOne?.(id, event)) ?? (await opts.repo.findById(id))
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    return out(row)
  })

  return { collection, item }
}
