export interface ServiceTypeDefaults {
  cmd?: string[]
  requiredEnv?: Record<string, string>
}

export const SERVICE_DEFAULTS: Record<string, ServiceTypeDefaults> = {
  minio: {
    cmd: ['server', '/data', '--console-address', ':8900'],
    requiredEnv: {
      MINIO_ROOT_USER: 'minioadmin',
      MINIO_ROOT_PASSWORD: 'minioadmin'
    }
  },
  rustfs: {
    requiredEnv: {
      RUSTFS_ACCESS_KEY: 'rustfs',
      RUSTFS_SECRET_KEY: 'rustfs-secret'
    }
  }
}
