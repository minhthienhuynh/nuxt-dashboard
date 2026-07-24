import { describe, expect, it } from 'vitest'
import { formatSftpSize } from '../../layers/termius/app/utils/sftp-format'

describe('formatSftpSize', () => {
  it('formats sub-KB sizes as whole bytes', () => {
    expect(formatSftpSize(0)).toBe('0 B')
    expect(formatSftpSize(1023)).toBe('1023 B')
  })

  it('formats KB with one decimal', () => {
    expect(formatSftpSize(1024)).toBe('1.0 KB')
    expect(formatSftpSize(1536)).toBe('1.5 KB')
  })

  it('formats MB, GB and TB by repeated division', () => {
    expect(formatSftpSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatSftpSize(1024 * 1024 * 1024)).toBe('1.0 GB')
    expect(formatSftpSize(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB')
  })

  it('stays at TB instead of overflowing to a further unit', () => {
    expect(formatSftpSize(1024 * 1024 * 1024 * 1024 * 1024)).toBe('1024.0 TB')
  })
})
