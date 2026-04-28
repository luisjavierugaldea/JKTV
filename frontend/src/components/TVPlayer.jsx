/**
 * TVPlayer.jsx
 * Reproductor para canales de TV en vivo (M3U/HLS)
 */

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { API_BASE_URL } from '../config';

const TVPlayer = ({ streamUrl, channelName, isEmbed = false }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [useProxy, setUseProxy] = useState(false);

  // Crear URL proxeada
  const getProxiedUrl = (url) => {
    const encodedUrl = btoa(url);
    const channelId = `tv_${channelName.replace(/\s+/g, '_').substring(0, 20)}`;
    return `${API_BASE_URL}/iptv-proxy/stream?url=${encodedUrl}&channelId=${channelId}`;
  };

  useEffect(() => {
    if (!streamUrl) return;

    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setLoading(true);

    // Si es un embed, usar iframe
    if (isEmbed) {
      setLoading(false);
      return;
    }

    // Decidir qué URL usar (directa o proxeada)
    const finalUrl = useProxy ? getProxiedUrl(streamUrl) : streamUrl;

    // Para streams HLS (.m3u8)
    if (streamUrl.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          xhrSetup: (xhr, url) => {
            // Headers para evitar CORS
            xhr.withCredentials = false;
          },
        });

        hlsRef.current = hls;

        hls.loadSource(finalUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          video.play().catch((err) => {
            console.warn('Autoplay bloqueado:', err);
            setError('Haz clic en Play para iniciar');
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS Error:', data);
          
          // Si falla por CORS y no estamos usando proxy, intentar con proxy
          if (data.fatal && !useProxy) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.details === 'manifestLoadError') {
              console.log('[TVPlayer] 🔄 CORS detectado, reintentando con proxy...');
              setUseProxy(true);
              hls.destroy();
              return;
            }
          }
          
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setError('Error de red. Probando reconexión...');
                setTimeout(() => hls.startLoad(), 2000);
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setError('Error de media. Recuperando...');
                hls.recoverMediaError();
                break;
              default:
                setError('Error fatal. Intenta otro canal.');
                hls.destroy();
                break;
            }
          }
        });

        return () => {
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari nativo
        video.src = finalUrl;
        video.addEventListener('loadedmetadata', () => {
          setLoading(false);
          video.play().catch((err) => {
            console.warn('Autoplay bloqueado:', err);
            setError('Haz clic en Play para iniciar');
          });
        });

        video.addEventListener('error', (e) => {
          console.error('Video error:', e);
          // Si falla y no estamos usando proxy, intentar con proxy
          if (!useProxy) {
            console.log('[TVPlayer] 🔄 Error detectado, reintentando con proxy...');
            setUseProxy(true);
          } else {
            setError('Error al cargar el stream');
          }
        });
      } else {
        setError('Tu navegador no soporta HLS');
      }
    } else {
      // Stream directo (no HLS)
      video.src = finalUrl;
      video.addEventListener('loadedmetadata', () => {
        setLoading(false);
        video.play().catch((err) => {
          console.warn('Autoplay bloqueado:', err);
          setError('Haz clic en Play para iniciar');
        });
      });

      video.addEventListener('error', (e) => {
        console.error('Video error:', e);
        // Si falla y no estamos usando proxy, intentar con proxy
        if (!useProxy) {
          console.log('[TVPlayer] 🔄 Error detectado, reintentando con proxy...');
          setUseProxy(true);
        } else {
          setError('Error al cargar el stream');
        }
      });
    }

    return () => {
      if (video) {
        video.pause();
        video.src = '';
      }
    };
  }, [streamUrl, isEmbed, useProxy]);

  if (isEmbed) {
    return (
      <iframe
        src={streamUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        allow="autoplay; fullscreen"
        allowFullScreen
        title={channelName}
      />
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.8)',
            color: '#fff',
            zIndex: 10,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📡</div>
            <div>{useProxy ? 'Conectando vía proxy...' : 'Cargando stream...'}</div>
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.9)',
            color: '#fff',
            zIndex: 10,
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
            <div style={{ marginBottom: '1rem' }}>{error}</div>
            {!useProxy && error.includes('Error') && (
              <button
                onClick={() => setUseProxy(true)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#3b82f6',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                🔄 Reintentar con proxy
              </button>
            )}
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        controls
        autoPlay
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#000',
        }}
      />
    </div>
  );
};

export default TVPlayer;
