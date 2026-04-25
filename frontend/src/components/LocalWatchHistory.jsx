import { useState, useEffect } from 'react';

export default function LocalWatchHistory({ onMovieClick }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('jktv_continue_watching');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  if (history.length === 0) return null;

  return (
    <div style={{ marginBottom: 40, width: '100%', overflow: 'hidden' }}>
      <p className="section-title">Último Visto (Continuar Viendo)</p>
      <div style={{
        display: 'flex',
        gap: 16,
        overflowX: 'auto',
        paddingBottom: 16,
        scrollbarWidth: 'thin'
      }}>
        {history.map((item, idx) => (
          <HistoryCard key={idx} item={item} onClick={onMovieClick} />
        ))}
      </div>
    </div>
  );
}

function HistoryCard({ item, onClick }) {
  const poster = item.poster_path?.startsWith('http') 
    ? item.poster_path 
    : item.poster_path 
      ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
      : null;

  const fakeMovie = {
    id: item.id,
    title: item.title,
    name: item.title,
    poster_path: item.poster_path,
    url: item.type === 'anime' ? item.id : undefined, // Para anime
    overview: '',
  };

  const progressPct = (item.currentTime / item.duration) * 100;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(fakeMovie, item.type)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(fakeMovie, item.type)}
      style={{
        flex: '0 0 auto',
        width: 140,
        borderRadius: 10, overflow: 'hidden',
        cursor: 'pointer', position: 'relative',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.zIndex = 10;
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.6)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.zIndex = 1;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {poster
        ? <img src={poster} alt={item.title} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
        : (
          <div style={{
            width: '100%', aspectRatio: '2/3',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            fontSize: '2rem',
          }}>🎬</div>
        )
      }

      {/* Barra de progreso */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.2)' }}>
        <div style={{
          height: '100%',
          width: `${Math.min(progressPct, 100)}%`,
          background: '#e50914',
          borderRadius: 2,
        }} />
      </div>

      {/* Overlay con título */}
      <div style={{
        position: 'absolute', bottom: 4, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
        padding: '20px 10px 8px',
      }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.3, color: '#fff', textShadow: '0 1px 3px black' }}>
          {item.title}
        </p>
        <p style={{ fontSize: '0.65rem', color: '#ccc', marginTop: 2 }}>
          {item.season ? `S${item.season} E${item.episode} • ` : ''}{Math.round(progressPct)}%
        </p>
      </div>
    </div>
  );
}
