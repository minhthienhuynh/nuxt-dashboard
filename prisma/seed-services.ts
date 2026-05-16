import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })
})

const SERVICE_TYPES = [
  // Database
  { key: 'mysql', name: 'MySQL 8.4', category: 'database', defaultImage: 'mysql:8.4', defaultPorts: JSON.stringify([{ hostPort: '${FORWARD_DB_PORT:-3306}', containerPort: '3306' }]), hasHealthcheck: true, hasPersistence: true },
  { key: 'mariadb', name: 'MariaDB 11', category: 'database', defaultImage: 'mariadb:11', defaultPorts: JSON.stringify([{ hostPort: '${FORWARD_DB_PORT:-3306}', containerPort: '3306' }]), hasHealthcheck: true, hasPersistence: true },
  { key: 'pgsql', name: 'PostgreSQL 18', category: 'database', defaultImage: 'postgres:18-alpine', defaultPorts: JSON.stringify([{ hostPort: '${FORWARD_DB_PORT:-5432}', containerPort: '5432' }]), hasHealthcheck: true, hasPersistence: true },
  { key: 'mongodb', name: 'MongoDB Atlas Local', category: 'database', defaultImage: 'mongodb/mongodb-atlas-local:latest', defaultPorts: JSON.stringify([{ hostPort: '${FORWARD_MONGODB_PORT:-27017}', containerPort: '27017' }]), hasHealthcheck: true, hasPersistence: true },
  // Cache
  { key: 'redis', name: 'Redis', category: 'cache', defaultImage: 'redis:alpine', defaultPorts: JSON.stringify([{ hostPort: '${FORWARD_REDIS_PORT:-6379}', containerPort: '6379' }]), hasHealthcheck: true, hasPersistence: true },
  { key: 'valkey', name: 'Valkey', category: 'cache', defaultImage: 'valkey/valkey:alpine', defaultPorts: JSON.stringify([{ hostPort: '${FORWARD_VALKEY_PORT:-6379}', containerPort: '6379' }]), hasHealthcheck: true, hasPersistence: true },
  { key: 'memcached', name: 'Memcached', category: 'cache', defaultImage: 'memcached:alpine', defaultPorts: JSON.stringify([{ hostPort: '${FORWARD_MEMCACHED_PORT:-11211}', containerPort: '11211' }]), hasHealthcheck: false, hasPersistence: false },
  // Search
  { key: 'meilisearch', name: 'Meilisearch', category: 'search', defaultImage: 'getmeili/meilisearch:latest', defaultPorts: JSON.stringify([{ hostPort: '${FORWARD_MEILISEARCH_PORT:-7700}', containerPort: '7700' }]), hasHealthcheck: true, hasPersistence: true },
  { key: 'typesense', name: 'Typesense 27.1', category: 'search', defaultImage: 'typesense/typesense:27.1', defaultPorts: JSON.stringify([{ hostPort: '${FORWARD_TYPESENSE_PORT:-8108}', containerPort: '8108' }]), hasHealthcheck: true, hasPersistence: true },
  // Mail
  { key: 'mailpit', name: 'Mailpit', category: 'mail', defaultImage: 'axllent/mailpit:latest', defaultPorts: JSON.stringify([{ hostPort: '${FORWARD_MAILPIT_PORT:-1025}', containerPort: '1025' }, { hostPort: '${FORWARD_MAILPIT_DASHBOARD_PORT:-8025}', containerPort: '8025' }]), hasHealthcheck: false, hasPersistence: false },
  // Storage
  { key: 'minio', name: 'MinIO', category: 'storage', defaultImage: 'minio/minio:latest', defaultPorts: JSON.stringify([{ hostPort: '${FORWARD_MINIO_PORT:-9000}', containerPort: '9000' }, { hostPort: '${FORWARD_MINIO_CONSOLE_PORT:-8900}', containerPort: '8900' }]), hasHealthcheck: true, hasPersistence: true },
  { key: 'rustfs', name: 'RustFS', category: 'storage', defaultImage: 'rustfs/rustfs:latest', defaultPorts: JSON.stringify([{ hostPort: '${FORWARD_RUSTFS_PORT:-9000}', containerPort: '9000' }, { hostPort: '${FORWARD_RUSTFS_CONSOLE_PORT:-9001}', containerPort: '9001' }]), hasHealthcheck: true, hasPersistence: true },
  // Queue
  { key: 'rabbitmq', name: 'RabbitMQ 4', category: 'queue', defaultImage: 'rabbitmq:4-management-alpine', defaultPorts: JSON.stringify([{ hostPort: '${FORWARD_RABBITMQ_PORT:-5672}', containerPort: '5672' }, { hostPort: '${FORWARD_RABBITMQ_DASHBOARD_PORT:-15672}', containerPort: '15672' }]), hasHealthcheck: true, hasPersistence: true },
  // WebSocket
  { key: 'soketi', name: 'Soketi', category: 'websocket', defaultImage: 'quay.io/soketi/soketi:latest-16-alpine', defaultPorts: JSON.stringify([{ hostPort: '${PUSHER_PORT:-6001}', containerPort: '6001' }, { hostPort: '${PUSHER_METRICS_PORT:-9601}', containerPort: '9601' }]), hasHealthcheck: false, hasPersistence: false },
  // Testing
  { key: 'selenium', name: 'Selenium', category: 'testing', defaultImage: 'selenium/standalone-chromium', defaultPorts: JSON.stringify([]), hasHealthcheck: false, hasPersistence: false }
]

async function main() {
  console.log('Seeding service types...')

  // Clear existing
  await prisma.serviceEnvVar.deleteMany()
  await prisma.servicePort.deleteMany()
  await prisma.serviceVolume.deleteMany()
  await prisma.infrastructureService.deleteMany()
  await prisma.serviceType.deleteMany()
  await prisma.proxyConfig.deleteMany()

  // Seed service types
  for (const type of SERVICE_TYPES) {
    await prisma.serviceType.create({ data: type })
  }
  console.log(`  Created ${SERVICE_TYPES.length} service types`)

  // Seed default proxy config
  await prisma.proxyConfig.create({
    data: { type: 'caddy', httpPort: 80, httpsPort: 443, adminPort: 8080, domain: '*.test' }
  })
  console.log('  Created default proxy config (caddy)')

  console.log('\nSeed complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
