import { describe, expect, it } from 'vitest'
import { DEFAULT_ICE_CONFIG, parseIceConfig, sanitizeIceConfig, toIceServers } from './ice'

describe('toIceServers', () => {
  it('returns an empty list for an empty configuration', () => {
    expect(toIceServers(DEFAULT_ICE_CONFIG)).toEqual([])
  })

  it('splits several STUN urls', () => {
    expect(
      toIceServers({ ...DEFAULT_ICE_CONFIG, stun: 'stun:a.test:3478, stun:b.test:3478' })
    ).toEqual([{ urls: ['stun:a.test:3478', 'stun:b.test:3478'] }])
  })

  it('adds TURN credentials when provided', () => {
    expect(
      toIceServers({
        stun: '',
        turn: 'turn:turn.test:3478',
        username: 'user',
        password: 'secret'
      })
    ).toEqual([{ urls: ['turn:turn.test:3478'], username: 'user', credential: 'secret' }])
  })
})

describe('sanitizeIceConfig', () => {
  it('always returns strings', () => {
    expect(sanitizeIceConfig({ stun: ' stun:a.test ', turn: undefined })).toEqual({
      stun: 'stun:a.test',
      turn: '',
      username: '',
      password: ''
    })

    expect(sanitizeIceConfig(null)).toEqual(DEFAULT_ICE_CONFIG)
  })
})

describe('parseIceConfig', () => {
  it('falls back to the defaults for invalid input', () => {
    expect(parseIceConfig(null)).toEqual(DEFAULT_ICE_CONFIG)
    expect(parseIceConfig('{oops')).toEqual(DEFAULT_ICE_CONFIG)
    expect(parseIceConfig('[1,2]')).toEqual(DEFAULT_ICE_CONFIG)
  })

  it('reads a persisted configuration', () => {
    const raw = JSON.stringify({ stun: 'stun:a.test', turn: '', username: '', password: '' })
    expect(parseIceConfig(raw)).toEqual({
      stun: 'stun:a.test',
      turn: '',
      username: '',
      password: ''
    })
  })
})
