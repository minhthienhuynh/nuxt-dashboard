import { createError, eventHandler, getQuery, sendStream, setResponseHeader } from 'h3'
import { connectSftp } from '~~/server/utils/terminal/sftp-connect'

// Remote path's last segment only — the path is never resolved against, or
// read from, the server's own filesystem; it is an opaque remote SFTP path.
function basename(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

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
  const stream = sftp.createReadStream(path)

  // Ends the SSH connection at most once, whether triggered by the response
  // socket closing normally or by the remote read failing mid-transfer.
  let ended = false
  const endClient = () => {
    if (ended) return
    ended = true
    client.end()
  }

  // Wait for the remote file to actually open before committing to a 200 with
  // a streamed body — an open failure (e.g. ENOENT) must surface as an error
  // status rather than a broken "successful" download.
  try {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        stream.removeListener('error', onError)
        resolve()
      }
      const onError = (err: Error) => {
        stream.removeListener('ready', onReady)
        reject(err)
      }
      stream.once('ready', onReady)
      stream.once('error', onError)
    })
  } catch (err) {
    endClient()
    throw createError({ statusCode: 404, statusMessage: (err as Error).message })
  }

  setResponseHeader(event, 'content-disposition', `attachment; filename="${encodeURIComponent(basename(path))}"`)
  setResponseHeader(event, 'content-type', 'application/octet-stream')
  event.node.res.on('close', endClient)
  // A read failure mid-transfer (dropped connection, permission change) would
  // otherwise leave the response hanging: Node's stream.pipe() (used inside
  // h3's sendStream) does not destroy its destination when the source errors,
  // so the response's own 'close' would never fire and the SSH connection
  // would leak. Destroying the response here forces that cleanup.
  stream.on('error', () => {
    if (!event.node.res.destroyed) event.node.res.destroy()
    endClient()
  })

  return sendStream(event, stream)
})
