import { describe, expect, it } from 'vitest'
import { parseLatestRelease, RELEASE_PAGE_URL } from './release'

const page = 'https://github.com/Aeternoxx/Multiview/releases/tag/v1.2.5'

function release(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tag_name: 'v1.2.5',
    html_url: page,
    draft: false,
    prerelease: false,
    assets: [
      {
        name: 'MultiView-1.2.5-portable.zip',
        browser_download_url: 'https://example.test/portable.zip'
      },
      {
        name: 'MultiView-1.2.5-setup.exe',
        browser_download_url: 'https://example.test/setup.exe'
      }
    ],
    ...overrides
  }
}

describe('parseLatestRelease', () => {
  it('reports a newer release with its installer', () => {
    expect(parseLatestRelease(release(), '1.2.4')).toEqual({
      version: '1.2.5',
      downloadUrl: 'https://example.test/setup.exe',
      releaseUrl: page
    })
  })

  it('falls back to the release page when no installer is attached', () => {
    expect(
      parseLatestRelease(
        release({ assets: [{ name: 'MultiView-1.2.5-portable.zip', browser_download_url: 'u' }] }),
        '1.2.4'
      )
    ).toEqual({ version: '1.2.5', downloadUrl: null, releaseUrl: page })

    expect(parseLatestRelease(release({ assets: 'nope' }), '1.2.4')?.downloadUrl).toBeNull()
  })

  it('ignores the current and older versions', () => {
    expect(parseLatestRelease(release(), '1.2.5')).toBeNull()
    expect(parseLatestRelease(release(), '1.3.0')).toBeNull()
    expect(parseLatestRelease(release({ tag_name: 'v1.2.4' }), '1.2.5')).toBeNull()
  })

  it('ignores drafts and pre-releases', () => {
    expect(parseLatestRelease(release({ draft: true }), '1.2.4')).toBeNull()
    expect(parseLatestRelease(release({ prerelease: true }), '1.2.4')).toBeNull()
  })

  it('falls back to the releases page when the payload has no URL', () => {
    const parsed = parseLatestRelease(release({ html_url: 'javascript:alert(1)' }), '1.2.4')
    expect(parsed?.releaseUrl).toBe(RELEASE_PAGE_URL)
  })

  it('rejects payloads that are not a release', () => {
    expect(parseLatestRelease(null, '1.2.4')).toBeNull()
    expect(parseLatestRelease('nope', '1.2.4')).toBeNull()
    expect(parseLatestRelease({}, '1.2.4')).toBeNull()
    expect(parseLatestRelease(release({ tag_name: 42 }), '1.2.4')).toBeNull()
  })
})
