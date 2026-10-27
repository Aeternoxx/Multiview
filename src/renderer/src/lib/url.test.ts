import { describe, expect, it } from 'vitest'
import type { Stream } from '@shared/types'
import { isDuplicateStreamUrl, normalizeStreamUrl } from './url'

const streams: Stream[] = [
  { id: 'a', name: 'A', url: 'https://example.com/a/whep' },
  { id: 'b', name: 'B', url: 'https://example.com/b/whep' }
]

describe('normalizeStreamUrl', () => {
  it('keeps a valid https URL', () => {
    expect(normalizeStreamUrl('https://example.com/cam/whep')).toBe('https://example.com/cam/whep')
  })

  it('adds https:// when the scheme is missing', () => {
    expect(normalizeStreamUrl('  example.com/cam/whep  ')).toBe('https://example.com/cam/whep')
  })

  it('keeps an explicit http URL', () => {
    expect(normalizeStreamUrl('http://192.168.1.20:8889/cam/whep')).toBe(
      'http://192.168.1.20:8889/cam/whep'
    )
  })

  it('rejects unsupported protocols', () => {
    expect(normalizeStreamUrl('ftp://example.com/stream')).toBeNull()
    expect(normalizeStreamUrl('file:///C:/stream/whep')).toBeNull()
  })

  it('rejects empty or malformed input', () => {
    expect(normalizeStreamUrl('   ')).toBeNull()
    expect(normalizeStreamUrl('https://')).toBeNull()
    expect(normalizeStreamUrl('not a url with spaces')).toBeNull()
  })
})

describe('isDuplicateStreamUrl', () => {
  it('detects an existing URL', () => {
    expect(isDuplicateStreamUrl(streams, 'https://example.com/a/whep')).toBe(true)
  })

  it('ignores unknown URLs', () => {
    expect(isDuplicateStreamUrl(streams, 'https://example.com/c/whep')).toBe(false)
  })
})
