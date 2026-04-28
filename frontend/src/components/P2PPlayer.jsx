/**
 * P2PPlayer.jsx — Reproductor híbrido: iframe embed o HLS directo
 */

import { useEffect, useRef, useState } from 'react';

export default function P2PPlayer({ streamUrl, channelName = 'Canal', isEmbed = false }) {
  const videoRef = useRef(null);
  const iframeRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!streamUrl) return;

    console.log(`[P2PPlayer] ▶️ Cargando: ${channelName} ${isEmbed ? '(embed)' : '(HLS)'}`);

    // Si es embed, el iframe se encarga de todo
    if (isEmbed) {
      return;
    }

    // Si es HLS directo, usar hls.js
    const video = videoRef.current;
    if (!video) return;

    // Limpiar instancia anterior
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Safari soporta HLS nativamente
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.play().catch(err => {
        console.error('[P2PPlayer] Error reproduciendo:', err);
        setError('No se pudo reproducir el video');
      });
    }
    // Otros navegadores: usar hls.js
    else {
      // Cargar hls.js dinámicamente
      if (!window.Hls) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
        script.onload = () => initHls();
        script.onerror = () => setError('Error cargando reproductor');
        document.head.appendChild(script);
      } else {
        initHls();
      }

      function initHls() {
        if (window.Hls.isSupported()) {
          const hls = new window.Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 60
          });

          hls.loadSource(streamUrl);
          hls.attachMedia(video);

          hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
            console.log('[P2PPlayer] ✅ Stream listo');
            video.play().catch(err => {
              console.error('[P2PPlayer] Error al reproducir:', err);
            });
          });

          hls.on(window.Hls.Events.ERROR, (event, data) => {
            console.error('[P2PPlayer] ❌ Error HLS:', data.type, data.details);
            if (data.fatal) {
              if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
                console.log('[P2PPlayer] Intentando recuperar del error de red...');
                hls.startLoad();
              } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
                console.log('[P2PPlayer] Intentando recuperar del error de medio...');
                hls.recoverMediaError();
              } else {
                setError('Error fatal reproduciendo el stream');
                hls.destroy();
              }
            }
          });

          hlsRef.current = hls;
        } else {
          setError('Tu navegador no soporta reproducción HLS');
        }
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, channelName, isEmbed]);

  if (!streamUrl) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📺</div>
          <p className="text-white text-xl">Selecciona un canal para comenzar</p>
        </div>
      </div>
    );
  }

  // Modo EMBED: Usar iframe (jjfutbol2.lat es más confiable que tvtvhd.com)
  if (isEmbed) {
    return (
      <div className="w-full h-full bg-black relative">
        {/* Indicador de carga */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black z-0">
          <div className="text-center space-y-4">
            <div className="text-6xl animate-pulse">📡</div>
            <p className="text-white text-lg font-medium">Cargando {channelName}...</p>
            <div className="flex space-x-2 justify-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
        
        {/* Iframe sobre el indicador (z-index mayor para que cubra al cargar) */}
        <iframe
          ref={iframeRef}
          src={streamUrl}
          className="w-full h-full absolute inset-0 z-10"
          frameBorder="0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation"
          style={{ border: 'none', backgroundColor: '#000' }}
        />
      </div>
    );
  }

  // Modo HLS: Usar video tag con hls.js
  return (
    <div className="w-full h-full bg-black relative">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-80 z-10">
          <div className="text-center p-6">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-white text-lg font-bold">{error}</p>
            <p className="text-gray-300 text-sm mt-2">Intenta con otro canal</p>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        autoPlay
        playsInline
        muted={false}
        style={{ objectFit: 'contain', backgroundColor: '#000' }}
      />
    </div>
  );
}