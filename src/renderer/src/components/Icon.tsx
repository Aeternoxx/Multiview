type IconName =
  | 'play'
  | 'stop'
  | 'edit'
  | 'detach'
  | 'trash'
  | 'fullscreen'
  | 'exitFullscreen'
  | 'stats'
  | 'volume'
  | 'mute'
  | 'solo'
  | 'keyboard'
  | 'settings'
  | 'pin'
  | 'close'
  | 'check'
  | 'back'
  | 'refresh'
  | 'grid'
  | 'offline'
  | 'spinner'

type IconProps = {
  name: IconName
  size?: number
  className?: string
}

function shape(name: IconName): React.JSX.Element {
  switch (name) {
    case 'play':
      return <path d="M8 5.2 18.6 12 8 18.8Z" fill="currentColor" stroke="none" />
    case 'stop':
      return (
        <rect x="6.5" y="6.5" width="11" height="11" rx="1.6" fill="currentColor" stroke="none" />
      )
    case 'edit':
      return (
        <>
          <path d="M4 20h4.2L19 9.2a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L4 15.8V20Z" />
          <path d="M14.4 6.6 17.4 9.6" />
        </>
      )
    case 'detach':
      return (
        <>
          <path d="M14 4h6v6" />
          <path d="M20 4l-8.4 8.4" />
          <path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
        </>
      )
    case 'trash':
      return <path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" />
    case 'fullscreen':
      return (
        <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M20 9V5.5A1.5 1.5 0 0 0 18.5 4H15M4 15v3.5A1.5 1.5 0 0 0 5.5 20H9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" />
      )
    case 'exitFullscreen':
      return <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    case 'stats':
      return (
        <>
          <path d="M4 20h16" />
          <path d="M7.5 20v-6M12 20V7.5M16.5 20v-9" />
        </>
      )
    case 'volume':
      return (
        <>
          <path d="M4 9.5h3L11 6v12l-4-3.5H4Z" />
          <path d="M15 9.2a4 4 0 0 1 0 5.6" />
          <path d="M17.6 6.6a7.5 7.5 0 0 1 0 10.8" />
        </>
      )
    case 'mute':
      return (
        <>
          <path d="M4 9.5h3L11 6v12l-4-3.5H4Z" />
          <path d="M15.8 9.8l4.4 4.4M20.2 9.8l-4.4 4.4" />
        </>
      )
    case 'solo':
      return (
        <>
          <path d="M4 15v-2.5a8 8 0 0 1 16 0V15" />
          <path d="M4 15h3v5H5.5A1.5 1.5 0 0 1 4 18.5Z" />
          <path d="M20 15h-3v5h1.5A1.5 1.5 0 0 0 20 18.5Z" />
        </>
      )
    case 'keyboard':
      return (
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01M8 14h8" />
        </>
      )
    case 'settings':
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.7 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </>
      )
    case 'pin':
      return (
        <>
          <path d="M9 4h6l-1 6 3.6 3.4H6.4L10 10 9 4Z" />
          <path d="M12 13.4V20" />
        </>
      )
    case 'close':
      return <path d="M6 6l12 12M18 6 6 18" />
    case 'check':
      return <path d="M5 12.5 9.5 17 19 7" />
    case 'back':
      return (
        <>
          <path d="M20 12H4" />
          <path d="M10 6l-6 6 6 6" />
        </>
      )
    case 'refresh':
      return (
        <>
          <path d="M20 12a8 8 0 1 1-2.4-5.7" />
          <path d="M20 4v5h-5" />
        </>
      )
    case 'grid':
      return (
        <>
          <rect x="4" y="4" width="7" height="7" rx="1.4" />
          <rect x="13" y="4" width="7" height="7" rx="1.4" />
          <rect x="4" y="13" width="7" height="7" rx="1.4" />
          <rect x="13" y="13" width="7" height="7" rx="1.4" />
        </>
      )
    case 'offline':
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M6.6 17.4 17.4 6.6" />
        </>
      )
    case 'spinner':
      return (
        <>
          <circle cx="12" cy="12" r="8" opacity="0.25" />
          <path d="M20 12a8 8 0 0 0-8-8" />
        </>
      )
    default:
      return <circle cx="12" cy="12" r="8" />
  }
}

export function Icon({ name, size = 16, className }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shape(name)}
    </svg>
  )
}
