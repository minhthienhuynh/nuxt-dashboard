import type { InfrastructureService } from '~/types'

export function useMailpit() {
  const deploying = ref(false)
  const stopping = ref(false)

  async function deploy() {
    deploying.value = true
    try {
      const services = await $fetch<InfrastructureService[]>('/api/services')
      let mailpitSvc = services.find(s => s.serviceType?.key === 'mailpit')

      if (!mailpitSvc) {
        mailpitSvc = await $fetch('/api/services', {
          method: 'POST',
          body: {
            serviceTypeKey: 'mailpit',
            containerName: 'mailpit',
            ports: [
              { hostPort: '1025', containerPort: '1025', protocol: 'tcp' },
              { hostPort: '8025', containerPort: '8025', protocol: 'tcp' }
            ]
          }
        }) as unknown as InfrastructureService
      }

      if ((mailpitSvc as any).status !== 'running') {
        await $fetch(`/api/services/${mailpitSvc.id}/start`, { method: 'POST' })
      }
    } finally {
      deploying.value = false
    }
  }

  async function stop() {
    stopping.value = true
    try {
      const services = await $fetch<InfrastructureService[]>('/api/services')
      const mailpitSvc = services.find(s => s.serviceType?.key === 'mailpit')
      if (mailpitSvc) {
        await $fetch(`/api/services/${mailpitSvc.id}/stop`, { method: 'POST' })
      }
    } finally {
      stopping.value = false
    }
  }

  return { deploying, stopping, deploy, stop }
}
