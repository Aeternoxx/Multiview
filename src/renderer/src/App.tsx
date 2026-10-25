import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import './assets/main.css'

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

function StreamPlayer({
  stream, onRemove, onRename, onDetach, minimal = false, style, onResizeStart, onReturnToApp, onAspectRatio, videoAspectRatio, initiallyRunning = false, onInitialRunConsumed,
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
}) {
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

  useEffect(() => setDraftName(stream.name), [stream.name])

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
    if (cleanName && cleanName !== stream.name) onRename?.({ ...stream, name: cleanName })
    else setDraftName(stream.name)
    setEditing(false)
  }

  return (
    <article className={`stream-card${minimal ? ' minimal-player' : ''}`} style={style}>
      {!minimal && <div className="stream-info">
        <div className="stream-details">
          {editing ? <form className="rename-form" onSubmit={(event) => { event.preventDefault(); saveName() }}>
            <input autoFocus value={draftName} aria-label="Nom du flux" onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setDraftName(stream.name); setEditing(false) } }} onBlur={saveName} />
          </form> : <h3>{stream.name}</h3>}
          <p title={stream.url}>{stream.url}</p>
          <div className="status-line"><span className={`availability-dot ${availability}`} title={availability === 'online' ? 'Serveur disponible' : availability === 'offline' ? 'Serveur indisponible' : 'Vérification en cours'} /><span className="stream-status">{isRunning ? status : 'Arrêté · ' + (availability === 'online' ? 'flux détecté' : availability === 'offline' ? 'flux absent' : 'test en cours')}</span></div>
          {error && <p className="player-error inline-error">{error}</p>}
        </div>
        <div className="stream-actions">
          <button className="icon-button" disabled={!isRunning && availability !== 'online'} onClick={() => { if (isRunning) setIsRunning(false); else if (availability === 'online') { setError(''); setIsRunning(true) } }} title={isRunning ? 'Arrêter le flux' : availability === 'online' ? 'Lancer le flux' : 'Le flux doit être détecté avant la lecture'} aria-label={isRunning ? 'Arrêter le flux' : 'Lancer le flux'}>{isRunning ? '■' : '▶'}</button>
          {!editing && onRename && <button className="icon-button" onClick={() => setEditing(true)} title="Renommer le flux" aria-label="Renommer le flux">✎</button>}
          {onDetach && <button className="icon-button" onClick={() => onDetach(stream)} title="Ouvrir dans une fenêtre Windows" aria-label="Détacher le flux">↗</button>}
          {onRemove && <button className="delete-button" onClick={() => onRemove(stream.id)} aria-label={`Supprimer ${stream.name}`} title="Supprimer ce flux"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" /></svg></button>}
        </div>
      </div>}
      <div className={`video-container${minimal ? ' popup-video-container' : ''}${style?.height ? ' sized-video-container' : ''}`} style={!minimal && !style?.height ? { aspectRatio: videoAspectRatio ? String(videoAspectRatio) : '16 / 9' } : undefined} ref={containerRef}>
        <video ref={videoRef} className="stream-video" autoPlay playsInline muted={muted} onLoadedMetadata={(event) => {
          const video = event.currentTarget
          if (video.videoWidth > 0 && video.videoHeight > 0) onAspectRatio?.(stream.id, video.videoWidth / video.videoHeight)
        }} onLoadedData={() => { setHasVideo(true); setAvailability('online'); setError('') }} onError={() => { /* WHEP negotiation supplies the useful error. */ }} onClick={() => { if (videoRef.current && isRunning) void videoRef.current.play() }} />
        {!minimal && !isRunning && <div className="player-overlay idle-overlay"><span className="video-symbol">{availability === 'online' ? '▶' : '!'}</span><span>{availability === 'online' ? 'Flux disponible' : availability === 'offline' ? 'Flux indisponible' : 'Vérification du flux…'}</span><button className="overlay-action" onClick={() => setIsRunning(true)}>▶ Lancer le flux</button></div>}
        {!minimal && isRunning && !hasVideo && <div className="player-overlay"><span className="video-symbol">▶</span><span>{status}</span>{error && <p className="player-error">{error}</p>}</div>}
        {!minimal && <div className="view-controls"><button type="button" onClick={() => void toggleFullscreen()}>{isFullscreen ? '⤢ Quitter le plein écran' : '⛶ Plein écran'}</button></div>}
        <div className={`audio-controls${minimal ? ' popup-audio-controls' : ''}`} title="Volume"><button type="button" className="mute-button" onClick={() => setMuted((current) => !current)} title={muted ? 'Activer le son' : 'Couper le son'}>{muted || volume === 0 ? '🔇' : '🔊'}</button><input aria-label={`Volume de ${stream.name}`} type="range" min="0" max="100" value={volume} onChange={(event) => { setVolume(Number(event.target.value)); if (Number(event.target.value) > 0) setMuted(false) }} /></div>
        {minimal && <div className="popup-return-wrap"><button className="popup-return-button" onClick={() => onReturnToApp?.(stream.id)}>↩ Retour dans MultiView</button></div>}
      </div>
      {!minimal && onResizeStart && <button type="button" className="resize-grip" aria-label={`Redimensionner ${stream.name}`} title="Redimensionner en conservant le ratio vidéo" onPointerDown={(event) => onResizeStart(event, stream.id)} />}
    </article>
  )
}

function App() {
  const query = new URLSearchParams(window.location.search)
  const isPopup = query.get('streamPopup') === '1'
  const popupStream: Stream | null = isPopup ? { id: Number(query.get('streamId') || Date.now()), name: query.get('streamName') || 'Flux détaché', url: query.get('streamUrl') || '' } : null
  const [streams, setStreams] = useState<Stream[]>(readSavedStreams)
  const [url, setUrl] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [tileSizes, setTileSizes] = useState<Record<number, TileSize>>({})
  const [aspectRatios, setAspectRatios] = useState<Record<number, number>>({})
  const [detachedIds, setDetachedIds] = useState<number[]>([])
  const [resumeIds, setResumeIds] = useState<number[]>([])

  useEffect(() => { if (!isPopup) localStorage.setItem('multiview-streams', JSON.stringify(streams)) }, [streams, isPopup])
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

  const addStream = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanUrl = url.trim()
    if (!cleanUrl) return
    const usedNumbers = new Set(streams.map((stream) => { const match = stream.name.match(/^Flux\s+(\d+)$/i); return match ? Number(match[1]) : 0 }))
    let number = 1
    while (usedNumbers.has(number)) number += 1
    setStreams((current) => [...current, { id: Date.now(), name: `Flux ${number}`, url: cleanUrl }])
    setUrl('')
    setShowForm(false)
  }
  const removeStream = (id: number) => {
    const target = streams.find((stream) => stream.id === id)
    if (!target || !window.confirm(`Supprimer « ${target.name} » ?\nCette action retirera le flux de MultiView.`)) return
    if (detachedIds.includes(id)) void window.api.closeStreamWindow(id)
    setStreams((current) => current.filter((stream) => stream.id !== id))
    setTileSizes((current) => { const next = { ...current }; delete next[id]; return next })
    setAspectRatios((current) => { const next = { ...current }; delete next[id]; return next })
  }
  const renameStream = (updated: Stream) => setStreams((current) => current.map((stream) => stream.id === updated.id ? { ...stream, name: updated.name } : stream))

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>, id: number) => {
    event.preventDefault(); event.stopPropagation()
    const card = event.currentTarget.closest('.stream-card') as HTMLElement | null
    const grid = event.currentTarget.closest('.stream-grid') as HTMLElement | null
    if (!card || !grid) return
    const startX = event.clientX
    const startY = event.clientY
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

  if (isPopup && popupStream) return <main className="popup-app"><StreamPlayer stream={popupStream} minimal onReturnToApp={(id) => void window.api.returnToApp(id)} onAspectRatio={reportAspectRatio} /></main>

  return <main className="app">
    <header className="topbar"><div className="brand"><div className="brand-icon">M</div><div><h1>MultiView</h1><p>Lecteur de flux WHEP / WebRTC</p></div></div><div className="topbar-actions"><span className="status"><span className="status-dot" />Prêt</span><button className="primary-button" onClick={() => setShowForm((current) => !current)}>+ Ajouter un flux</button></div></header>
    {showForm && <form className="add-form" onSubmit={addStream}><label htmlFor="stream-url">URL du flux WHEP</label><div className="form-row"><input id="stream-url" type="url" placeholder="https://serveur.example.com/camera/whep" value={url} onChange={(event) => setUrl(event.target.value)} autoFocus required /><button className="primary-button" type="submit">Ajouter</button><button className="secondary-button" type="button" onClick={() => setShowForm(false)}>Annuler</button></div><p className="form-hint">Les flux ne démarrent pas automatiquement. Le voyant indique si le serveur répond.</p></form>}
    <section className="workspace"><div className="section-heading"><div><h2>Vue principale</h2><p>{streams.length} flux configuré{streams.length > 1 ? 's' : ''}</p></div></div>
      {streams.length === 0 ? <div className="empty-state"><div className="empty-icon">▦</div><h2>Votre espace vidéo est prêt</h2><p>Ajoutez un flux WHEP pour commencer.</p><button className="primary-button" onClick={() => setShowForm(true)}>+ Ajouter votre premier flux</button></div> : <div className="stream-grid">{streams.map((stream) => detachedIds.includes(stream.id) ? <article className="stream-card detached-card" key={stream.id}><div className="detached-message"><span className="availability-dot online" /><strong>Flux dans une fenêtre flottante</strong><p>{stream.name}</p><button className="primary-button" onClick={() => void window.api.returnToApp(stream.id)}>↩ Retour dans l'application</button><button className="delete-button detached-remove" onClick={() => removeStream(stream.id)} title="Supprimer le flux" aria-label={`Supprimer ${stream.name}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" /></svg></button></div></article> : <StreamPlayer key={stream.id} stream={stream} onRemove={removeStream} onRename={renameStream} onResizeStart={startResize} onDetach={(item) => void detachStream(item)} onAspectRatio={reportAspectRatio} videoAspectRatio={aspectRatios[stream.id]} initiallyRunning={resumeIds.includes(stream.id)} onInitialRunConsumed={(id) => setResumeIds((current) => current.filter((item) => item !== id))} style={tileSizes[stream.id] ? { width: tileSizes[stream.id].width, height: tileSizes[stream.id].height, flex: `0 0 ${tileSizes[stream.id].width}px` } : undefined} />)}</div>}
    </section><footer className="footer"><span>MultiView</span><span>WHEP · WebRTC</span></footer>
  </main>
}

export default App
