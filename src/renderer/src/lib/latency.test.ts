import { describe, expect, it } from 'vitest'
import {
  CATCH_UP_RATE,
  INITIAL_LATENCY_STATE,
  VIDEO_MIN_BUFFER_MS,
  VIDEO_SAFE_BUFFER_MS,
  bufferDeltaMs,
  nextLatencyState,
  nextPlaybackRate,
  type LatencyState
} from './latency'

function apply(state: LatencyState, samples: Array<number | null>): LatencyState {
  return samples.reduce(nextLatencyState, state)
}

describe('nextLatencyState', () => {
  it('keeps the minimum buffer on a clean network', () => {
    expect(apply(INITIAL_LATENCY_STATE, [5, 2, 8])).toEqual({
      targetMs: VIDEO_MIN_BUFFER_MS,
      highSamples: 0
    })
  })

  it('raises the target only after three consecutive high-jitter samples', () => {
    expect(apply(INITIAL_LATENCY_STATE, [60, 55])).toEqual({
      targetMs: VIDEO_MIN_BUFFER_MS,
      highSamples: 2
    })

    expect(apply(INITIAL_LATENCY_STATE, [60, 55, 80])).toEqual({
      targetMs: VIDEO_SAFE_BUFFER_MS,
      highSamples: 3
    })
  })

  it('does not raise the target on intermittent jitter', () => {
    expect(apply(INITIAL_LATENCY_STATE, [60, 10, 60, 10, 60])).toEqual({
      targetMs: VIDEO_MIN_BUFFER_MS,
      highSamples: 1
    })
  })

  it('goes back to the minimum once the network is calm', () => {
    const raised = apply(INITIAL_LATENCY_STATE, [60, 60, 60])
    expect(raised.targetMs).toBe(VIDEO_SAFE_BUFFER_MS)
    expect(nextLatencyState(raised, 3)).toEqual({
      targetMs: VIDEO_MIN_BUFFER_MS,
      highSamples: 0
    })
  })

  it('holds the current target in the middle band and ignores missing values', () => {
    const raised = apply(INITIAL_LATENCY_STATE, [60, 60, 60])
    expect(nextLatencyState(raised, 25)).toEqual({ targetMs: VIDEO_SAFE_BUFFER_MS, highSamples: 0 })
    expect(nextLatencyState(raised, null)).toBe(raised)
  })
})

describe('nextPlaybackRate', () => {
  it('speeds up only when too much media is buffered', () => {
    expect(nextPlaybackRate(0.8, 1)).toBe(CATCH_UP_RATE)
  })

  it('restores the normal rate once the backlog is drained', () => {
    expect(nextPlaybackRate(0.05, CATCH_UP_RATE)).toBe(1)
    expect(nextPlaybackRate(0, 1)).toBe(1)
  })

  it('keeps the current rate in the hysteresis band', () => {
    expect(nextPlaybackRate(0.25, 1)).toBe(1)
    expect(nextPlaybackRate(0.25, CATCH_UP_RATE)).toBe(CATCH_UP_RATE)
  })

  it('falls back to the normal rate on invalid input', () => {
    expect(nextPlaybackRate(Number.NaN, CATCH_UP_RATE)).toBe(1)
  })
})

describe('bufferDeltaMs', () => {
  it('needs a previous snapshot', () => {
    expect(bufferDeltaMs(null, { delaySeconds: 1, emittedCount: 30 })).toBeNull()
    expect(bufferDeltaMs({ delaySeconds: 0, emittedCount: 0 }, null)).toBeNull()
  })

  it('reports the average buffer time over the last interval', () => {
    expect(
      bufferDeltaMs({ delaySeconds: 0, emittedCount: 0 }, { delaySeconds: 2.4, emittedCount: 60 })
    ).toBe(40)
    expect(
      bufferDeltaMs(
        { delaySeconds: 10, emittedCount: 300 },
        { delaySeconds: 10.9, emittedCount: 330 }
      )
    ).toBe(30)
  })

  it('follows a drop back to the minimum instead of a lifetime average', () => {
    const before = bufferDeltaMs(
      { delaySeconds: 0, emittedCount: 0 },
      { delaySeconds: 4.8, emittedCount: 60 }
    )
    const after = bufferDeltaMs(
      { delaySeconds: 4.8, emittedCount: 60 },
      { delaySeconds: 4.86, emittedCount: 120 }
    )

    expect(before).toBe(80)
    expect(after).toBe(1)
  })

  it('ignores reset or stalled counters', () => {
    expect(
      bufferDeltaMs({ delaySeconds: 5, emittedCount: 100 }, { delaySeconds: 0.5, emittedCount: 3 })
    ).toBeNull()
    expect(
      bufferDeltaMs(
        { delaySeconds: 5, emittedCount: 100 },
        { delaySeconds: 5.2, emittedCount: 100 }
      )
    ).toBeNull()
  })
})
