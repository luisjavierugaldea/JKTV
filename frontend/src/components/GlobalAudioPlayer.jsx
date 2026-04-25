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
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'rgba(15, 12, 25, 0.97)',
      backdropFilter: 'blur(24px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '10px 24px',
      boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
    }}>
      {/* Song info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 220, flex: 1 }}>
        <img
          src={currentSong.thumbnail}
          alt={currentSong.title}
          style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div style={{ overflow: 'hidden' }}>
          <div style={{
            fontSize: '0.88rem', fontWeight: 700, color: '#fff',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160,
          }}>{currentSong.title}</div>
          <div style={{
            fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160,
          }}>{currentSong.artist}</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Prev */}
          <button onClick={playPrev} style={btnStyle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>
          {/* Play/Pause */}
          <button onClick={togglePlay} disabled={loadingAudio} style={{
            ...btnStyle, width: 44, height: 44, borderRadius: '50%',
            background: loadingAudio ? 'rgba(255,255,255,0.1)' : 'white',
            color: '#000', fontSize: '1.1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {loadingAudio ? (
              <div style={{ width: 16, height: 16, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          {/* Next */}
          <button onClick={playNext} style={btnStyle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 3.9V8.1L8.5 12zM16 6h2v12h-2z" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 500 }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', minWidth: 32 }}>{fmt(currentTime)}</span>
          <div
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              seek(ratio * duration);
            }}
            style={{
              flex: 1, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 4,
              cursor: 'pointer', position: 'relative',
            }}
          >
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${progress}%`, background: '#1DB954', borderRadius: 4,
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', minWidth: 32 }}>{fmt(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
        </svg>
        <input
          type="range" min="0" max="1" step="0.01"
          value={volume}
          onChange={e => setVolume(parseFloat(e.target.value))}
          style={{ width: 80, accentColor: '#1DB954', cursor: 'pointer' }}
        />
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const btnStyle = {
  background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)',
  cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  transition: 'color 0.15s',
};
