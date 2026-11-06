import { app, net, shell } from 'electron'
import type { UpdateInfo } from '../shared/types'
import { parseLatestRelease, RELEASE_PAGE_URL } from './release'

const LATEST_RELEASE_URL = 'https://api.github.com/repos/Aeternoxx/Multiview/releases/latest'
const REQUEST_TIMEOUT_MS = 8_000

/** Result of the last successful check, used to open the right link on click. */
let lastUpdate: UpdateInfo | null = null

/** Looks for a newer published release. Never throws: offline means "no update". */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const response = await net.fetch(LATEST_RELEASE_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `MultiView/${app.getVersion()}`
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })

    if (!response.ok) return null

    lastUpdate = parseLatestRelease(await response.json(), app.getVersion())
    return lastUpdate
  } catch {
    return null
  }
}

/**
 * Opens the installer of the advertised update, or its release page when the
 * release ships no Windows setup. Nothing is downloaded or executed silently:
 * the file lands in the browser's download folder.
 */
export async function openUpdate(): Promise<void> {
  const target = lastUpdate?.downloadUrl ?? lastUpdate?.releaseUrl ?? RELEASE_PAGE_URL

  try {
    const { protocol } = new URL(target)
    if (protocol === 'https:') await shell.openExternal(target)
  } catch {
    // Ignore malformed URLs instead of handing them to the OS.
  }
}
