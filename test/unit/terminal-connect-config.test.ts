import { describe, expect, it } from 'vitest'
import { buildConnectConfig } from '../../server/utils/terminal/connect-config'

const host = { address: '10.0.0.5', port: 22 }

describe('buildConnectConfig', () => {
  it('builds password auth from a password identity', () => {
    const cfg = buildConnectConfig(host, { username: 'root', authType: 'password' }, { password: 'pw' })
    expect(cfg).toMatchObject({ host: '10.0.0.5', port: 22, username: 'root', password: 'pw' })
    expect(cfg).not.toHaveProperty('privateKey')
  })

  it('builds key auth from a key identity (with passphrase)', () => {
    const cfg = buildConnectConfig(host, { username: 'deploy', authType: 'key' }, { privateKey: 'KEY', passphrase: 'PP' })
    expect(cfg).toMatchObject({ username: 'deploy', privateKey: 'KEY', passphrase: 'PP' })
    expect(cfg).not.toHaveProperty('password')
  })

  it('omits passphrase when not provided', () => {
    const cfg = buildConnectConfig(host, { username: 'deploy', authType: 'key' }, { privateKey: 'KEY' })
    expect(cfg).not.toHaveProperty('passphrase')
  })

  it('throws when identity is missing', () => {
    expect(() => buildConnectConfig(host, null, {})).toThrow()
  })

  it('throws when a password identity has no password', () => {
    expect(() => buildConnectConfig(host, { username: 'root', authType: 'password' }, {})).toThrow()
  })

  it('throws when a key identity has no private key', () => {
    expect(() => buildConnectConfig(host, { username: 'deploy', authType: 'key' }, {})).toThrow()
  })
})
