import { describe, expect, it } from 'vitest'
import { IDLE_UPDATE_STATE, RELEASE_PAGE_URL, nextUpdateState } from './update-state'

const available = { ...IDLE_UPDATE_STATE, phase: 'available', version: '1.3.2' } as const

describe('nextUpdateState', () => {
  it('reports a newer release without a leading v', () => {
    expect(nextUpdateState(IDLE_UPDATE_STATE, { type: 'available', version: 'v1.3.2' })).toEqual({
      phase: 'available',
      version: '1.3.2',
      percent: 0,
      releaseUrl: RELEASE_PAGE_URL,
      error: null
    })
  })

  it('keeps the previous state when the release carries no version', () => {
    expect(nextUpdateState(IDLE_UPDATE_STATE, { type: 'available', version: '  ' })).toBe(
      IDLE_UPDATE_STATE
    )
  })

  it('follows the download as a clamped percentage', () => {
    const started = nextUpdateState(available, { type: 'progress', percent: 0.4 })
    expect(started).toMatchObject({ phase: 'downloading', percent: 0 })

    // A tick that does not move the needle must not produce a new state.
    expect(nextUpdateState(started, { type: 'progress', percent: 0.2 })).toBe(started)

    const middle = nextUpdateState(available, { type: 'progress', percent: 42.6 })
    expect(middle).toMatchObject({ phase: 'downloading', percent: 43 })

    expect(nextUpdateState(available, { type: 'progress', percent: 137 })).toMatchObject({
      phase: 'downloading',
      percent: 100
    })

    // Junk from the updater must not leak into the UI.
    expect(
      nextUpdateState(available, { type: 'progress', percent: 'nope' as unknown as number })
    ).toMatchObject({ phase: 'downloading', percent: 0 })
  })

  it('waits for the downloaded event before offering to restart', () => {
    expect(nextUpdateState(available, { type: 'progress', percent: 100 }).phase).toBe('downloading')
    expect(nextUpdateState(available, { type: 'downloaded', version: '1.3.2' })).toMatchObject({
      phase: 'ready',
      percent: 100,
      error: null
    })
  })

  it('ignores progress that arrives after the installer landed', () => {
    const ready = nextUpdateState(available, { type: 'downloaded', version: '1.3.2' })
    expect(nextUpdateState(ready, { type: 'progress', percent: 12 })).toBe(ready)
  })

  it('never lets an error hide a downloaded update', () => {
    const ready = nextUpdateState(available, { type: 'downloaded', version: '1.3.2' })
    expect(nextUpdateState(ready, { type: 'error', message: 'offline' })).toBe(ready)
  })

  it('keeps a known version on screen when the download fails', () => {
    const failed = nextUpdateState(available, { type: 'error', message: '  offline  ' })
    expect(failed).toMatchObject({ phase: 'error', version: '1.3.2', error: 'offline' })
  })

  it('says nothing when the first check fails: that is only being offline', () => {
    expect(nextUpdateState(IDLE_UPDATE_STATE, { type: 'error', message: 'offline' })).toBe(
      IDLE_UPDATE_STATE
    )
  })

  it('clears a stale update once a check finds nothing newer', () => {
    const failed = nextUpdateState(available, { type: 'error', message: 'offline' })
    expect(nextUpdateState(failed, { type: 'unavailable' })).toEqual(IDLE_UPDATE_STATE)
    expect(nextUpdateState(IDLE_UPDATE_STATE, { type: 'unavailable' })).toBe(IDLE_UPDATE_STATE)
  })

  it('never drops an installer that is already on disk', () => {
    const ready = nextUpdateState(available, { type: 'downloaded', version: '1.3.2' })
    expect(nextUpdateState(ready, { type: 'unavailable' })).toBe(ready)
  })
})
