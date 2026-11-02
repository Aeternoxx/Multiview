import { describe, expect, it } from 'vitest'
import { stripFetchMetadataHeaders } from './fetch-metadata'

describe('stripFetchMetadataHeaders', () => {
  it('removes every Sec-Fetch-* header whatever the casing', () => {
    const headers: Record<string, string> = {
      'Sec-Fetch-Site': 'cross-site',
      'sec-fetch-mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'Content-Type': 'application/sdp',
      Accept: 'application/sdp'
    }

    expect(stripFetchMetadataHeaders(headers)).toBe(true)
    expect(headers).toEqual({
      'Content-Type': 'application/sdp',
      Accept: 'application/sdp'
    })
  })

  it('leaves a request without Fetch Metadata untouched', () => {
    const headers: Record<string, string> = { Accept: 'application/sdp' }

    expect(stripFetchMetadataHeaders(headers)).toBe(false)
    expect(headers).toEqual({ Accept: 'application/sdp' })
  })
})
