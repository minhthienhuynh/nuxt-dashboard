import { DockerClient } from '@docker/node-sdk'

let _docker: DockerClient | null = null

export async function getDocker(): Promise<DockerClient> {
  if (!_docker) {
    _docker = await DockerClient.fromDockerConfig()
  }
  return _docker
}
