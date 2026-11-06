import { describe, expect, it } from 'vitest'
import { isNewerVersion } from './version'

describe('isNewerVersion', () => {
  it('detects a newer patch, minor or major release', () => {
    expect(isNewerVersion('1.2.5', '1.2.4')).toBe(true)
    expect(isNewerVersion('1.3.0', '1.2.9')).toBe(true)
    expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true)
  })

  it('ignores the release tag prefix', () => {
    expect(isNewerVersion('v1.2.5', '1.2.4')).toBe(true)
    expect(isNewerVersion('1.2.5', 'v1.2.4')).toBe(true)
  })

  it('rejects the current version and older ones', () => {
    expect(isNewerVersion('1.2.4', '1.2.4')).toBe(false)
    expect(isNewerVersion('1.2.3', '1.2.4')).toBe(false)
    expect(isNewerVersion('1.1.9', '1.2.0')).toBe(false)
  })

  it('treats a missing patch component as zero', () => {
    expect(isNewerVersion('1.3', '1.2.9')).toBe(true)
    expect(isNewerVersion('1.2', '1.2.0')).toBe(false)
  })

  it('rejects values that are not versions', () => {
    expect(isNewerVersion('latest', '1.2.4')).toBe(false)
    expect(isNewerVersion('1.2.5', 'unknown')).toBe(false)
    expect(isNewerVersion('', '')).toBe(false)
  })
})
