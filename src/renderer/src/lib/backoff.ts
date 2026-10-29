const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000]

export function retryDelay(attempt: number): number {
  const index = Math.min(Math.max(0, Math.floor(attempt)), RETRY_DELAYS_MS.length - 1)
  return RETRY_DELAYS_MS[index]
}

/**
 * How long a player keeps retrying after a stream drops (or after a failed
 * initial start) before it gives up and returns to the stopped state.
 */
export const RECONNECT_WINDOW_MS = 5 * 60_000
