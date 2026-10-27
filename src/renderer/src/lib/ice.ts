export type IceConfig = {
  stun: string
  turn: string
  username: string
  password: string
}

export const DEFAULT_ICE_CONFIG: IceConfig = {
  stun: '',
  turn: '',
  username: '',
  password: ''
}

function splitUrls(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function sanitizeIceConfig(value: Partial<IceConfig> | null | undefined): IceConfig {
  return {
    stun: typeof value?.stun === 'string' ? value.stun.trim() : '',
    turn: typeof value?.turn === 'string' ? value.turn.trim() : '',
    username: typeof value?.username === 'string' ? value.username.trim() : '',
    password: typeof value?.password === 'string' ? value.password : ''
  }
}

export function parseIceConfig(raw: string | null): IceConfig {
  if (!raw) return { ...DEFAULT_ICE_CONFIG }

  try {
    return sanitizeIceConfig(JSON.parse(raw) as Partial<IceConfig>)
  } catch {
    return { ...DEFAULT_ICE_CONFIG }
  }
}

/** Empty configuration keeps the previous behaviour: host candidates only. */
export function toIceServers(config: IceConfig): RTCIceServer[] {
  const servers: RTCIceServer[] = []

  const stunUrls = splitUrls(config.stun)
  if (stunUrls.length > 0) servers.push({ urls: stunUrls })

  const turnUrls = splitUrls(config.turn)
  if (turnUrls.length > 0) {
    servers.push({
      urls: turnUrls,
      username: config.username || undefined,
      credential: config.password || undefined
    })
  }

  return servers
}
