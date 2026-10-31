/**
 * Playout tuning for low-latency WebRTC playback.
 *
 * The video jitter buffer target stays at its minimum so the glass-to-glass
 * latency is as low as possible. It is only raised when the network jitter is
 * measured high for several consecutive snapshots, which trades a little
 * latency for a stutter-free picture. The audio target is kept separate: an
 * audio buffer of 0 ms crackles, while it has no visible effect on latency.
 */

/** Minimum video buffer target (Chromium clamps it to its internal minimum). */
export const VIDEO_MIN_BUFFER_MS = 0
/** Safety target used while the network is jittery. */
export const VIDEO_SAFE_BUFFER_MS = 120
/** Audio target: low enough to stay in sync, high enough to avoid crackling. */
export const AUDIO_BUFFER_MS = 50

export const JITTER_HIGH_MS = 40
export const JITTER_LOW_MS = 15
export const HIGH_JITTER_SAMPLES = 3

export type LatencyState = {
  targetMs: number
  highSamples: number
}

export const INITIAL_LATENCY_STATE: LatencyState = {
  targetMs: VIDEO_MIN_BUFFER_MS,
  highSamples: 0
}

/**
 * Raises the target after three consecutive high-jitter snapshots and drops it
 * back to the minimum as soon as the network is calm again. Anything in
 * between keeps the current target, which avoids oscillating every snapshot.
 */
export function nextLatencyState(state: LatencyState, jitterMs: number | null): LatencyState {
  if (jitterMs === null || !Number.isFinite(jitterMs)) return state

  if (jitterMs >= JITTER_HIGH_MS) {
    const highSamples = Math.min(state.highSamples + 1, HIGH_JITTER_SAMPLES)
    return {
      targetMs: highSamples >= HIGH_JITTER_SAMPLES ? VIDEO_SAFE_BUFFER_MS : state.targetMs,
      highSamples
    }
  }

  if (jitterMs <= JITTER_LOW_MS) {
    return { targetMs: VIDEO_MIN_BUFFER_MS, highSamples: 0 }
  }

  return { targetMs: state.targetMs, highSamples: 0 }
}

/** Above this buffered lead the playback is sped up to drain the backlog. */
export const CATCH_UP_START_S = 0.4
/** Below this lead the normal rate is restored. */
export const CATCH_UP_STOP_S = 0.15
export const CATCH_UP_RATE = 1.06

/**
 * Keeps the accumulated latency bounded: when more than 400 ms of media is
 * buffered ahead of the playhead, playback runs 6% faster until the backlog is
 * drained. Pitch is preserved by the browser, and the speed-up is temporary.
 */
export function nextPlaybackRate(aheadSeconds: number, currentRate: number): number {
  if (!Number.isFinite(aheadSeconds)) return 1
  if (aheadSeconds > CATCH_UP_START_S) return CATCH_UP_RATE
  if (aheadSeconds < CATCH_UP_STOP_S) return 1
  return currentRate
}
