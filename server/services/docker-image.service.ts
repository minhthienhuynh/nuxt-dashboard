import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { getDocker } from '../utils/docker'
import { AppError } from '../utils/errors'
import { getWebsiteTypeConfig, imageTagForType, DEFAULT_WEBSITE_TYPE } from '../utils/website-types'
import type { Website, WebsitePhpExtension } from '~/types'

export const DockerImageService = {
  async pullImage(image: string): Promise<void> {
    const docker = await getDocker()
    const [fromImage, tag = 'latest'] = image.split(':')
    await docker.imageCreate({ fromImage, tag })
  },

  computeBuildHash(type: string, phpVersion: string, extensionNames: string[], documentRoot: string): string {
    const sorted = [...extensionNames].sort()
    const dirName = path.basename(documentRoot)
    return createHash('sha256').update(`${type}:${phpVersion}:${sorted.join(',')}:${dirName}`).digest('hex')
  },

  buildPhpImage(website: Website): string {
    const type = website.type || DEFAULT_WEBSITE_TYPE
    const config = getWebsiteTypeConfig(type)
    const phpTag = config.phpTag(website.phpVersion)
    const imageTag = imageTagForType(website.name, website.phpVersion, type)
    const dirName = path.basename(website.documentRoot)

    const extensionNames = website.extensions
      ?.filter((e: WebsitePhpExtension) => e.enabled)
      .map((e: WebsitePhpExtension) => e.extension!.name) ?? []

    const buildArgs: string[] = [
      `PHP_TAG=${phpTag}`,
      `WORKDIR=/var/www/${dirName}`,
      `SUPERVISOR_PHP_COMMAND=${config.supervisorCommand(dirName)}`,
      `SUPERVISOR_PHP_USER=${config.supervisorUser}`,
      'COMPOSER_VERSION=2',
      'NODE_VERSION=22',
      'WWWGROUP=${WWWGROUP:-1000}',
      `PHP_EXTENSIONS=${extensionNames.join(' ')}`
    ]

    const context = path.resolve(process.cwd(), 'docker/php')
    const args = [
      'build',
      ...buildArgs.flatMap(arg => ['--build-arg', arg]),
      '-t',
      imageTag,
      context
    ]

    try {
      execSync(`docker ${args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ')}`, {
        stdio: 'pipe'
      })
    } catch (error) {
      throw new AppError(`Failed to build PHP image: ${error instanceof Error ? error.message : String(error)}`, 500)
    }

    return imageTag
  },

  needRebuild(website: Website): boolean {
    const type = website.type || DEFAULT_WEBSITE_TYPE
    const extensionNames = website.extensions
      ?.filter((e: WebsitePhpExtension) => e.enabled)
      .map((e: WebsitePhpExtension) => e.extension!.name) ?? []

    const newHash = DockerImageService.computeBuildHash(type, website.phpVersion, extensionNames, website.documentRoot)
    return website.buildHash !== newHash
  }
}
