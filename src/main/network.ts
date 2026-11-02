import { session } from 'electron'
import { stripFetchMetadataHeaders } from './fetch-metadata'

/**
 * MediaMTX 1.20+ answers 403 to any POST labelled `Sec-Fetch-Site: cross-site`
 * or `same-site` unless the request carries an allowlisted `Origin` header
 * (`internal/protocols/httpp`, handlerOrigin). Loaded from `file://`, Chromium
 * labels every request cross-site and sends no `Origin` at all, so the server
 * rejects the offer before reading the SDP and no allowlist can ever match.
 *
 * Dropping the Fetch Metadata headers from our own outgoing requests keeps them
 * truthful — no forged origin — and lets WHEP endpoints answer normally.
 */
export function relaxFetchMetadata(): void {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      stripFetchMetadataHeaders(details.requestHeaders)
      callback({ requestHeaders: details.requestHeaders })
    }
  )
}
