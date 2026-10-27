export type Availability = 'checking' | 'online' | 'offline'

const states = new Map<string, Availability>()
const listeners = new Set<() => void>()

/** Availability is shared per stream URL so the toolbar can read it too. */
export function getAvailability(url: string): Availability {
  return states.get(url) ?? 'checking'
}

export function setAvailability(url: string, value: Availability): void {
  if (states.get(url) === value) return

  states.set(url, value)
  for (const listener of [...listeners]) listener()
}

export function subscribeAvailability(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
