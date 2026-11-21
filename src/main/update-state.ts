import type { UpdateState } from '../shared/types'

/** Manual fallback, always reachable even when the updater is broken. */
export const RELEASE_PAGE_URL = 'https://github.com/Aeternoxx/Multiview/releases'

export const IDLE_UPDATE_STATE: UpdateState = {
  phase: 'idle',
  version: '',
  percent: 0,
  releaseUrl: RELEASE_PAGE_URL,
  error: null
}

/** What the updater reports; kept as data so the machine below stays pure. */
export type UpdaterEvent =
  | { type: 'available'; version: string }
  | { type: 'unavailable' }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }

function cleanVersion(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/^v/i, '')
}

function cleanPercent(value: unknown): number {
  const percent = Number(value)
  if (!Number.isFinite(percent)) return 0

  return Math.min(100, Math.max(0, Math.round(percent)))
}

/**
 * Footer pill state machine. Pure and free of Electron on purpose: it decides
 * what the user sees. Three rules hold — an installer already on disk outranks
 * any later event, a failed check with nothing announced stays silent (that is
 * only being offline), and only the `downloaded` event offers the restart.
 */
export function nextUpdateState(current: UpdateState, event: UpdaterEvent): UpdateState {
  switch (event.type) {
    case 'available': {
      const version = cleanVersion(event.version)
      if (!version) return current

      return { ...current, phase: 'available', version, percent: 0, error: null }
    }
    case 'unavailable': {
      // A staged installer outranks a poll: only the user's click may clear it.
      if (current.phase === 'idle' || current.phase === 'ready') return current

      return { ...IDLE_UPDATE_STATE }
    }
    case 'progress': {
      if (current.phase === 'ready') return current

      const percent = cleanPercent(event.percent)
      // The first 0% tick still matters: it is what turns "available" into a
      // moving pill. Only a repeated percentage is worth ignoring.
      if (current.phase === 'downloading' && percent === current.percent) return current

      // 100% is not "installed": the checksum and the blockmap work follow, so
      // only the `downloaded` event may unlock the restart.
      return { ...current, phase: 'downloading', percent }
    }
    case 'downloaded': {
      return {
        ...current,
        phase: 'ready',
        version: cleanVersion(event.version) || current.version,
        percent: 100,
        error: null
      }
    }
    case 'error': {
      if (current.phase === 'ready') return current

      // Nothing was ever announced: a failed check only means "offline" or
      // "no release yet", and the user has nothing to act on. Stay quiet.
      if (!current.version) return current

      const message = typeof event.message === 'string' ? event.message.trim() : ''
      return { ...current, phase: 'error', error: message || 'update-failed' }
    }
  }
}
