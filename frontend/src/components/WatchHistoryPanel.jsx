/**
 * components/WatchHistoryPanel.jsx
 * Panel lateral con el historial de reproducción del usuario.
 * Muestra posters, título, progreso y botón para retomar.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getWatchHistory } from '../lib/db';

export default function WatchHistoryPanel({ onMovieClick, type }) {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getWatchHistory(user.id).then((data) => {
      setHistory(data);
      setLoading(false);
    });
  }, [user]);

  if (!user) return null;
  if (loading) return null;
  if (history.length === 0) return null;

  return (
    <div style={{ marginBottom: 40 }}>
      <p className="section-title">Continuar viendo</p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 12,
      }}>
        {history.slice(0, 8).map((item) => (
          <HistoryCard key={item.id} item={item} onClick={onMovieClick} />
        ))}
      </div>
    </div>
  );
}

function HistoryCard({ item, onClick }) {
  const poster = item.poster_path
    ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
    : null;

  const fakeMovie = {
    id:           item.tmdb_id,
    title:        item.title,
    name:         item.title,
    poster_path:  item.poster_path,
    release_date: item.year ? `${item.year}-01-01` : null,
    first_air_date: item.year ? `${item.year}-01-01` : null,
    overview:     '',
    vote_average: null,
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(fakeMovie, item.media_type)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(fakeMovie, item.media_type)}
      style={{
        borderRadius: 10, overflow: 'hidden',
        cursor: 'pointer', position: 'relative',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.03)';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.6)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
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
      {item.progress_pct > 0 && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.15)' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(item.progress_pct, 100)}%`,
            background: 'var(--accent)',
            borderRadius: 2,
          }} />
        </div>
      )}

      {/* Overlay con título */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
        padding: '20px 10px 8px',
      }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 600, lineHeight: 1.3, color: '#fff' }}>
          {item.title}
        </p>
        {item.progress_pct > 0 && (
          <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            {Math.round(item.progress_pct)}% visto
          </p>
        )}
      </div>
    </div>
  );
}
