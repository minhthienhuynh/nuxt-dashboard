import { describe, expect, it } from 'vitest'
import { detectOs } from '../../server/utils/terminal/os-detect'

describe('detectOs', () => {
  it('reads the distro id from /etc/os-release', () => {
    const ubuntu = 'NAME="Ubuntu"\nID=ubuntu\nVERSION_ID="22.04"\nID_LIKE=debian\n'
    expect(detectOs(ubuntu)).toBe('ubuntu')
    expect(detectOs('ID=debian\nNAME="Debian"')).toBe('debian')
    expect(detectOs('ID="rhel"\nNAME="Red Hat"')).toBe('rhel')
  })

  it('maps redhat and opensuse variants', () => {
    expect(detectOs('ID=redhat')).toBe('rhel')
    expect(detectOs('ID=opensuse-leap\nVERSION_ID="15.5"')).toBe('opensuse')
  })

  it('falls back to generic linux for an unknown distro id', () => {
    expect(detectOs('ID=void\nNAME="Void"')).toBe('linux')
  })

  it('uses uname -s when there is no os-release', () => {
    expect(detectOs('Linux')).toBe('linux')
    expect(detectOs('Darwin')).toBe('macos')
    expect(detectOs('MINGW64_NT-10.0')).toBe('windows')
    expect(detectOs('FreeBSD')).toBe('other')
  })

  it('returns null for empty output so the stored OS is left untouched', () => {
    expect(detectOs('')).toBeNull()
    expect(detectOs('   \n')).toBeNull()
  })
})
