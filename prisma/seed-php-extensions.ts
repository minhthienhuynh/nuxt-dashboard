import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DATA_DIR = join(__dirname, 'data')

// Extension type classification — 161 extensions total.
// Source: analysis of install-php-extensions script behavior.
const BUNDLED = new Set([
  'bcmath', 'bz2', 'calendar', 'dba', 'enchant', 'exif', 'ffi', 'ftp',
  'gd', 'gettext', 'gmp', 'imap', 'interbase', 'intl', 'json_post',
  'ldap', 'mssql', 'mysql', 'mysqli', 'odbc', 'oci8', 'opcache',
  'pcntl', 'pdo_dblib', 'pdo_firebird', 'pdo_mysql', 'pdo_oci',
  'pdo_odbc', 'pdo_pgsql', 'pdo_snowflake', 'pgsql', 'pspell',
  'recode', 'shmop', 'snmp', 'soap', 'sockets', 'sodium',
  'sybase_ct', 'sysvmsg', 'sysvsem', 'sysvshm', 'tidy', 'wddx',
  'xmlrpc', 'xsl', 'zip'
])

const VENDOR = new Set([
  'blackfire', 'ddtrace', 'ioncube_loader', 'newrelic', 'relay',
  'sourceguardian'
])

const CUSTOM = new Set([
  'cassandra', 'openswoole', 'phpy'
])

function getType(name: string): string {
  if (BUNDLED.has(name)) return 'bundled'
  if (VENDOR.has(name)) return 'vendor'
  if (CUSTOM.has(name)) return 'custom'
  return 'pecl'
}

function parseSupportedExtensions(filePath: string): Map<string, string[]> {
  const content = readFileSync(filePath, 'utf-8')
  const map = new Map<string, string[]>()
  for (const line of content.trim().split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split(/\s+/)
    const name = parts[0]
    const versions = parts.slice(1)
    map.set(name, versions)
  }
  return map
}

function parseSpecialRequirements(filePath: string): Map<string, string[]> {
  const content = readFileSync(filePath, 'utf-8')
  const map = new Map<string, string[]>()
  for (const line of content.trim().split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split(/\s+/)
    const name = parts[0]
    const reqs = parts.slice(1)
    map.set(name, reqs)
  }
  return map
}

async function main() {
  const extensionsFile = join(DATA_DIR, 'supported-extensions')
  const requirementsFile = join(DATA_DIR, 'special-requirements')

  const extMap = parseSupportedExtensions(extensionsFile)
  const reqMap = parseSpecialRequirements(requirementsFile)

  // Clear existing data in dependency order
  await prisma.specialRequirement.deleteMany()
  await prisma.phpVersionSupport.deleteMany()
  await prisma.phpExtension.deleteMany()

  let totalVersions = 0
  let totalSpecials = 0

  for (const [name, phpVersions] of extMap) {
    const type = getType(name)
    const extension = await prisma.phpExtension.create({
      data: { name, type }
    })

    // Insert PHP version supports
    for (const phpVersion of phpVersions) {
      await prisma.phpVersionSupport.create({
        data: { extensionId: extension.id, phpVersion }
      })
      totalVersions++
    }

    // Insert special requirements if any
    const reqs = reqMap.get(name)
    if (reqs) {
      for (const requirement of reqs) {
        await prisma.specialRequirement.create({
          data: { extensionId: extension.id, requirement }
        })
        totalSpecials++
      }
    }
  }

  console.log(
    `Seeded ${extMap.size} PHP extensions, ${totalVersions} version supports, ${totalSpecials} special requirements`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
