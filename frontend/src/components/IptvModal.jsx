import { useState, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';

export default function IptvModal({ channel, onClose }) {
  // Animación de entrada
  const [anim, setAnim] = useState(false);
  useEffect(() => {
    setAnim(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  const bgStyle = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
    display: 'flex', flexDirection: 'column',
    opacity: anim ? 1 : 0, transition: 'opacity 0.3s'
  };

  const contentStyle = {
    flex: 1, display: 'flex', flexDirection: 'column',
    background: '#0a0a0f', width: '100%', height: '100%',
    transform: anim ? 'translateY(0)' : 'translateY(20px)',
    transition: 'transform 0.3s'
  };

  return (
    <div style={bgStyle}>
      <div style={contentStyle}>
        
        {/* Header con título y botón cerrar */}
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {channel.logo && (
              <img src={channel.logo} alt={channel.displayName} style={{ height: 40, width: 'auto', borderRadius: 4 }} />
            )}
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>{channel.displayName}</h2>
            <span style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              TV en Vivo
            </span>
          </div>
          
          <button onClick={() => { setAnim(false); setTimeout(onClose, 300); }} 
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
               <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Contenedor del Reproductor */}
        <div style={{ flex: 1, position: 'relative', background: '#000' }}>
          <VideoPlayer 
            streamUrl={channel.urls[0]} 
            streamType="hls" 
            poster={channel.logo}
            streamUrls={channel.urls} // Pasamos el arreglo completo para auto-fallback
          />
        </div>

      </div>
    </div>
  );
}
