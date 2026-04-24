import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { API_BASE_URL } from '../config.js';
import { Capacitor } from '@capacitor/core';

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
  if (name.includes('latin') || name.includes('lat') || name.includes('mx') || name.includes('419')) return 'Español Latino';
  if (name.includes('español') || name.includes('spanish') || name.includes('spa') || name.includes('esp')) return 'Español';
  if (name.includes('castellano') || name.includes('spain') || name.includes('es-es')) return 'Castellano';
  if (name.includes('english') || name.includes('inglés') || name.includes('eng')) return 'Inglés';

  return track.name || track.lang || `Pista ${track.id ?? '?'}`;
}

function findSpanishTrack(tracks) {
  const priority = [
    (t) => /es[-_]?(419|mx|la|latin)/i.test(t.lang ?? '') || /latin|lat\b|mex|419/i.test(t.name ?? ''),
    (t) => /^(es|spa|sp|esp)$/i.test(t.lang ?? '') || /español|spanish|esp\b/i.test(t.name ?? ''),
    (t) => /castellano|spain/i.test(t.name ?? ''),
    (t) => /^es/i.test(t.lang ?? ''),
  ];

  for (const test of priority) {
    const idx = tracks.findIndex(test);
    if (idx >= 0) return idx;
  }
  return -1;
}

function formatTime(secs) {
  if (isNaN(secs) || secs < 0) return '00:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ── Iconos SVG ────────────────────────────────────────────────────────────────
const IconPlay = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>;
const IconPause = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>;
const IconVolume = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>;
const IconMute = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>;
const IconFullscreen = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>;
const IconExitFullscreen = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>;
const IconGear = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>;
const IconExternal = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>;

// ── Configuración HLS ─────────────────────────────────────────────────────────
const HLS_CONFIG = {
  maxBufferLength: 120, maxMaxBufferLength: 180, maxBufferSize: 500 * 1024 * 1024,
  maxBufferHole: 0.5, backBufferLength: 30, startFragPrefetch: true,
  progressive: true, enableWorker: true, lowLatencyMode: false,
  abrEwmaDefaultEstimate: 50_000_000, startLevel: -1, capLevelToPlayerSize: false,
  startPosition: 0,
  abrBandWidthFactor: 0.75, abrBandWidthUpFactor: 0.95,
  abrEwmaFast: 8.0, abrEwmaSlow: 20.0, abrEwmaFastLive: 5.0, abrEwmaSlowLive: 12.0,
  // ⏱️ Tiempos ampliados a 5 minutos para aguantar torrents lentos generando segmentos
  manifestLoadingTimeOut: 300_000, manifestLoadingMaxRetry: 20, manifestLoadingRetryDelay: 3000,
  levelLoadingTimeOut: 300_000, levelLoadingMaxRetry: 10, levelLoadingRetryDelay: 2000,
  fragLoadingTimeOut: 300_000, fragLoadingMaxRetry: 20, fragLoadingRetryDelay: 1000,
  xhrSetup: (xhr) => { xhr.timeout = 300_000; },
};

// ── Componentes UI ────────────────────────────────────────────────────────────
function PopupMenu({ title, children, right = 0, bottom = 'calc(100% + 15px)' }) {
  return (
    <div onClick={(e) => e.stopPropagation()} style={{
      position: 'absolute', right, bottom, background: 'rgba(15,15,20,0.95)',
      backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
      overflow: 'hidden', minWidth: 200, boxShadow: '0 16px 48px rgba(0,0,0,0.85)', zIndex: 50,
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>{title}</div>
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function MenuOption({ label, isActive, onClick, extra }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', padding: '10px 14px', background: isActive ? 'rgba(229,9,20,0.15)' : 'transparent',
      border: 'none', borderLeft: isActive ? '3px solid #e50914' : '3px solid transparent', color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
      fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background .15s',
    }} onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }} onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
      <span>{label}</span>
      {isActive && <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'rgba(229,9,20,0.3)', color: '#f87171', padding: '2px 6px', borderRadius: 99 }}>✓</span>}
      {extra && !isActive && <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>{extra}</span>}
    </button>
  );
}

// ── VideoPlayer Principal ─────────────────────────────────────────────────────
export default function VideoPlayer({ streamUrl, streamType, title }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Estados Core
  const [error, setError] = useState(null);
  const [nativeUrl, setNativeUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Estados de Reproductor
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Estados de Interfaz
  const [showControls, setShowControls] = useState(true);
  const [activeMenu, setActiveMenu] = useState(null); // 'settings', 'quality', 'audio'
  
  // Estados HLS
  const [levels, setLevels] = useState([]);
  const [activeLevel, setActiveLevel] = useState(0);
  const [audioTracks, setAudioTracks] = useState([]);
  const [activeAudio, setActiveAudio] = useState(-1);
  const [realLevel, setRealLevel] = useState(0);

  // ── Handlers de Controles ───────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play().catch(()=>{});
      else videoRef.current.pause();
    }
  }, []);

  const handleVolumeChange = useCallback((e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted && volume === 0) {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
  }, [isMuted, volume]);

  const handleSeek = useCallback((e) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current && duration > 0) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  }, [duration]);

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

  // Controlar visibilidad de los controles (Auto-hide)
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!activeMenu) setShowControls(false);
      }, 3500);
    }
  }, [isPlaying, activeMenu]);

  const handleMouseLeave = useCallback(() => {
    if (isPlaying && !activeMenu) setShowControls(false);
  }, [isPlaying, activeMenu]);

  useEffect(() => {
    if (!isPlaying) setShowControls(true);
    else handleMouseMove();
  }, [isPlaying, handleMouseMove]);

  // Cerrar menús al hacer clic fuera
  useEffect(() => {
    if (!activeMenu) return;
    const close = () => setActiveMenu(null);
    document.addEventListener('click', close, { once: true });
    return () => document.removeEventListener('click', close);
  }, [activeMenu]);

  // ── Handlers HLS ────────────────────────────────────────────────────────────
  const switchQuality = useCallback((levelIdx) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelIdx;
    setActiveLevel(levelIdx);
    setActiveMenu(null);
  }, []);

  const switchAudio = useCallback((idx) => {
    if (!hlsRef.current) return;
    hlsRef.current.audioTrack = idx;
    setActiveAudio(idx);
    setActiveMenu(null);
  }, []);

  // ── Inicialización ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;
    
    setError(null);
    setLoading(true);
    setLevels([]);
    setActiveLevel(-1);
    setAudioTracks([]);
    setActiveAudio(-1);
    setNativeUrl(null);
    setActiveMenu(null);
    setIsPlaying(false);

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const isTorrentOrMkv = streamType === 'torrent' || streamUrl.toLowerCase().includes('.mkv');

    // MODO NATIVO: Guardamos el Intent para el botón "Externo", pero forzamos HLS para reproducción interna.
    if (Capacitor.isNativePlatform() && isTorrentOrMkv) {
      let finalUrl = streamUrl;
      if (streamType === 'torrent') {
        const backendURL = API_BASE_URL.replace('/api', '');
        finalUrl = `${backendURL}/api/torrent/stream?magnet=${encodeURIComponent(streamUrl)}&raw=true`;
      }
      const urlWithoutScheme = finalUrl.replace(/^https?:\/\//i, '');
      const scheme = finalUrl.startsWith('https') ? 'https' : 'http';
      const intentUrl = `intent://${urlWithoutScheme}#Intent;package=org.videolan.vlc;action=android.intent.action.VIEW;scheme=${scheme};type=video/*;end;`;
      
      setNativeUrl(intentUrl); // Guardamos por si el usuario quiere usar el botón.
      // NO Hacemos return, dejamos que continúe para reproducirse internamente.
    }

    // Preparar URL para HLS Interno
    let activeStreamType = streamType;
    let activeStreamUrl = streamUrl;

    if (streamType === 'torrent') {
      const backendURL = API_BASE_URL.replace('/api', '');
      const infoHashMatch = streamUrl.match(/urn:btih:([a-f0-9]{40})/i);
      if (infoHashMatch) {
        const infoHash = infoHashMatch[1].toLowerCase();
        const soMatch = streamUrl.match(/[?&]so=(\d+)/i);
        const fileIdx = soMatch ? soMatch[1] : '0';
        
        activeStreamType = 'hls';
        activeStreamUrl = `${backendURL}/api/torrent/hls/${infoHash}/${fileIdx}/master.m3u8?magnet=${encodeURIComponent(streamUrl)}`;
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

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, { level }) => setRealLevel(level));
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, { id }) => setActiveAudio(id));

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else { setError(`Error de reproducción: ${data.details}`); setLoading(false); }
        }
      });

      hlsRef.current = hls;

    } else if (streamType === 'hls' && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => { setLoading(false); video.play().catch(() => { }); }, { once: true });

    } else {
      // MP4 DIRECTO
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => setLoading(false), { once: true });
      video.addEventListener('error', () => { setError('Error cargando el video. Intenta otro servidor.'); setLoading(false); }, { once: true });
      video.play().catch(() => { });
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [streamUrl, streamType]);

  const displayIdx = activeLevel >= 0 ? activeLevel : realLevel;
  const qualityLabel = levels[displayIdx]?.height ? `${levels[displayIdx].height}p` : 'Auto';
  const audioLabel = audioTracks[activeAudio] ? getLangName(audioTracks[activeAudio]) : 'Audio';

  if (streamType === 'embed') {
    return (
      <div ref={containerRef} style={{ position: 'relative', borderRadius: isFullscreen ? 0 : 12, overflow: 'hidden', background: '#000', ...(isFullscreen ? { height: '100vh' } : { minHeight: 300 }) }}>
        <iframe src={streamUrl} style={{ width: '100%', height: isFullscreen ? '100vh' : '540px', border: 'none', display: 'block' }} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" title={title} />
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 20 }}>
          <button onClick={toggleFullscreen} style={{ background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
             {isFullscreen ? <IconExitFullscreen/> : <IconFullscreen/>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <style>{`
      .custom-slider { -webkit-appearance: none; width: 100%; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; outline: none; cursor: pointer; }
      .custom-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 14px; width: 14px; border-radius: 50%; background: #e50914; cursor: pointer; transition: transform 0.1s; }
      .custom-slider::-webkit-slider-thumb:hover { transform: scale(1.3); }
      .video-controls-overlay {
        position: absolute; bottom: 0; left: 0; right: 0; padding: 40px 20px 20px;
        background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 50%, transparent 100%);
        display: flex; flex-direction: column; gap: 12px;
        opacity: 0; transition: opacity 0.3s ease; pointer-events: none; z-index: 30;
      }
      .video-controls-overlay.visible { opacity: 1; pointer-events: auto; }
      .control-btn { background: transparent; border: none; color: white; cursor: pointer; padding: 6px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.2s; flex-shrink: 0; }
      .control-btn:hover { background: rgba(255,255,255,0.15); }
      @media (max-width: 500px) {
        .volume-container { display: none !important; }
        .video-controls-overlay { padding: 40px 10px 10px; }
      }
    `}</style>
    
    <div 
      ref={containerRef} 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={togglePlay}
      style={{ 
        position: 'relative', borderRadius: isFullscreen ? 0 : 12, overflow: 'hidden', background: '#000', 
        ...(isFullscreen ? { height: '100vh', display: 'flex', alignItems: 'center' } : { minHeight: 300 }),
        cursor: showControls ? 'default' : 'none'
      }}
    >

      {loading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'rgba(0,0,0,0.7)', minHeight: 300 }}>
          <div className="spinner" />
          <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>Procesando video...</span>
        </div>
      )}

      {error && !loading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#000', padding: 24, textAlign: 'center' }}>
          <span style={{ fontSize: '2rem' }}>⚠️</span>
          <p style={{ color: '#f87171', fontSize: '1rem', maxWidth: 360, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Botón de Reproductor Externo (siempre visible arriba a la derecha si existe) */}
      {!loading && !error && (nativeUrl || streamType === 'torrent') && showControls && (
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 40 }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => {
              let finalUrl = nativeUrl;
              if (!finalUrl && streamType === 'torrent' && !Capacitor.isNativePlatform()) {
                const backendURL = API_BASE_URL.replace('/api', '');
                finalUrl = `vlc://${backendURL}/api/torrent/stream?magnet=${encodeURIComponent(streamUrl)}&raw=true`;
              }
              if (finalUrl) window.location.href = finalUrl;
            }}
            style={{
              background: 'rgba(20,20,20,0.85)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', fontSize: '0.85rem', fontWeight: 600, padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(40,40,40,0.95)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(20,20,20,0.85)'}
          >
            <IconExternal /> Abrir en VLC Externo
          </button>
        </div>
      )}

      {/* Interfaz de Controles (Abajo) */}
      <div className={`video-controls-overlay ${showControls ? 'visible' : ''}`} onClick={e => e.stopPropagation()}>
        
        {/* Barra de Progreso */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
          <input 
            type="range" className="custom-slider" 
            min={0} max={duration || 100} value={currentTime}
            onChange={handleSeek}
            style={{ 
              background: `linear-gradient(to right, #e50914 ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.3) ${(currentTime / (duration || 1)) * 100}%)` 
            }}
          />
        </div>

        {/* Fila Inferior */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
            <button className="control-btn" onClick={togglePlay}>
              {isPlaying ? <IconPause /> : <IconPlay />}
            </button>
            
            <div className="volume-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="control-btn" onClick={toggleMute}>
                {isMuted || volume === 0 ? <IconMute /> : <IconVolume />}
              </button>
              <input 
                type="range" className="custom-slider" 
                min={0} max={1} step={0.05} value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{ width: '70px', background: `linear-gradient(to right, #fff ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.3) ${(isMuted ? 0 : volume) * 100}%)` }}
              />
            </div>

            <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500, opacity: 0.9, whiteSpace: 'nowrap' }}>
              {formatTime(currentTime)} <span style={{ opacity: 0.5 }}>/</span> {formatTime(duration)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            
            {/* Menú de Configuraciones (Engrane) */}
            {(levels.length > 1 || audioTracks.length > 1) && (
              <div style={{ position: 'relative' }}>
                <button 
                  className="control-btn" 
                  onClick={() => setActiveMenu(activeMenu === 'settings' ? null : 'settings')}
                  style={{ transform: activeMenu === 'settings' ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s ease' }}
                >
                  <IconGear />
                </button>
                
                {/* Popup de Opciones Múltiples */}
                {activeMenu === 'settings' && (
                  <PopupMenu title="Configuración" right={0} bottom="calc(100% + 15px)">
                    {levels.length > 1 && (
                      <MenuOption label="Calidad" extra={qualityLabel} onClick={(e) => { e.stopPropagation(); setActiveMenu('quality'); }} />
                    )}
                    {audioTracks.length > 1 && (
                      <MenuOption label="Idioma" extra={audioLabel} onClick={(e) => { e.stopPropagation(); setActiveMenu('audio'); }} />
                    )}
                  </PopupMenu>
                )}

                {/* Sub-Popup de Calidad */}
                {activeMenu === 'quality' && (
                  <PopupMenu title="Calidad" right={0} bottom="calc(100% + 15px)">
                    <MenuOption label="← Volver" onClick={(e) => { e.stopPropagation(); setActiveMenu('settings'); }} />
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '4px 0' }} />
                    {[...levels].reverse().map((lvl, rIdx) => {
                      const origIdx = levels.length - 1 - rIdx;
                      return <MenuOption key={origIdx} label={lvl.height ? `${lvl.height}p` : `Nivel ${origIdx}`} isActive={activeLevel === origIdx} onClick={() => switchQuality(origIdx)} />;
                    })}
                  </PopupMenu>
                )}

                {/* Sub-Popup de Audio */}
                {activeMenu === 'audio' && (
                  <PopupMenu title="Idioma de Audio" right={0} bottom="calc(100% + 15px)">
                    <MenuOption label="← Volver" onClick={(e) => { e.stopPropagation(); setActiveMenu('settings'); }} />
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '4px 0' }} />
                    {audioTracks.map((track, idx) => (
                      <MenuOption key={idx} label={getLangName(track)} isActive={idx === activeAudio} onClick={() => switchAudio(idx)} />
                    ))}
                  </PopupMenu>
                )}
              </div>
            )}

            <button className="control-btn" onClick={toggleFullscreen}>
              {isFullscreen ? <IconExitFullscreen /> : <IconFullscreen />}
            </button>
          </div>

        </div>
      </div>

      <video 
        ref={videoRef} 
        preload="auto" 
        playsInline 
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onDurationChange={(e) => setDuration(e.target.duration)}
        style={{ width: '100%', height: '100%', display: 'block', background: '#000', objectFit: 'contain' }} 
        title={title} 
      />
    </div>
    </>
  );
}
