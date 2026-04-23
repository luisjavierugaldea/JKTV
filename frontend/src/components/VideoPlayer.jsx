/**
 * components/VideoPlayer.jsx
 * Reproductor HLS/MP4/WebTorrent con:
 * - Selector de CALIDAD nativo tipo Netflix (⚙️ engranaje)
 * - Selector de IDIOMA de audio (🔊)
 * - Auto-selección de español al cargar
 * - Buffer agresivo + retries automáticos
 * - Badge de velocidad en tiempo real
 * - Soporte para torrents vía WebTorrent (🧲) y Capacitor para APKs nativos
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { API_BASE_URL } from '../config.js';
import { Capacitor } from '@capacitor/core'; // 👈 Importación nativa agregada
import { CapacitorVideoPlayer } from 'capacitor-video-player';

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
  maxBufferLength: 120,
  maxMaxBufferLength: 180,
  maxBufferSize: 500 * 1024 * 1024,
  maxBufferHole: 0.5,
  backBufferLength: 30,
  startFragPrefetch: true,
  progressive: true,
  enableWorker: true,
  lowLatencyMode: false,

  // ── ABR ────────────────────────────────────────────────────────────────────
  abrEwmaDefaultEstimate: 50_000_000,
  startLevel: -1,
  capLevelToPlayerSize: false,
  abrBandWidthFactor: 0.75,
  abrBandWidthUpFactor: 0.95,
  abrEwmaFast: 8.0,
  abrEwmaSlow: 20.0,
  abrEwmaFastLive: 5.0,
  abrEwmaSlowLive: 12.0,

  // ── Tiempos / reintentos ───────────────────────────────────────────────────
  manifestLoadingTimeOut: 20_000,
  manifestLoadingMaxRetry: 4,
  levelLoadingTimeOut: 20_000,
  levelLoadingMaxRetry: 4,
  fragLoadingTimeOut: 20_000,
  fragLoadingMaxRetry: 6,
  fragLoadingRetryDelay: 300,
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
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);
  const torrentClientRef = useRef(null);
  const torrentRef = useRef(null);

  const [error, setError] = useState(null);
  const [nativeUrl, setNativeUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [levels, setLevels] = useState([]);
  const [activeLevel, setActiveLevel] = useState(0);
  const [audioTracks, setAudioTracks] = useState([]);
  const [activeAudio, setActiveAudio] = useState(-1);
  const [bandwidth, setBandwidth] = useState(null);
  const [realLevel, setRealLevel] = useState(0);
  const [showQuality, setShowQuality] = useState(false);
  const [showAudio, setShowAudio] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [torrentProgress, setTorrentProgress] = useState(0);
  const [torrentSpeed, setTorrentSpeed] = useState(0);
  const [torrentPeers, setTorrentPeers] = useState(0);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const switchQuality = useCallback((levelIdx) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelIdx;
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
    setNativeUrl(null);

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    if (torrentRef.current) {
      torrentRef.current.destroy();
      torrentRef.current = null;
    }

    const isTorrentOrMkv = streamType === 'torrent' || streamUrl.toLowerCase().includes('.mkv');

    // 🛑 DIVISIÓN DE ENTORNOS: Capacitor (APK/TV) vs Web (Navegador) 🛑
    if (Capacitor.isNativePlatform() && isTorrentOrMkv) {
      console.log('[Player] 📱 Entorno Nativo: Reproduciendo internamente...');
      setLoading(false);

      let finalUrl = streamUrl;
      if (streamType === 'torrent') {
        const backendURL = API_BASE_URL.replace('/api', '');
        finalUrl = `${backendURL}/api/torrent/stream?magnet=${encodeURIComponent(streamUrl)}&raw=true`;
      }

      // Lanzar el reproductor interno nativo
      const playVideo = async () => {
        try {
          await CapacitorVideoPlayer.initPlayer({
            mode: 'fullscreen',
            url: finalUrl,
            playerId: 'jktv-player',
            componentTag: 'jktv-video'
          });
        } catch (err) {
          console.error("Error al abrir reproductor interno:", err);
          setError('Error al iniciar el reproductor nativo.');
        }
      };

      playVideo();

      return () => { };
    }

    // ── MODO WEB: Transformar Torrents a HLS ──
    let activeStreamType = streamType;
    let activeStreamUrl = streamUrl;

    if (streamType === 'torrent') {
      const backendURL = API_BASE_URL.replace('/api', '');
      const infoHashMatch = streamUrl.match(/urn:btih:([a-f0-9]{40})/i);
      if (infoHashMatch) {
        console.log('[Player] 🧲 Torrent detectado, enrutando a HLS del backend');
        activeStreamType = 'hls';
        activeStreamUrl = `${backendURL}/api/torrent/hls/${infoHashMatch[1].toLowerCase()}/master.m3u8?magnet=${encodeURIComponent(streamUrl)}`;
      }
    }

    if (activeStreamType === 'hls' && Hls.isSupported()) {
      const hls = new Hls(HLS_CONFIG);
      hls.loadSource(activeStreamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setLoading(false);

        const lvls = hls.levels ?? [];
        setLevels(lvls);
        const highestIdx = lvls.length > 0 ? lvls.length - 1 : 0;
        hls.currentLevel = highestIdx;
        setActiveLevel(highestIdx);
        setRealLevel(highestIdx);

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

        video.play().catch(() => { });
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, { level }) => {
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
      video.addEventListener('loadedmetadata', () => { setLoading(false); video.play().catch(() => { }); }, { once: true });

    } else {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => setLoading(false), { once: true });
      video.addEventListener('error', () => { setError('No se pudo cargar el video.'); setLoading(false); }, { once: true });
      video.play().catch(() => { });
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

  useEffect(() => {
    return () => {
      if (torrentClientRef.current) {
        console.log('[WebTorrent] 🧹 Limpiando cliente WebTorrent');
        torrentClientRef.current.destroy();
        torrentClientRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!showQuality && !showAudio) return;
    const close = (e) => { setShowQuality(false); setShowAudio(false); };
    document.addEventListener('click', close, { once: true });
    return () => document.removeEventListener('click', close);
  }, [showQuality, showAudio]);

  const displayIdx = activeLevel >= 0 ? activeLevel : realLevel;
  const qualityLabel = levels[displayIdx]?.height ? `${levels[displayIdx].height}p` : '…';
  const audioLabel = audioTracks[activeAudio] ? getLangName(audioTracks[activeAudio]) : null;

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

      {/* ── Error o Mensaje Nativo ── */}
      {(error || nativeUrl) && !loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16, background: '#000', padding: 24, textAlign: 'center',
        }}>
          <span style={{ fontSize: nativeUrl ? '3rem' : '2rem' }}>
            {nativeUrl ? '🍿' : '⚠️'}
          </span>
          <p style={{ color: nativeUrl ? '#4ade80' : '#f87171', fontSize: '1rem', maxWidth: 360, margin: 0 }}>
            {error || 'Lanzando reproductor...'}
          </p>
          {nativeUrl && (
            <a
              href={nativeUrl}
              style={{
                marginTop: 12, padding: '10px 20px', background: '#e50914',
                color: '#fff', borderRadius: '8px', textDecoration: 'none',
                fontWeight: 'bold', border: '1px solid #ff4d4d'
              }}
            >
              Abrir VLC Manualmente
            </a>
          )}
        </div>
      )}

      {/* ── Controles OSD (esquina superior derecha) ── */}
      {!loading && !error && !nativeUrl && (
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

          {/* ── Botón VLC Desktop ── */}
          {streamType !== 'embed' && (
            <ControlBadge
              label="🍿 VLC"
              title="Abrir en reproductor VLC de escritorio"
              onClick={(e) => {
                e.stopPropagation();
                let finalUrl = streamUrl;
                if (streamType === 'torrent') {
                  const backendURL = API_BASE_URL.replace('/api', '');
                  finalUrl = `${backendURL}/api/torrent/stream?magnet=${encodeURIComponent(streamUrl)}&raw=true`; // 👈 Agregamos raw=true
                }
                window.location.href = `vlc://${finalUrl}`;
              }}
              style={{ background: 'rgba(255,113,0,0.15)', borderColor: 'rgba(255,113,0,0.3)', color: '#ffaf7a' }}
            />
          )}

          <ControlBadge
            label={isFullscreen ? '⊡ Salir' : '⛶ Pantalla completa'}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            onClick={toggleFullscreen}
          />

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