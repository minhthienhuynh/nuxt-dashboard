import { createError, eventHandler, getQuery } from 'h3'
import { connectSftp } from '~~/server/utils/terminal/sftp-connect'

export default eventHandler(async (event) => {
  const { hostId, path } = getQuery(event)
  if (typeof hostId !== 'string' || !hostId || typeof path !== 'string' || !path) {
    throw createError({ statusCode: 400, statusMessage: 'hostId and path are required' })
  }

  let connected
  try {
    connected = await connectSftp(hostId)
  } catch (err) {
    const message = (err as Error).message
    throw createError({ statusCode: message === 'Unknown host' ? 404 : 502, statusMessage: message })
  }

  const { client, sftp } = connected
  // Remote path is an opaque path on the remote host, passed straight to
  // ssh2 — never resolved against, or written to, the server's own
  // filesystem. Pipe the unparsed request stream (raw Node IncomingMessage)
  // so large uploads never buffer fully in memory.
  const writeStream = sftp.createWriteStream(path)

  let cleanUpListener: (() => void) | undefined

  try {
    await new Promise<void>((resolve, reject) => {
      const onClientClose = () => {
        reject(new Error('Connection closed by client'))
      }
      event.node.res.on('close', onClientClose)
      cleanUpListener = () => {
        event.node.res.off('close', onClientClose)
      }

      writeStream.once('error', reject)
      writeStream.once('close', resolve)
      event.node.req.pipe(writeStream)
      event.node.req.once('error', reject)
    })
  } catch (err) {
    client.end()
    throw createError({ statusCode: 502, statusMessage: (err as Error).message })
  } finally {
    if (cleanUpListener) cleanUpListener()
  }

  client.end()
  return { ok: true }
})
