/**
 * components/VideoPlayer.jsx
 * Reproductor HLS/MP4/WebTorrent con:
 *  - Selector de CALIDAD nativo tipo Netflix (⚙️ engranaje)
 *  - Selector de IDIOMA de audio (🔊)
 *  - Auto-selección de español al cargar
 *  - Buffer agresivo + retries automáticos
 *  - Badge de velocidad en tiempo real
 *  - Soporte para torrents vía WebTorrent (🧲)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
// WebTorrent se importa dinámicamente cuando se necesita (evita errores de build)

// ── Helpers de idioma ─────────────────────────────────────────────────────────
const LANG_NAMES = {
  es: 'Español', spa: 'Español', sp: 'Español',
  'es-419': 'Español Latino', 'es-MX': 'Español Latino', 'es-LA': 'Español Latino',
  'es-ES': 'Español (España)',
  en: 'Inglés', eng: 'Inglés',
  pt: 'Portugués', por: 'Portugués',
  fr: 'Francés', de: 'Alemán', it: 'Italiano',
  ja: 'Japonés', ko: 'Coreano',
};

function getLangName(track) {
  if (!track) return 'Desconocido';
  const lang = (track.lang ?? track.language ?? '').toLowerCase();
  const name = (track.name ?? '').toLowerCase();

  if (LANG_NAMES[lang]) return LANG_NAMES[lang];

  // Búsqueda agresiva por palabras clave
  if (name.includes('latin') || name.includes('lat') || name.includes('mx') || name.includes('419'))
    return 'Español Latino';
  if (name.includes('español') || name.includes('spanish') || name.includes('spa') || name.includes('esp'))
    return 'Español';
  if (name.includes('castellano') || name.includes('spain') || name.includes('es-es'))
    return 'Castellano';
  if (name.includes('english') || name.includes('inglés') || name.includes('eng'))
    return 'Inglés';

  return track.name || track.lang || `Pista ${track.id ?? '?'}`;
}

function findSpanishTrack(tracks) {
  console.log('[Player] Analizando pistas de audio disponibles:', tracks.map(t => ({ id: t.id, lang: t.lang, name: t.name })));

  const priority = [
    // 1. Latino (nombres específicos)
    (t) => /es[-_]?(419|mx|la|latin)/i.test(t.lang ?? '') || /latin|lat\b|mex|419/i.test(t.name ?? ''),
    // 2. Español / Spanish (genérico o códigos)
    (t) => /^(es|spa|sp|esp)$/i.test(t.lang ?? '') || /español|spanish|esp\b/i.test(t.name ?? ''),
    // 3. Castellano
    (t) => /castellano|spain/i.test(t.name ?? ''),
    // 4. Cualquier cosa que empiece por ES
    (t) => /^es/i.test(t.lang ?? ''),
  ];

  for (const test of priority) {
    const idx = tracks.findIndex(test);
    if (idx >= 0) {
      console.log(`[Player] ¡Pista en español detectada! Índice: ${idx} (${getLangName(tracks[idx])})`);
      return idx;
    }
  }
  return -1;
}


// ── Configuración HLS ─────────────────────────────────────────────────────────
const HLS_CONFIG = {
  // ── Buffer ────────────────────────────────────────────────────────────────
  // 120s buffereados = más cache, menos buffering en servidores lentos Latino
  maxBufferLength:       120,
  maxMaxBufferLength:    180,
  maxBufferSize:         500 * 1024 * 1024, // 500 MB (aumentado para más cache)
  maxBufferHole:         0.5,
  backBufferLength:       30,
  startFragPrefetch:     true,
  progressive:           true,
  enableWorker:          true,
  lowLatencyMode:        false,

  // ── ABR ────────────────────────────────────────────────────────────────────
  // Arranca asumiendo 50 Mbps → elige 1080p desde el primer segmento SIN switch abrupto
  abrEwmaDefaultEstimate: 50_000_000,
  startLevel:            -1,
  capLevelToPlayerSize:  false,

  // Conservador: solo usa el 75% del ancho de banda medido para elegir calidad.
  // Crea margen de seguridad contra picos de latencia del proxy.
  abrBandWidthFactor:    0.75,

  // Solo sube de calidad cuando tiene 95% de confianza sostenida en el ancho de banda.
  // Impide el ciclo sube↕baja que causaba los microcortes cada 4s.
  abrBandWidthUpFactor:  0.95,

  // EWMA para VOD (películas) — abrEwmaFastLive/SlowLive solo aplican a streams en VIVO.
  // Valores altos = reacción lenta a picos de latencia del proxy = sin oscilaciones de calidad.
  abrEwmaFast:           8.0,    // VOD: tarda ~8 segmentos en reaccionar a bajada de velocidad
  abrEwmaSlow:           20.0,   // VOD: promedio muy suave, ignora picos momentáneos
  abrEwmaFastLive:       5.0,    // por si alguna fuente usa stream en vivo
  abrEwmaSlowLive:       12.0,

  // ── Tiempos / reintentos ───────────────────────────────────────────────────
  manifestLoadingTimeOut:  20_000,
  manifestLoadingMaxRetry: 4,
  levelLoadingTimeOut:     20_000,
  levelLoadingMaxRetry:    4,
  fragLoadingTimeOut:      20_000,    // menos tiempo de espera por segmento: falla rápido y reintenta
  fragLoadingMaxRetry:     6,
  fragLoadingRetryDelay:   300,
  xhrSetup: (xhr) => { xhr.timeout = 20_000; },
};

// ── Componente Popup genérico ─────────────────────────────────────────────────
function PopupMenu({ title, children, onClose }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', right: 0, bottom: 'calc(100% + 6px)',
        background: 'rgba(8,8,12,0.97)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12, overflow: 'hidden',
        minWidth: 190,
        boxShadow: '0 16px 48px rgba(0,0,0,0.85)',
        zIndex: 50,
      }}
    >
      <div style={{
        padding: '8px 14px 7px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem',
        letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function MenuOption({ label, isActive, onClick, extra }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        padding: '9px 14px',
        background: isActive ? 'rgba(229,9,20,0.12)' : 'transparent',
        border: 'none',
        borderLeft: isActive ? '3px solid #e50914' : '3px solid transparent',
        color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
        fontSize: '0.85rem', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'background .12s',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <span>{label}</span>
      {isActive && (
        <span style={{
          fontSize: '0.6rem', fontWeight: 800, background: 'rgba(229,9,20,0.25)',
          color: '#f87171', padding: '1px 6px', borderRadius: 99,
        }}>✓ Activo</span>
      )}
      {extra && !isActive && (
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)' }}>{extra}</span>
      )}
    </button>
  );
}

// ── Badge / Botón de control ──────────────────────────────────────────────────
function ControlBadge({ label, title: tipTitle, onClick, style: s }) {
  return (
    <button
      onClick={onClick}
      title={tipTitle}
      style={{
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: '#fff', fontSize: '0.72rem', fontWeight: 700,
        padding: '4px 10px', borderRadius: 99, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4,
        letterSpacing: '0.04em', transition: 'border-color .15s',
        whiteSpace: 'nowrap',
        ...s,
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(229,9,20,0.7)'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
    >
      {label}
    </button>
  );
}

// ── VideoPlayer ───────────────────────────────────────────────────────────────
export default function VideoPlayer({ streamUrl, streamType, title }) {
  const videoRef     = useRef(null);
  const hlsRef       = useRef(null);
  const containerRef = useRef(null);
  const torrentClientRef = useRef(null); // WebTorrent client
  const torrentRef = useRef(null);       // Torrent instance

  const [error,       setError]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [levels,      setLevels]      = useState([]);       // calidades disponibles
  const [activeLevel, setActiveLevel] = useState(0);        // índice del nivel seleccionado
  const [audioTracks, setAudioTracks] = useState([]);
  const [activeAudio, setActiveAudio] = useState(-1);
  const [bandwidth,   setBandwidth]   = useState(null);
  const [realLevel,   setRealLevel]   = useState(0);        // nivel real que ABR está usando
  const [showQuality, setShowQuality] = useState(false);
  const [showAudio,   setShowAudio]   = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [torrentProgress, setTorrentProgress] = useState(0); // Progreso del torrent (0-100)
  const [torrentSpeed, setTorrentSpeed] = useState(0);       // Velocidad de descarga (KB/s)
  const [torrentPeers, setTorrentPeers] = useState(0);       // Número de peers conectados

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const switchQuality = useCallback((levelIdx) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelIdx;  // -1 = auto, >=0 = fijo
    setActiveLevel(levelIdx);
    setShowQuality(false);
  }, []);

  const switchAudio = useCallback((idx) => {
    if (!hlsRef.current) return;
    hlsRef.current.audioTrack = idx;
    setActiveAudio(idx);
    setShowAudio(false);
  }, []);

  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;
    setError(null);
    setLoading(true);
    setLevels([]);
    setActiveLevel(-1);
    setAudioTracks([]);
    setActiveAudio(-1);
    setBandwidth(null);
    setShowQuality(false);
    setShowAudio(false);
    setTorrentProgress(0);
    setTorrentSpeed(0);
    setTorrentPeers(0);

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    
    // Limpiar WebTorrent anterior
    if (torrentRef.current) {
      torrentRef.current.destroy();
      torrentRef.current = null;
    }

    // ── TORRENT (magnet links con WebTorrent) ──────────────────────────────
    if (streamType === 'torrent') {
      console.log('[Player] 🧲 Reproduciendo torrent:', streamUrl);
      
      // Importar WebTorrent dinámicamente (solo cuando se necesita)
      import('webtorrent').then(({ default: WebTorrent }) => {
        // Inicializar WebTorrent client (reutilizar si existe)
        if (!torrentClientRef.current) {
          torrentClientRef.current = new WebTorrent({
            maxConns: 100,        // Máximo 100 conexiones simultáneas
            downloadLimit: -1,     // Sin límite de descarga
            uploadLimit: 1024000,  // Límite de subida: 1 MB/s (ser buen peer pero no saturar)
          });
        }
        
        const client = torrentClientRef.current;
        
        // Agregar torrent
        client.add(streamUrl, (torrent) => {
          console.log('[WebTorrent] Torrent agregado:', torrent.name);
          torrentRef.current = torrent;
          
          // Encontrar archivo de video más grande
          const videoFile = torrent.files
            .filter(f => /\.(mp4|mkv|avi|webm|mov)$/i.test(f.name))
            .sort((a, b) => b.length - a.length)[0];
          
          if (!videoFile) {
            setError('No se encontró archivo de video en el torrent');
            setLoading(false);
            return;
          }
          
          console.log('[WebTorrent] Archivo seleccionado:', videoFile.name, `(${(videoFile.length / 1024 / 1024).toFixed(2)} MB)`);
          
          // Renderizar video
          videoFile.renderTo(video, {
            autoplay: true,
            controls: false,
          }, (err) => {
            if (err) {
              console.error('[WebTorrent] Error al renderizar:', err);
              setError(`Error al reproducir torrent: ${err.message}`);
              setLoading(false);
            } else {
              console.log('[WebTorrent] Video renderizado correctamente');
              setLoading(false);
            }
          });
          
          // Actualizar progreso cada 500ms
          const progressInterval = setInterval(() => {
            if (torrent.progress >= 0) {
              setTorrentProgress((torrent.progress * 100).toFixed(1));
            }
            setTorrentSpeed((torrent.downloadSpeed / 1024).toFixed(0)); // KB/s
            setTorrentPeers(torrent.numPeers);
            
            // Si ya descargó suficiente, puede empezar a reproducir
            if (torrent.progress > 0.01 && loading) {
              setLoading(false);
            }
          }, 500);
          
          torrent.on('done', () => {
            console.log('[WebTorrent] ✅ Descarga completa');
            setTorrentProgress(100);
            clearInterval(progressInterval);
          });
          
          torrent.on('error', (err) => {
            console.error('[WebTorrent] ❌ Error:', err);
            setError(`Error en torrent: ${err.message}`);
            setLoading(false);
            clearInterval(progressInterval);
          });
          
          // Cleanup interval cuando se desmonte
          return () => clearInterval(progressInterval);
        });
      }).catch((err) => {
        console.error('[Player] Error al cargar WebTorrent:', err);
        setError('No se pudo cargar el reproductor de torrents');
        setLoading(false);
      });
      
      // Retorno temprano para torrents (el resto se maneja en el callback)
      return () => {
        if (torrentRef.current) {
          torrentRef.current.destroy();
          torrentRef.current = null;
        }
      };
    }
    } else if (streamType === 'hls' && Hls.isSupported()) {
      const hls = new Hls(HLS_CONFIG);
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setLoading(false);

        // ── Niveles de calidad ─────────────────────────────────────────────
        const lvls = hls.levels ?? [];
        setLevels(lvls);
        // Arrancar siempre en la calidad más alta disponible.
        // Es seguro antes de video.play() porque el buffer está vacío.
        const highestIdx = lvls.length > 0 ? lvls.length - 1 : 0;
        hls.currentLevel = highestIdx;
        setActiveLevel(highestIdx);
        setRealLevel(highestIdx);

        // ── Pistas de audio ────────────────────────────────────────────────
        const tracks = hls.audioTracks ?? [];
        setAudioTracks(tracks);
        if (tracks.length > 0) {
          const esIdx = findSpanishTrack(tracks);
          if (esIdx >= 0 && esIdx !== hls.audioTrack) {
            hls.audioTrack = esIdx;
            setActiveAudio(esIdx);
          } else {
            setActiveAudio(hls.audioTrack);
          }
        }

        video.play().catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, { level }) => {
        // Actualiza el nivel real que ABR está usando (para el badge)
        setRealLevel(level);
      });

      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, { id }) => setActiveAudio(id));

      hls.on(Hls.Events.FRAG_LOADED, () => {
        const bw = hls.bandwidthEstimate;
        if (bw > 0) setBandwidth((bw / 1_000_000).toFixed(1));
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else { setError(`Error: ${data.details}`); setLoading(false); }
        }
      });

      hlsRef.current = hls;

    } else if (streamType === 'hls' && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => { setLoading(false); video.play().catch(() => {}); }, { once: true });

    } else {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => setLoading(false), { once: true });
      video.addEventListener('error', () => { setError('No se pudo cargar el video.'); setLoading(false); }, { once: true });
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (torrentRef.current) {
        torrentRef.current.destroy();
        torrentRef.current = null;
      }
    };
  }, [streamUrl, streamType]);

  // Cleanup: Destruir WebTorrent client cuando el componente se desmonte
  useEffect(() => {
    return () => {
      if (torrentClientRef.current) {
        console.log('[WebTorrent] 🧹 Limpiando cliente WebTorrent');
        torrentClientRef.current.destroy();
        torrentClientRef.current = null;
      }
    };
  }, []);

  // Cerrar menús al clicar fuera
  useEffect(() => {
    if (!showQuality && !showAudio) return;
    const close = (e) => { setShowQuality(false); setShowAudio(false); };
    document.addEventListener('click', close, { once: true });
    return () => document.removeEventListener('click', close);
  }, [showQuality, showAudio]);

  // Badge de calidad: muestra el nivel activo (siempre un nivel fijo, sin Auto)
  const displayIdx  = activeLevel >= 0 ? activeLevel : realLevel;
  const qualityLabel = levels[displayIdx]?.height ? `${levels[displayIdx].height}p` : '…';

  const audioLabel = audioTracks[activeAudio] ? getLangName(audioTracks[activeAudio]) : null;

  // Si es un iframe embebido, renderizar iframe directamente
  if (streamType === 'embed') {
    return (
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          borderRadius: isFullscreen ? 0 : 12,
          overflow: 'hidden',
          background: '#000',
          ...(isFullscreen ? { height: '100vh' } : { minHeight: 300 }),
        }}
      >
        <iframe
          src={streamUrl}
          style={{
            width: '100%',
            height: isFullscreen ? '100vh' : '540px',
            border: 'none',
            display: 'block',
          }}
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title={title}
        />
        
        {/* Botón de pantalla completa para iframe */}
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 20,
        }}>
          <ControlBadge
            label={isFullscreen ? '⊡ Salir' : '⛶ Pantalla completa'}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            onClick={toggleFullscreen}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        borderRadius: isFullscreen ? 0 : 12,
        overflow: 'hidden',
        background: '#000',
        ...(isFullscreen ? { height: '100vh', display: 'flex', alignItems: 'center' } : { minHeight: 300 }),
      }}
    >

      {/* ── Cargando ── */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16, background: '#000', minHeight: 300,
        }}>
          <div className="spinner" />
          <span style={{ color: '#555', fontSize: '0.85rem' }}>Buffering…</span>
        </div>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 12, background: '#000', padding: 24, textAlign: 'center',
        }}>
          <span style={{ fontSize: '2rem' }}>⚠️</span>
          <p style={{ color: '#f87171', fontSize: '0.9rem', maxWidth: 360 }}>{error}</p>
        </div>
      )}

      {/* ── Controles OSD (esquina superior derecha) ── */}
      {!loading && !error && (
        <div
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 20,
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Selector de CALIDAD ── */}
          {levels.length > 1 && (
            <div style={{ position: 'relative' }}>
              <ControlBadge
                label={`⚙️ ${qualityLabel} ▾`}
                title="Cambiar calidad de video"
                onClick={(e) => { e.stopPropagation(); setShowQuality((v) => !v); setShowAudio(false); }}
              />
              {showQuality && (
                <PopupMenu title="Calidad de video">
                  {[...levels].reverse().map((lvl, rIdx) => {
                    const origIdx = levels.length - 1 - rIdx;
                    const bitrate = lvl.bitrate ? `${Math.round(lvl.bitrate / 1000)} kbps` : '';
                    return (
                      <MenuOption
                        key={origIdx}
                        label={lvl.height ? `${lvl.height}p` : `Nivel ${origIdx}`}
                        isActive={activeLevel === origIdx}
                        onClick={() => switchQuality(origIdx)}
                        extra={bitrate}
                      />
                    );
                  })}
                </PopupMenu>
              )}
            </div>
          )}

          {/* ── Selector de AUDIO ── */}
          {audioTracks.length > 1 && (
            <div style={{ position: 'relative' }}>
              <ControlBadge
                label={`🔊 ${audioLabel ?? 'Audio'} ▾`}
                title="Cambiar idioma de audio"
                onClick={(e) => { e.stopPropagation(); setShowAudio((v) => !v); setShowQuality(false); }}
              />
              {showAudio && (
                <PopupMenu title="Idioma de audio">
                  {audioTracks.map((track, idx) => (
                    <MenuOption
                      key={idx}
                      label={getLangName(track)}
                      isActive={idx === activeAudio}
                      onClick={() => switchAudio(idx)}
                    />
                  ))}
                </PopupMenu>
              )}
            </div>
          )}

          {/* Botón de pantalla completa — usa el contenedor, no el video nativo */}
          <ControlBadge
            label={isFullscreen ? '⊡ Salir' : '⛶ Pantalla completa'}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            onClick={toggleFullscreen}
          />

          {/* Badge de velocidad / progreso torrent */}
          {streamType === 'torrent' && (torrentProgress > 0 || torrentSpeed > 0) && (
            <span style={{
              background: 'rgba(0,0,0,0.75)',
              color: '#fff', fontSize: '0.63rem', fontWeight: 600,
              padding: '3px 10px', borderRadius: 99,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              🧲 {torrentProgress}% • ↓{torrentSpeed} KB/s • 👥{torrentPeers}
            </span>
          )}
          {streamType !== 'torrent' && bandwidth && (
            <span style={{
              background: 'rgba(0,0,0,0.6)',
              color: 'rgba(255,255,255,0.35)', fontSize: '0.63rem',
              padding: '2px 8px', borderRadius: 99,
            }}>
              {bandwidth} Mbps
            </span>
          )}
        </div>
      )}

      <video
        ref={videoRef}
        controls
        controlsList="nofullscreen"
        preload="auto"
        playsInline
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          background: '#000',
          objectFit: 'contain',
        }}
        title={title}
      />
    </div>
  );
}
