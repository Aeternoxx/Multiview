import { describe, expect, it } from 'vitest'
import { RECONNECT_WINDOW_MS, retryDelay } from './backoff'

describe('retryDelay', () => {
  it('follows an increasing backoff', () => {
    expect([0, 1, 2, 3, 4].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 15000])
  })

  it('caps the delay and ignores negative attempts', () => {
    expect(retryDelay(42)).toBe(15000)
    expect(retryDelay(-3)).toBe(1000)
    expect(retryDelay(2.7)).toBe(4000)
  })

  it('keeps retrying for a bounded amount of time', () => {
    expect(RECONNECT_WINDOW_MS).toBe(5 * 60_000)
  })
})
