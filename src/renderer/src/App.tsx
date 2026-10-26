import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import './assets/main.css'
import appLogo from '../../../resources/icon.png'

type Stream = { id: number; name: string; url: string }
type Availability = 'checking' | 'online' | 'offline'
type TileSize = { width: number; height: number }

// Probe the actual WHEP session and wait for a decoded video frame. An OPTIONS
// response alone only proves that a web server exists, not that a stream is live.
async function probeWhep(url: string): Promise<boolean> {
  const pc = new RTCPeerConnection()
  const video = document.createElement('video')
  video.muted = true
  video.autoplay = true
  video.playsInline = true
  video.style.cssText = 'position:fixed;left:-10px;top:-10px;width:2px;height:2px;opacity:0.01;pointer-events:none'
  document.body.appendChild(video)
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })
    pc.ontrack = (event) => {
      if (event.streams[0]) video.srcObject = event.streams[0]
      else {
        const stream = (video.srcObject as MediaStream | null) ?? new MediaStream()
        stream.addTrack(event.track)
        video.srcObject = stream
      }
      void video.play().catch(() => undefined)
    }
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await Promise.race([
      new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve()
        const done = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', done)
            resolve()
          }
        }
        pc.addEventListener('icegatheringstatechange', done)
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 2500)),
    ])
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp', Accept: 'application/sdp' },
      body: pc.localDescription?.sdp,
      cache: 'no-store',
    })
    if (!response.ok) return false
    const answer = await response.text()
    await pc.setRemoteDescription({ type: 'answer', sdp: answer })
    const gotFrame = await Promise.race([
      new Promise<boolean>((resolve) => {
        video.addEventListener('loadeddata', () => resolve(video.videoWidth > 0 && video.videoHeight > 0), { once: true })
        // A frame may have arrived before the listener was attached.
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) resolve(true)
      }),
      new Promise<boolean>((resolve) => { timeout = setTimeout(() => resolve(false), 6000) }),
    ])
    return gotFrame
  } catch {
    return false
  } finally {
    if (timeout) clearTimeout(timeout)
    video.pause()
    video.srcObject = null
    video.remove()
    pc.close()
  }
}

function readSavedStreams(): Stream[] {
  try {
    const saved = localStorage.getItem('multiview-streams')
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is Stream => item !== null && typeof item === 'object' && typeof item.id === 'number' && typeof item.name === 'string' && typeof item.url === 'string')
  } catch { return [] }
}

function readSavedTileSizes(): Record<number, TileSize> {
  try {
    const saved = localStorage.getItem('multiview-tile-sizes')
    if (!saved) return {}
    const parsed: unknown = JSON.parse(saved)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Record<number, TileSize> = {}
    for (const [id, size] of Object.entries(parsed)) {
      if (size && typeof size === 'object' && 'width' in size && 'height' in size &&
        typeof size.width === 'number' && typeof size.height === 'number' &&
        Number.isFinite(size.width) && Number.isFinite(size.height) &&
        size.width >= 280 && size.height >= 200 && Number.isFinite(Number(id))) {
        result[Number(id)] = { width: size.width, height: size.height }
      }
    }
    return result
  } catch { return {} }
}

function StreamPlayer({
  stream, onRemove, onRename, onDetach, minimal = false, style, onResizeStart, onReturnToApp, onAspectRatio, videoAspectRatio, initiallyRunning = false, onInitialRunConsumed, language = 'FR',
}: {
  stream: Stream
  onRemove?: (id: number) => void
  onRename?: (stream: Stream) => void
  onDetach?: (stream: Stream) => void
  minimal?: boolean
  style?: CSSProperties
  onResizeStart?: (event: ReactPointerEvent<HTMLButtonElement>, id: number) => void
  onReturnToApp?: (id: number) => void
  onAspectRatio?: (id: number, ratio: number) => void
  videoAspectRatio?: number
  initiallyRunning?: boolean
  onInitialRunConsumed?: (id: number) => void
  language?: 'FR' | 'EN'
}) {
  const t = (fr: string, en: string) => language === 'FR' ? fr : en
  const statusText = (value: string) => {
    if (language === 'FR') return value
    const translations: Record<string, string> = { 'Arrêté': 'Stopped', 'Flux indisponible': 'Stream unavailable', 'Connecté · WHEP': 'Connected · WHEP', 'Connexion WebRTC…': 'Connecting WebRTC…', 'Connexion interrompue': 'Connection interrupted', 'Échec WebRTC': 'WebRTC failed', 'Préparation du flux…': 'Preparing stream…', 'Connexion au serveur WHEP…': 'Connecting to WHEP server…', 'Négociation terminée, attente du flux…': 'Negotiation complete, waiting for stream…', 'Erreur de connexion': 'Connection error', 'Clique sur lecture pour démarrer le son/la vidéo': 'Click play to start audio/video' }
    return translations[value] ?? value
  }
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const [status, setStatus] = useState('Arrêté')
  const [error, setError] = useState('')
  const [hasVideo, setHasVideo] = useState(false)
  const [isRunning, setIsRunning] = useState(minimal || initiallyRunning)
  const [availability, setAvailability] = useState<Availability>('checking')
  const [volume, setVolume] = useState(70)
  const [muted, setMuted] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(stream.name)
  const [draftUrl, setDraftUrl] = useState(stream.url)

  useEffect(() => { setDraftName(stream.name); setDraftUrl(stream.url) }, [stream.name, stream.url])

  // Periodically verify that WHEP can actually deliver a video frame.
  useEffect(() => {
    if (isRunning) { setAvailability('online'); return }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = async () => {
      const available = await probeWhep(stream.url)
      if (cancelled) return
      setAvailability(available ? 'online' : 'offline')
      if (!available) {
        setIsRunning(false)
        setHasVideo(false)
        setStatus('Flux indisponible')
      }
      timer = setTimeout(check, 20000)
    }
    setAvailability('checking')
    void check()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [stream.url, isRunning])

  useEffect(() => {
    if (initiallyRunning) onInitialRunConsumed?.(stream.id)
  }, [initiallyRunning, onInitialRunConsumed, stream.id])

  useEffect(() => {
    if (!isRunning) return
    let cancelled = false
    const pc = new RTCPeerConnection()
    pcRef.current = pc
    const updateStatus = (value: string) => { if (!cancelled) setStatus(value) }
    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })
    pc.ontrack = (event) => {
      if (cancelled || !videoRef.current) return
      const video = videoRef.current
      if (event.streams[0]) video.srcObject = event.streams[0]
      else {
        const mediaStream = (video.srcObject as MediaStream | null) ?? new MediaStream()
        mediaStream.addTrack(event.track)
        video.srcObject = mediaStream
      }
      void video.play().catch(() => updateStatus('Clique sur lecture pour démarrer le son/la vidéo'))
    }
    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected': setAvailability('online'); updateStatus('Connecté · WHEP'); break
        case 'connecting': updateStatus('Connexion WebRTC…'); break
        case 'disconnected': updateStatus('Connexion interrompue'); break
        case 'failed': setAvailability('offline'); setIsRunning(false); updateStatus('Échec WebRTC'); break
        case 'closed': updateStatus('Arrêté'); break
      }
    }
    const connect = async () => {
      try {
        setError('')
        setHasVideo(false)
        updateStatus('Préparation du flux…')
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === 'complete') { resolve(); return }
          const onGatheringStateChange = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', onGatheringStateChange)
              resolve()
            }
          }
          pc.addEventListener('icegatheringstatechange', onGatheringStateChange)
          setTimeout(resolve, 4000)
        })
        if (cancelled) return
        updateStatus('Connexion au serveur WHEP…')
        const response = await fetch(stream.url, { method: 'POST', headers: { 'Content-Type': 'application/sdp', Accept: 'application/sdp' }, body: pc.localDescription?.sdp })
        if (!response.ok) {
          const details = await response.text()
          throw new Error(`HTTP ${response.status}${details ? ` — ${details.slice(0, 250)}` : ''}`)
        }
        const answer = await response.text()
        if (cancelled) return
        await pc.setRemoteDescription({ type: 'answer', sdp: answer })
        updateStatus('Négociation terminée, attente du flux…')
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        setStatus('Erreur de connexion')
        console.error(`[MultiView] ${stream.name}:`, err)
      }
    }
    void connect()
    return () => {
      cancelled = true
      pc.ontrack = null
      pc.onconnectionstatechange = null
      pc.close()
      if (pcRef.current === pc) pcRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [isRunning, stream.url, stream.name])

  useEffect(() => {
    const video = videoRef.current
    if (video) { video.volume = volume / 100; video.muted = muted }
  }, [volume, muted])

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', updateFullscreen)
    return () => document.removeEventListener('fullscreenchange', updateFullscreen)
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === containerRef.current) await document.exitFullscreen()
      else await containerRef.current?.requestFullscreen()
    } catch (err) { console.error('[MultiView] Plein écran impossible :', err) }
  }

  const saveName = () => {
    const cleanName = draftName.trim()
    const cleanUrl = draftUrl.trim()
    if (cleanName && cleanUrl && (cleanName !== stream.name || cleanUrl !== stream.url)) onRename?.({ ...stream, name: cleanName, url: cleanUrl })
    else { setDraftName(stream.name); setDraftUrl(stream.url) }
    setEditing(false)
  }

  return (
    <article className={`stream-card${minimal ? ' minimal-player' : ''}`} style={style}>
      {!minimal && <div className="stream-info">
        <div className="stream-details">
          {editing ? <form className="rename-form" onSubmit={(event) => { event.preventDefault(); saveName() }}>
            <input autoFocus value={draftName} aria-label={t('Nom du flux', 'Stream name')} onChange={(event) => setDraftName(event.target.value)} placeholder={t('Nom', 'Name')} /><input value={draftUrl} aria-label={t('URL du flux WHEP', 'WHEP stream URL')} onChange={(event) => setDraftUrl(event.target.value)} placeholder={t('URL WHEP', 'WHEP URL')} /><button type="submit">✓</button><button type="button" onClick={() => { setDraftName(stream.name); setDraftUrl(stream.url); setEditing(false) }}>×</button>
          </form> : <h3>{stream.name}</h3>}
          <p title={stream.url}>{stream.url}</p>
          <div className="status-line"><span className={`availability-dot ${availability}`} title={availability === 'online' ? t('Serveur disponible', 'Server available') : availability === 'offline' ? t('Serveur indisponible', 'Server unavailable') : t('Vérification en cours', 'Checking')} /><span className="stream-status">{isRunning ? statusText(status) : t('Arrêté · ', 'Stopped · ') + (availability === 'online' ? t('flux détecté', 'stream detected') : availability === 'offline' ? t('flux absent', 'stream unavailable') : t('test en cours', 'checking'))}</span></div>
          {error && <p className="player-error inline-error">{error}</p>}
        </div>
        <div className="stream-actions">
          <button className="icon-button" disabled={!isRunning && availability !== 'online'} onClick={() => { if (isRunning) setIsRunning(false); else if (availability === 'online') { setError(''); setIsRunning(true) } }} title={isRunning ? t('Arrêter le flux', 'Stop stream') : availability === 'online' ? t('Lancer le flux', 'Start stream') : t('Le flux doit être détecté avant la lecture', 'The stream must be detected before playback')} aria-label={isRunning ? t('Arrêter le flux', 'Stop stream') : t('Lancer le flux', 'Start stream')}>{isRunning ? '■' : '▶'}</button>
          {!editing && onRename && <button className="icon-button" onClick={() => setEditing(true)} title={t('Modifier le flux', 'Edit stream')} aria-label={t('Modifier le flux', 'Edit stream')}>✎</button>}
          {onDetach && <button className="icon-button" onClick={() => onDetach(stream)} title={t('Ouvrir dans une fenêtre flottante', 'Open in floating window')} aria-label={t('Détacher le flux', 'Detach stream')}>↗</button>}
          {onRemove && <button className="delete-button" onClick={() => onRemove(stream.id)} aria-label={`${t('Supprimer', 'Delete')} ${stream.name}`} title={t('Supprimer ce flux', 'Delete this stream')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" /></svg></button>}
        </div>
      </div>}
      <div className={`video-container${minimal ? ' popup-video-container' : ''}${style?.height ? ' sized-video-container' : ''}`} style={!minimal && !style?.height ? { aspectRatio: videoAspectRatio ? String(videoAspectRatio) : '16 / 9' } : undefined} ref={containerRef}>
        <video ref={videoRef} className="stream-video" autoPlay playsInline muted={muted} onLoadedMetadata={(event) => {
          const video = event.currentTarget
          if (video.videoWidth > 0 && video.videoHeight > 0) onAspectRatio?.(stream.id, video.videoWidth / video.videoHeight)
        }} onLoadedData={() => { setHasVideo(true); setAvailability('online'); setError('') }} onError={() => { /* WHEP negotiation supplies the useful error. */ }} onClick={() => { if (videoRef.current && isRunning) void videoRef.current.play() }} />
        {!minimal && !isRunning && <div className="player-overlay idle-overlay"><span className="video-symbol">{availability === 'online' ? '▶' : '!'}</span><span>{availability === 'online' ? t('Flux disponible', 'Stream available') : availability === 'offline' ? t('Flux indisponible', 'Stream unavailable') : t('Vérification du flux…', 'Checking stream…')}</span>{availability === 'online' && <button className="overlay-action" onClick={() => { setError(''); setIsRunning(true) }}>▶ {t('Lancer le flux', 'Start stream')}</button>}</div>}
        {!minimal && isRunning && !hasVideo && <div className="player-overlay"><span className="video-symbol">▶</span><span>{statusText(status)}</span>{error && <p className="player-error">{error}</p>}</div>}
        {!minimal && <div className="view-controls"><button type="button" onClick={() => void toggleFullscreen()}>{isFullscreen ? `⤢ ${t('Quitter le plein écran', 'Exit fullscreen')}` : `⛶ ${t('Plein écran', 'Fullscreen')}`}</button></div>}
        <div className={`audio-controls${minimal ? ' popup-audio-controls' : ''}`} title={t('Volume', 'Volume')}><button type="button" className="mute-button" onClick={() => setMuted((current) => !current)} title={muted ? t('Activer le son', 'Unmute') : t('Couper le son', 'Mute')}>{muted || volume === 0 ? '🔇' : '🔊'}</button><input aria-label={`${t('Volume de', 'Volume for')} ${stream.name}`} type="range" min="0" max="100" value={volume} onChange={(event) => { setVolume(Number(event.target.value)); if (Number(event.target.value) > 0) setMuted(false) }} /></div>
        {minimal && <div className="popup-return-wrap"><button className="popup-return-button" onClick={() => onReturnToApp?.(stream.id)}>↩ {t('Retour dans MultiView', 'Return to MultiView')}</button></div>}
      </div>
      {!minimal && onResizeStart && <button type="button" className="resize-grip" aria-label={`${t('Redimensionner', 'Resize')} ${stream.name}`} title={t('Redimensionner en conservant le ratio vidéo', 'Resize while preserving video aspect ratio')} onPointerDown={(event) => onResizeStart(event, stream.id)} />}
    </article>
  )
}

function App() {
  const query = new URLSearchParams(window.location.search)
  const isPopup = query.get('streamPopup') === '1'
  const popupStream: Stream | null = isPopup ? { id: Number(query.get('streamId') || Date.now()), name: query.get('streamName') || 'Flux détaché', url: query.get('streamUrl') || '' } : null
  const [streams, setStreams] = useState<Stream[]>(readSavedStreams)
  const [url, setUrl] = useState('')
  const [streamName, setStreamName] = useState('')
  const [language, setLanguage] = useState<'FR' | 'EN'>(() => (localStorage.getItem('multiview-language') === 'EN' ? 'EN' : 'FR'))
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [tileSizes, setTileSizes] = useState<Record<number, TileSize>>(readSavedTileSizes)
  const [aspectRatios, setAspectRatios] = useState<Record<number, number>>({})
  const [detachedIds, setDetachedIds] = useState<number[]>([])
  const [resumeIds, setResumeIds] = useState<number[]>([])

  useEffect(() => { if (!isPopup) localStorage.setItem('multiview-streams', JSON.stringify(streams)) }, [streams, isPopup])
  useEffect(() => { if (!isPopup) localStorage.setItem('multiview-tile-sizes', JSON.stringify(tileSizes)) }, [tileSizes, isPopup])
  useEffect(() => {
    if (isPopup && popupStream) document.title = popupStream.name
  }, [isPopup, popupStream?.name])
  useEffect(() => {
    if (isPopup) return
    const offClosed = window.api.onStreamWindowClosed((id) => setDetachedIds((current) => current.filter((item) => item !== id)))
    const offReturned = window.api.onStreamWindowReturned((id) => {
      setResumeIds((current) => current.includes(id) ? current : [...current, id])
      setDetachedIds((current) => current.filter((item) => item !== id))
    })
    return () => { offClosed(); offReturned() }
  }, [isPopup])

  const reportAspectRatio = useCallback((id: number, ratio: number) => {
    if (!Number.isFinite(ratio) || ratio <= 0) return
    setAspectRatios((current) => ({ ...current, [id]: ratio }))
    if (isPopup) void window.api.setStreamWindowAspectRatio(id, ratio)
  }, [isPopup])

  useEffect(() => { if (!isPopup) localStorage.setItem('multiview-language', language) }, [language, isPopup])

  const addStream = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanUrl = url.trim()
    if (!cleanUrl) return
    const usedNumbers = new Set(streams.map((stream) => { const match = stream.name.match(/^Flux\s+(\d+)$/i); return match ? Number(match[1]) : 0 }))
    let number = 1
    while (usedNumbers.has(number)) number += 1
    setStreams((current) => [...current, { id: Date.now(), name: streamName.trim() || `Flux ${number}`, url: cleanUrl }])
    setUrl('')
    setStreamName('')
    setShowForm(false)
  }
  const removeStream = (id: number) => {
    const target = streams.find((stream) => stream.id === id)
    if (!target || !window.confirm(t(`Supprimer « ${target.name} » ?\nCette action retirera le flux de MultiView.`, `Delete “${target.name}”?\nThis will remove the stream from MultiView.`))) return
    if (detachedIds.includes(id)) void window.api.closeStreamWindow(id)
    setStreams((current) => current.filter((stream) => stream.id !== id))
    setTileSizes((current) => { const next = { ...current }; delete next[id]; return next })
    setAspectRatios((current) => { const next = { ...current }; delete next[id]; return next })
  }
  const renameStream = (updated: Stream) => setStreams((current) => current.map((stream) => stream.id === updated.id ? { ...stream, name: updated.name, url: updated.url } : stream))
  const reorderStream = (targetId: number) => { if (draggedId === null || draggedId === targetId) return; setStreams(current => { const from = current.findIndex(item => item.id === draggedId); const to = current.findIndex(item => item.id === targetId); if (from < 0 || to < 0) return current; const next = [...current]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next }); setDraggedId(null) }
  const t = (fr: string, en: string) => language === 'FR' ? fr : en

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>, id: number) => {
    event.preventDefault(); event.stopPropagation()
    const card = event.currentTarget.closest('.stream-card') as HTMLElement | null
    const grid = event.currentTarget.closest('.stream-grid') as HTMLElement | null
    if (!card || !grid) return
    const startX = event.clientX
    const rect = card.getBoundingClientRect()
    const ratio = aspectRatios[id] || (rect.width / Math.max(1, rect.height - 72))
    const headerHeight = card.querySelector('.stream-info')?.getBoundingClientRect().height ?? 72
    const maxWidth = Math.max(280, grid.getBoundingClientRect().width)
    const move = (moveEvent: globalThis.PointerEvent) => {
      const width = Math.max(280, Math.min(maxWidth, rect.width + moveEvent.clientX - startX))
      // Keep the source video ratio; the card height includes its title/control header.
      const height = Math.max(200, width / ratio + headerHeight)
      setTileSizes((current) => ({ ...current, [id]: { width, height } }))
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true }); window.addEventListener('pointercancel', up, { once: true })
  }

  const detachStream = async (stream: Stream) => {
    await window.api.openStreamWindow(stream)
    setDetachedIds((current) => current.includes(stream.id) ? current : [...current, stream.id])
  }

  if (isPopup && popupStream) return <main className="popup-app"><StreamPlayer stream={popupStream} language={language} minimal onReturnToApp={(id) => void window.api.returnToApp(id)} onAspectRatio={reportAspectRatio} /></main>

  return <main className="app">
    <header className="topbar"><div className="brand"><img className="brand-icon" src={appLogo} alt="MultiView" /><div><h1>MultiView</h1><p>{t('Lecteur de flux WHEP / WebRTC', 'WHEP / WebRTC stream viewer')}</p></div></div><div className="topbar-actions"><span className="status"><span className="status-dot" />{t('Prêt', 'Ready')}</span><button className="primary-button" onClick={() => setShowForm((current) => !current)}>+ {t('Ajouter un flux', 'Add stream')}</button></div></header>
    {showForm && <form className="add-form" onSubmit={addStream}><label htmlFor="stream-name">{t('Nom du flux (facultatif)', 'Stream name (optional)')}</label><div className="form-row"><input id="stream-name" placeholder={t('Ex. Vue du joueur', 'e.g. Player view')} value={streamName} onChange={(event) => setStreamName(event.target.value)} /><input id="stream-url" type="url" placeholder="https://server.example.com/camera/whep" value={url} onChange={(event) => setUrl(event.target.value)} autoFocus required /><button className="primary-button" type="submit">{t('Ajouter', 'Add')}</button><button className="secondary-button" type="button" onClick={() => setShowForm(false)}>{t('Annuler', 'Cancel')}</button></div><p className="form-hint">{t('Les flux ne démarrent pas automatiquement. Le voyant indique si le serveur répond.', 'Streams do not start automatically. The indicator shows whether the stream is available.')}</p></form>}
    <section className="workspace"><div className="section-heading"><div><h2>{t('Vue principale', 'Main view')}</h2><p>{streams.length} {t('flux configuré(s)', 'configured stream(s)')}</p></div></div>
      {streams.length === 0 ? <div className="empty-state"><div className="empty-icon">▦</div><h2>{t('Votre espace vidéo est prêt', 'Your video space is ready')}</h2><p>{t('Ajoutez un flux WHEP pour commencer.', 'Add a WHEP stream to get started.')}</p><button className="primary-button" onClick={() => setShowForm(true)}>+ {t('Ajouter votre premier flux', 'Add your first stream')}</button></div> : <div className="stream-grid">{streams.map((stream) => detachedIds.includes(stream.id) ? <article className="stream-card detached-card" key={stream.id} draggable onDragStart={() => setDraggedId(stream.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderStream(stream.id)}><div className="detached-message"><span className="availability-dot online" /><strong>{t('Flux dans une fenêtre flottante', 'Stream in a floating window')}</strong><p>{stream.name}</p><button className="primary-button" onClick={() => void window.api.returnToApp(stream.id)}>↩ {t('Retour dans l’application', 'Return to app')}</button><button className="delete-button detached-remove" onClick={() => removeStream(stream.id)} title={t('Supprimer le flux', 'Delete stream')} aria-label={`${t('Supprimer', 'Delete')} ${stream.name}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" /></svg></button></div></article> : <div key={stream.id} className="sortable-stream" style={tileSizes[stream.id] ? { width: `${tileSizes[stream.id].width}px`, flex: `0 0 ${tileSizes[stream.id].width}px` } : undefined} draggable onDragStart={() => setDraggedId(stream.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderStream(stream.id)}><StreamPlayer stream={stream} language={language} onRemove={removeStream} onRename={renameStream} onResizeStart={startResize} onDetach={(item) => void detachStream(item)} onAspectRatio={reportAspectRatio} videoAspectRatio={aspectRatios[stream.id]} initiallyRunning={resumeIds.includes(stream.id)} onInitialRunConsumed={(id) => setResumeIds((current) => current.filter((item) => item !== id))} style={tileSizes[stream.id] ? { width: '100%', height: tileSizes[stream.id].height, flex: '0 0 100%' } : undefined} /></div>)}</div>}
    </section><footer className="footer"><div className="footer-left"><strong>MultiView</strong><span className="version">v1.1.1</span><span>WHEP · WebRTC</span></div><div className="footer-right"><button className={language === 'FR' ? 'language-active' : ''} onClick={() => setLanguage('FR')}>FR</button><span>|</span><button className={language === 'EN' ? 'language-active' : ''} onClick={() => setLanguage('EN')}>EN</button><a className="kofi-link" href="https://ko-fi.com/aeternoxx" target="_blank" rel="noreferrer"><img src="./kofi.svg" alt="Ko-fi" /> Ko-fi</a></div></footer>
  </main>
}

export default App
