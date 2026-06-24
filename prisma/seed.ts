// Minimal development seed: a few groups/hosts/tags so the dashboard has data
// to render and so cascade/relation behavior can be inspected locally.
// Run with `pnpm db:seed`. Idempotent: skips when hosts already exist.
import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from './generated/client'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  if ((await prisma.host.count()) > 0) {
    console.log('Seed skipped: database already has hosts.')
    return
  }

  const production = await prisma.tag.create({ data: { name: 'production' } })
  const web = await prisma.tag.create({ data: { name: 'web' } })

  const group = await prisma.group.create({ data: { name: 'Production' } })

  const identity = await prisma.identity.create({
    data: { label: 'deploy', username: 'deploy', authType: 'key' }
  })

  await prisma.host.create({
    data: {
      label: 'web-1',
      address: '10.0.0.11',
      port: 22,
      os: 'linux',
      groupId: group.id,
      identityId: identity.id,
      tags: { create: [{ tagId: production.id }, { tagId: web.id }] }
    }
  })

  await prisma.host.create({
    data: {
      label: 'db-1',
      address: '10.0.0.21',
      os: 'linux',
      groupId: group.id,
      identityId: identity.id,
      tags: { create: [{ tagId: production.id }] }
    }
  })

  console.log('Seed complete: 1 group, 1 identity, 2 tags, 2 hosts.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
