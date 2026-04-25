import { useMusic } from '../context/MusicContext';

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function GlobalAudioPlayer() {
  const {
    currentSong, isPlaying, currentTime, duration, volume,
    loadingAudio, togglePlay, seek, playNext, playPrev, setVolume
  } = useMusic();

  if (!currentSong) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="global-player-container">
      {/* Barra de progreso miniatura (solo visible en móviles arriba del reproductor) */}
      <div className="mobile-progress-bar" onClick={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        seek(ratio * duration);
      }}>
        <div className="mobile-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Info de la canción */}
      <div className="player-section player-info">
        <img
          src={currentSong.thumbnail}
          alt={currentSong.title}
          className="player-thumbnail"
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div className="player-text">
          <div className="player-title">{currentSong.title}</div>
          <div className="player-artist">{currentSong.artist}</div>
        </div>
      </div>

      {/* Controles principales y barra de progreso de escritorio */}
      <div className="player-section player-controls-wrapper">
        <div className="player-controls">
          <button onClick={playPrev} className="player-btn prev-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>
          
          <button onClick={togglePlay} disabled={loadingAudio} className={`player-btn play-btn ${loadingAudio ? 'loading' : ''}`}>
            {loadingAudio ? (
              <div className="spinner" />
            ) : isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          
          <button onClick={playNext} className="player-btn next-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 3.9V8.1L8.5 12zM16 6h2v12h-2z" />
            </svg>
          </button>
        </div>

        <div className="desktop-progress">
          <span className="time-text">{fmt(currentTime)}</span>
          <div
            className="progress-track"
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              seek(ratio * duration);
            }}
          >
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="time-text">{fmt(duration)}</span>
        </div>
      </div>

      {/* Control de volumen */}
      <div className="player-section player-volume">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
        </svg>
        <input
          type="range" min="0" max="1" step="0.01"
          value={volume}
          onChange={e => setVolume(parseFloat(e.target.value))}
          className="volume-slider"
        />
      </div>

      <style>{`
        /* Contenedor base */
        .global-player-container {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          background: rgba(15, 12, 25, 0.97);
          backdrop-filter: blur(24px);
          border-top: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 24px;
          box-shadow: 0 -8px 40px rgba(0,0,0,0.6);
          height: 80px;
          box-sizing: border-box;
        }

        /* Secciones */
        .player-section {
          display: flex;
          align-items: center;
        }

        .player-info {
          flex: 1;
          min-width: 0; /* Para evitar overflow de texto */
          gap: 12px;
          justify-content: flex-start;
        }

        .player-controls-wrapper {
          flex: 2;
          flex-direction: column;
          gap: 8px;
          max-width: 500px;
        }

        .player-volume {
          flex: 1;
          gap: 8px;
          justify-content: flex-end;
        }

        /* Textos */
        .player-thumbnail {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          object-fit: cover;
          flex-shrink: 0;
        }
        
        .player-text {
          overflow: hidden;
        }

        .player-title {
          font-size: 0.88rem;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .player-artist {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.5);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Botones */
        .player-controls {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .player-btn {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .player-btn:hover {
          color: #fff;
        }

        .play-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: white;
          color: #000;
        }

        .play-btn:hover {
          transform: scale(1.05);
          background: #fff;
          color: #000;
        }

        .play-btn.loading {
          background: rgba(255,255,255,0.1);
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #000;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        /* Progreso Desktop */
        .desktop-progress {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .time-text {
          font-size: 0.7rem;
          color: rgba(255,255,255,0.4);
          min-width: 32px;
          text-align: center;
        }

        .progress-track {
          flex: 1;
          height: 4px;
          background: rgba(255,255,255,0.15);
          border-radius: 4px;
          cursor: pointer;
          position: relative;
        }

        .progress-fill {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          background: #1DB954;
          border-radius: 4px;
          transition: width 0.1s linear;
        }

        .volume-slider {
          width: 80px;
          accent-color: #1DB954;
          cursor: pointer;
        }

        /* Progreso Mobile */
        .mobile-progress-bar {
          display: none;
          position: absolute;
          top: -2px;
          left: 0;
          width: 100%;
          height: 2px;
          background: rgba(255,255,255,0.1);
          cursor: pointer;
        }

        .mobile-progress-fill {
          height: 100%;
          background: #1DB954;
          transition: width 0.1s linear;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        /* ======== MEDIA QUERIES ======== */
        @media (max-width: 600px) {
          .global-player-container {
            padding: 8px 12px;
            height: 64px;
            gap: 10px;
          }

          .player-thumbnail {
            width: 40px;
            height: 40px;
          }

          /* Ocultar elementos de escritorio */
          .player-volume, 
          .desktop-progress,
          .prev-btn {
            display: none !important;
          }

          /* Mostrar barra de progreso arriba */
          .mobile-progress-bar {
            display: block;
          }

          .player-controls-wrapper {
            flex: 0; /* Para que solo ocupe el ancho de sus botones */
          }

          .player-controls {
            gap: 12px; /* Reducir gap en móviles */
          }

          .play-btn {
            width: 36px;
            height: 36px;
          }
        }
      `}</style>
    </div>
  );
}
