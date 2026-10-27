import { describe, expect, it } from 'vitest'
import { formatBitrate, formatCount, formatFps, formatJitter, formatResolution } from './format'

describe('format helpers', () => {
  it('formats the bitrate in kb/s or Mb/s', () => {
    expect(formatBitrate(850)).toBe('850 kb/s')
    expect(formatBitrate(4200)).toBe('4.2 Mb/s')
    expect(formatBitrate(null)).toBe('—')
  })

  it('formats fps, resolution, counts and jitter', () => {
    expect(formatFps(59.94)).toBe('60 fps')
    expect(formatResolution(1920, 1080)).toBe('1920×1080')
    expect(formatResolution(null, 1080)).toBe('—')
    expect(formatCount(1234)).not.toBe('—')
    expect(formatJitter(12.4)).toBe('12 ms')
    expect(formatJitter(null)).toBe('—')
  })
})
