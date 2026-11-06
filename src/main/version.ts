/** Splits `1.2.3` or `v1.2.3` into numeric parts, ignoring any suffix. */
function parseVersion(value: string): number[] | null {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/i.exec(value.trim())
  if (!match) return null

  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)]
}

/** True when `candidate` is a strictly newer release than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const next = parseVersion(candidate)
  const now = parseVersion(current)

  if (!next || !now) return false

  for (let index = 0; index < next.length; index += 1) {
    if (next[index] !== now[index]) return next[index] > now[index]
  }

  return false
}
