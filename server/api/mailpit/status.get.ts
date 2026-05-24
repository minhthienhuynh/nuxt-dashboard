import { getMailpitConnection, getMailpitDashboardUrl } from '~~/server/utilities/mailpit'
import { handleError } from '~~/server/utils/errors'

export default eventHandler(async () => {
  try {
    const conn = await getMailpitConnection()
    const dashboardUrl = await getMailpitDashboardUrl()
    return {
      running: !!conn,
      dashboardUrl,
      apiUrl: conn?.baseUrl || null,
      containerName: conn?.containerName || null
    }
  } catch (error) {
    throw handleError(error)
  }
})
