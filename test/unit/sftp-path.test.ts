import { describe, expect, it } from 'vitest'
import { joinSftpPath, parentSftpPath, sftpBreadcrumbs } from '../../layers/termius/app/utils/sftp-path'

describe('joinSftpPath', () => {
  it('joins a child name onto the root without doubling the slash', () => {
    expect(joinSftpPath('/', 'file.txt')).toBe('/file.txt')
  })

  it('joins a child name onto a non-root directory', () => {
    expect(joinSftpPath('/home/user', 'file.txt')).toBe('/home/user/file.txt')
  })
})

describe('parentSftpPath', () => {
  it('is a no-op at the root', () => {
    expect(parentSftpPath('/')).toBe('/')
  })

  it('returns the root for a direct child of the root', () => {
    expect(parentSftpPath('/home')).toBe('/')
  })

  it('returns the enclosing directory for a nested path', () => {
    expect(parentSftpPath('/home/user')).toBe('/home')
    expect(parentSftpPath('/home/user/docs')).toBe('/home/user')
  })

  it('falls back to the root for a path with no leading slash', () => {
    expect(parentSftpPath('home')).toBe('/')
  })
})

describe('sftpBreadcrumbs', () => {
  it('is just the root crumb for the root path', () => {
    expect(sftpBreadcrumbs('/')).toEqual([{ name: '/', path: '/' }])
  })

  it('builds one crumb per segment, each carrying its own full path', () => {
    expect(sftpBreadcrumbs('/home/user/docs')).toEqual([
      { name: '/', path: '/' },
      { name: 'home', path: '/home' },
      { name: 'user', path: '/home/user' },
      { name: 'docs', path: '/home/user/docs' }
    ])
  })

  it('collapses repeated slashes rather than emitting empty crumbs', () => {
    expect(sftpBreadcrumbs('/home//user')).toEqual([
      { name: '/', path: '/' },
      { name: 'home', path: '/home' },
      { name: 'user', path: '/home/user' }
    ])
  })
})
