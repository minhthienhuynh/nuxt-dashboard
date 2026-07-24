// POSIX-style path helpers for remote SFTP paths — always forward-slash,
// regardless of the browser's OS, since the path lives on the remote host.

// Join a directory and a child name into a path.
export function joinSftpPath(dir: string, name: string): string {
  return dir === '/' ? `/${name}` : `${dir}/${name}`
}

// The parent of a path, or the path itself when already at the root.
export function parentSftpPath(path: string): string {
  if (path === '/') return '/'
  const idx = path.lastIndexOf('/')
  if (idx <= 0) return '/'
  return path.slice(0, idx)
}

// Breadcrumb segments from the root to `path`, each with its own full path.
export function sftpBreadcrumbs(path: string): { name: string, path: string }[] {
  const parts = path.split('/').filter(Boolean)
  const crumbs: { name: string, path: string }[] = [{ name: '/', path: '/' }]
  let acc = ''
  for (const part of parts) {
    acc += `/${part}`
    crumbs.push({ name: part, path: acc })
  }
  return crumbs
}
