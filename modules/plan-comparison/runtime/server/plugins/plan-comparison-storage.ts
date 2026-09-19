import type { S3DriverOptions } from 'unstorage/drivers/s3'
import s3Driver from 'unstorage/drivers/s3'

const MOUNT = 'plan-comparison'

type S3Config = Partial<S3DriverOptions>

function readConfig(): S3Config {
  const runtime = useRuntimeConfig().planComparison?.s3 as S3Config | undefined
  return {
    bucket: runtime?.bucket || process.env.S3_BUCKET,
    endpoint: runtime?.endpoint || process.env.S3_ENDPOINT,
    region: runtime?.region || process.env.S3_REGION,
    accessKeyId: runtime?.accessKeyId || process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: runtime?.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY
  }
}

// The S3 mount is attached HERE, at runtime, instead of in nuxt.config `nitro.storage`.
// nitro.storage is resolved during `nuxt build`, so listing credentials there inlined
// them into .output/server/chunks/nitro/nitro.mjs (and made a secret-free build fail).
export default defineNitroPlugin(() => {
  const config = readConfig()
  const missing = (Object.keys(config) as (keyof S3Config)[])
    .filter(key => !config[key])
  if (missing.length > 0) {
    // No S3 credentials: leave the mount point unattached so the cache API degrades
    // to a cache miss instead of crashing the server at boot.
    console.warn(`[plan-comparison] S3 storage disabled, missing: ${missing.join(', ')}`)
    return
  }
  const storage = useStorage()
  try {
    if (storage.getMounts(MOUNT).length > 0) return
  } catch {
    // getMounts unavailable — fall through to mount (nitro dedupes via error below)
  }
  try {
    storage.mount(MOUNT, s3Driver(config as S3DriverOptions))
  } catch (error) {
    if (error instanceof Error && error.message.includes('already mounted')) return
    throw error
  }
})
