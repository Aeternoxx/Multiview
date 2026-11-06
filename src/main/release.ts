import type { UpdateInfo } from '../shared/types'
import { isNewerVersion } from './version'

/** Used when the release payload has no usable page URL. */
export const RELEASE_PAGE_URL = 'https://github.com/Aeternoxx/Multiview/releases'

type ReleaseAsset = {
  name?: unknown
  browser_download_url?: unknown
}

/** Returns the Windows installer of the release, if it ships one. */
function findInstaller(assets: unknown): string | null {
  if (!Array.isArray(assets)) return null

  for (const asset of assets as ReleaseAsset[]) {
    const name = typeof asset?.name === 'string' ? asset.name.toLowerCase() : ''
    const url =
      typeof asset?.browser_download_url === 'string' ? asset.browser_download_url.trim() : ''

    if (url && name.endsWith('-setup.exe')) return url
  }

  return null
}

/**
 * Turns a GitHub "latest release" payload into the update to advertise, or
 * `null` when the running build is already up to date.
 */
export function parseLatestRelease(payload: unknown, currentVersion: string): UpdateInfo | null {
  if (!payload || typeof payload !== 'object') return null

  const release = payload as Record<string, unknown>
  if (release.draft === true || release.prerelease === true) return null

  const tag = typeof release.tag_name === 'string' ? release.tag_name.trim() : ''
  if (!isNewerVersion(tag, currentVersion)) return null

  const page = typeof release.html_url === 'string' ? release.html_url.trim() : ''
  const releaseUrl = page.startsWith('https://') ? page : RELEASE_PAGE_URL

  return {
    version: tag.replace(/^v/i, ''),
    downloadUrl: findInstaller(release.assets),
    releaseUrl
  }
}
