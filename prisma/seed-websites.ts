import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })
})

async function main() {
  console.log('Seeding sample websites...')

  // Clear existing website data (extensions first due to FK)
  await prisma.websitePhpExtension.deleteMany()
  await prisma.website.deleteMany()

  // Get some PHP extensions for assignment
  const allExtensions = await prisma.phpExtension.findMany({
    take: 10,
    orderBy: { id: 'asc' }
  })

  const websites = [
    {
      name: 'Laravel Blog',
      domain: 'blog.test',
      port: 80,
      documentRoot: '/Users/thien/Sites/laravel-blog/public',
      phpVersion: '8.4',
      sslEnabled: false,
      status: 'running'
    },
    {
      name: 'WordPress Site',
      domain: 'wordpress.test',
      port: 443,
      documentRoot: '/Users/thien/Sites/wordpress',
      phpVersion: '8.3',
      sslEnabled: true,
      status: 'running'
    },
    {
      name: 'PHP Legacy App',
      domain: 'legacy.test',
      port: 8080,
      documentRoot: '/Users/thien/Sites/legacy-app',
      phpVersion: '7.4',
      sslEnabled: false,
      status: 'stopped'
    }
  ]

  for (const site of websites) {
    const website = await prisma.website.create({
      data: {
        name: site.name,
        domain: site.domain,
        port: site.port,
        documentRoot: site.documentRoot,
        phpVersion: site.phpVersion,
        sslEnabled: site.sslEnabled,
        status: site.status
      }
    })

    // Assign first 5 extensions to each website
    const extensionsToAssign = allExtensions.slice(0, 5)
    await prisma.websitePhpExtension.createMany({
      data: extensionsToAssign.map((ext) => ({
        websiteId: website.id,
        extensionId: ext.id,
        enabled: true
      }))
    })

    console.log(`  Created: ${site.name} (${site.domain}) with ${extensionsToAssign.length} extensions`)
  }

  console.log(`\nCreated ${websites.length} websites`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
