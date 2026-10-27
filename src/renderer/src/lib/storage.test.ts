import { describe, expect, it } from 'vitest'
import { parseAudioMap, parseLanguage, parseStreams, parseTileSizes } from './storage'

describe('parseStreams', () => {
  it('returns an empty list for invalid JSON', () => {
    expect(parseStreams(null)).toEqual([])
    expect(parseStreams('not json')).toEqual([])
    expect(parseStreams('{"streams":[]}')).toEqual([])
  })

  it('migrates the legacy numeric ids to strings', () => {
    const raw = JSON.stringify([{ id: 1712345678901, name: 'Pote', url: 'https://a.test/whep' }])
    expect(parseStreams(raw)).toEqual([
      { id: '1712345678901', name: 'Pote', url: 'https://a.test/whep' }
    ])
  })

  it('drops invalid entries and duplicate ids', () => {
    const raw = JSON.stringify([
      { id: 'a', name: 'A', url: 'https://a.test/whep' },
      { id: 'a', name: 'A2', url: 'https://a2.test/whep' },
      { id: 'b', name: 'B', url: 'ftp://b.test/whep' },
      { id: 'c', name: 'C' },
      null
    ])

    expect(parseStreams(raw)).toEqual([{ id: 'a', name: 'A', url: 'https://a.test/whep' }])
  })

  it('falls back to a default name', () => {
    expect(
      parseStreams(JSON.stringify([{ id: 'x', name: '  ', url: 'https://x.test/whep' }]))
    ).toEqual([{ id: 'x', name: 'Flux', url: 'https://x.test/whep' }])
  })
})

describe('parseTileSizes', () => {
  it('keeps valid sizes and drops too-small or invalid ones', () => {
    const raw = JSON.stringify({
      a: { width: 640, height: 400 },
      b: { width: 100, height: 100 },
      c: { width: 'wide', height: 400 },
      d: null
    })

    expect(parseTileSizes(raw)).toEqual({ a: { width: 640, height: 400 } })
  })

  it('returns an empty object for invalid input', () => {
    expect(parseTileSizes('[]')).toEqual({})
    expect(parseTileSizes(null)).toEqual({})
  })
})

describe('parseAudioMap', () => {
  it('clamps the volume and normalizes muted', () => {
    const raw = JSON.stringify({
      a: { volume: 140, muted: true },
      b: { volume: -20, muted: 'yes' },
      c: { volume: 'loud' }
    })

    expect(parseAudioMap(raw)).toEqual({
      a: { volume: 100, muted: true },
      b: { volume: 0, muted: false }
    })
  })

  it('returns an empty map for invalid input', () => {
    expect(parseAudioMap('nope')).toEqual({})
  })
})

describe('parseLanguage', () => {
  it('accepts both raw and JSON-encoded values', () => {
    expect(parseLanguage('EN')).toBe('EN')
    expect(parseLanguage('"EN"')).toBe('EN')
    expect(parseLanguage('FR')).toBe('FR')
    expect(parseLanguage(null)).toBe('FR')
    expect(parseLanguage('unknown')).toBe('FR')
  })
})
