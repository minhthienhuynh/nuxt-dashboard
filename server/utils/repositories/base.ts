// Generic CRUD factory over a Prisma model delegate. Per-aggregate repositories
// spread the result and add their own domain queries.
//
// The delegate constraint uses `any` in arg positions because Prisma's concrete
// delegate methods are heavily generic and do not satisfy a stricter structural
// type. Precise call-site types are recovered from the concrete `D` via
// `Parameters`/`ReturnType`, so callers still get the model's generated types.
type PrismaModelDelegate = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findMany: (args?: any) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findUnique: (args: any) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create: (args: any) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (args: any) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete: (args: any) => any
}

export function createRepository<D extends PrismaModelDelegate>(delegate: D) {
  type FindManyArgs = Parameters<D['findMany']>[0]
  type CreateData = Parameters<D['create']>[0] extends { data: infer Data } ? Data : never
  type UpdateData = Parameters<D['update']>[0] extends { data: infer Data } ? Data : never

  return {
    findMany: (args?: FindManyArgs) => delegate.findMany(args) as ReturnType<D['findMany']>,
    findById: (id: string) => delegate.findUnique({ where: { id } }) as ReturnType<D['findUnique']>,
    create: (data: CreateData) => delegate.create({ data }) as ReturnType<D['create']>,
    update: (id: string, data: UpdateData) =>
      delegate.update({ where: { id }, data }) as ReturnType<D['update']>,
    remove: (id: string) => delegate.delete({ where: { id } }) as ReturnType<D['delete']>
  }
}
