const FETCH_METADATA_PREFIX = 'sec-fetch-'

/**
 * Removes the `Sec-Fetch-*` headers from a request, in place, and reports
 * whether anything was removed.
 *
 * Chromium computes those headers from the document that starts the request.
 * The renderer of the packaged app is loaded from `file://`, an opaque origin,
 * so every WHEP request goes out as `Sec-Fetch-Site: cross-site` without an
 * `Origin` header, which servers protected by a Fetch Metadata anti-CSRF rule
 * reject before even reading the SDP.
 */
export function stripFetchMetadataHeaders(headers: Record<string, string>): boolean {
  let removed = false

  for (const name of Object.keys(headers)) {
    if (name.toLowerCase().startsWith(FETCH_METADATA_PREFIX)) {
      delete headers[name]
      removed = true
    }
  }

  return removed
}
