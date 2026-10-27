const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000]

export function retryDelay(attempt: number): number {
  const index = Math.min(Math.max(0, Math.floor(attempt)), RETRY_DELAYS_MS.length - 1)
  return RETRY_DELAYS_MS[index]
}

export const MAX_CONNECT_ATTEMPTS = 8
