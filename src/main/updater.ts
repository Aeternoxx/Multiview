import { app, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '../shared/types'
import {
  IDLE_UPDATE_STATE,
  RELEASE_PAGE_URL,
  nextUpdateState,
  type UpdaterEvent
} from './update-state'

const GITHUB_OWNER = 'Aeternoxx'
const GITHUB_REPO = 'Multiview'
/** GitHub allows 60 anonymous requests per hour: a slow poll is plenty. */
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

/**
 * Only the packaged Windows build can update itself: electron-updater needs the
 * NSIS install, the mac builds are neither signed nor notarised, and `npm run
 * dev` has nothing to update. Those builds keep the release page link.
 */
export function isAutoUpdateSupported(): boolean {
  return app.isPackaged && process.platform === 'win32'
}

let state: UpdateState = { ...IDLE_UPDATE_STATE }
let recheckTimer: NodeJS.Timeout | null = null

/** Applies an updater event and broadcasts the new state to the main window. */
function publish(broadcast: (state: UpdateState) => void, event: UpdaterEvent): void {
  const next = nextUpdateState(state, event)
  if (next === state) return

  state = next
  broadcast(state)
}

/**
 * Wires electron-updater to the UI. Downloads start on their own — installing
 * never does: that stays a click on the footer pill.
 */
export function initAutoUpdater(broadcast: (state: UpdateState) => void): void {
  if (!isAutoUpdateSupported()) return

  autoUpdater.setFeedURL({ provider: 'github', owner: GITHUB_OWNER, repo: GITHUB_REPO })
  // Pull the bytes as soon as a release is found...
  autoUpdater.autoDownload = true
  // ...but never let it install on its own when the app quits.
  autoUpdater.autoInstallOnAppQuit = false
  // A web installer would verify nothing; take the real package.
  autoUpdater.disableWebInstaller = true

  autoUpdater.on('update-available', (info) =>
    publish(broadcast, { type: 'available', version: info.version })
  )
  autoUpdater.on('update-not-available', () => publish(broadcast, { type: 'unavailable' }))
  autoUpdater.on('download-progress', (info) =>
    publish(broadcast, { type: 'progress', percent: info.percent })
  )
  autoUpdater.on('update-downloaded', (info) =>
    publish(broadcast, { type: 'downloaded', version: info.version })
  )
  autoUpdater.on('error', (error) =>
    publish(broadcast, {
      type: 'error',
      message: error instanceof Error ? error.message : String(error)
    })
  )

  void checkForUpdate()

  if (!recheckTimer) recheckTimer = setInterval(() => void checkForUpdate(), RECHECK_INTERVAL_MS)
}

export function stopAutoUpdater(): void {
  if (!recheckTimer) return

  clearInterval(recheckTimer)
  recheckTimer = null
}

/**
 * Reads the published release. `null` means this build cannot auto-update, so
 * the UI must not show an update pill at all. Never throws: offline simply
 * means "nothing to report".
 */
export async function checkForUpdate(): Promise<UpdateState | null> {
  if (!isAutoUpdateSupported()) return null

  try {
    // electron-updater reuses the promise of a check already in flight, so the
    // start-up poll and the renderer mounting cannot double-request GitHub.
    await autoUpdater.checkForUpdates()
  } catch {
    // The `error` event has already been forwarded.
  }

  return { ...state }
}

/** Hands the downloaded installer to NSIS, then the app restarts on its own. */
export function installUpdate(): void {
  if (state.phase !== 'ready') return

  // Silent install, forced relaunch: the pill is the only confirmation asked.
  autoUpdater.quitAndInstall(true, true)
}

/** Opens the release page: the fallback whenever the updater is not the answer. */
export async function openReleasePage(): Promise<void> {
  try {
    const { protocol } = new URL(state.releaseUrl || RELEASE_PAGE_URL)
    if (protocol === 'https:') await shell.openExternal(state.releaseUrl || RELEASE_PAGE_URL)
  } catch {
    // Ignore malformed URLs instead of handing them to the OS.
  }
}
