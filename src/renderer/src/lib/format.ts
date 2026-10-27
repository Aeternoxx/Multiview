export function formatBitrate(kbps: number | null): string {
  if (kbps === null || !Number.isFinite(kbps)) return '—'
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mb/s`
  return `${Math.round(kbps)} kb/s`
}

export function formatFps(fps: number | null): string {
  if (fps === null || !Number.isFinite(fps)) return '—'
  return `${Math.round(fps)} fps`
}

export function formatResolution(width: number | null, height: number | null): string {
  if (!width || !height) return '—'
  return `${width}×${height}`
}

export function formatCount(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString()
}

export function formatJitter(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—'
  return `${Math.round(ms)} ms`
}
