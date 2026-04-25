import { useState, useCallback } from 'react';
import { useMusic } from '../context/MusicContext';
import { API_BASE_URL } from '../config';

const TRENDING_SEARCHES = [
  'Bad Bunny', 'Taylor Swift', 'Peso Pluma', 'Grupo Frontera',
  'Shakira', 'Maluma', 'Karol G', 'J Balvin', 'Luis Miguel', 'Feid',
];

function SongRow({ song, index, isActive, isPlaying, onPlay }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onPlay(song)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
        background: isActive ? 'rgba(29,185,84,0.1)' : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* Index / Play icon */}
      <div style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
        {isActive && isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
        ) : hovered ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
        ) : (
          <span style={{ fontSize: '0.85rem', color: isActive ? '#1DB954' : 'rgba(255,255,255,0.4)' }}>
            {index + 1}
          </span>
        )}
      </div>
      {/* Thumbnail */}
      <img
        src={song.thumbnail}
        alt={song.title}
        style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
        onError={e => { e.target.src = 'https://via.placeholder.com/44?text=♪'; }}
      />
      {/* Info */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{
          fontSize: '0.92rem', fontWeight: 600,
          color: isActive ? '#1DB954' : '#fff',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{song.title}</div>
        <div style={{
          fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{song.artist}</div>
      </div>
      {/* Duration */}
      <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
        {song.duration}
      </span>
    </div>
  );
}

export default function MusicDashboard() {
  const { playSong, currentSong, isPlaying } = useMusic();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await fetch(`${API_BASE_URL}/music/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) {
        setResults(data.songs);
      } else {
        setError('Error buscando música.');
      }
    } catch {
      setError('Error de conexión. ¿El servidor está encendido?');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    search(query);
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '30px 20px 120px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>🎵</div>
        <h1 style={{
          fontSize: '2rem', fontWeight: 800, margin: 0,
          background: 'linear-gradient(135deg, #1DB954, #1ed760)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
        }}>Música</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 6, fontSize: '0.95rem' }}>
          Escucha lo que quieras, gratis y sin anuncios
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
            width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            type="text"
            placeholder="Busca artistas, canciones o géneros..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%', padding: '14px 14px 14px 44px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, color: '#fff', fontSize: '0.95rem',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#1DB954'; }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          />
        </div>
        <button type="submit" style={{
          padding: '14px 24px', background: '#1DB954', color: '#000',
          border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem',
        }}>
          Buscar
        </button>
      </form>

      {/* Trending chips */}
      {!searched && (
        <>
          <div style={{ marginBottom: 12, color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.08em' }}>
            TENDENCIAS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
            {TRENDING_SEARCHES.map(t => (
              <button
                key={t}
                onClick={() => { setQuery(t); search(t); }}
                style={{
                  padding: '8px 16px', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 99,
                  color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '0.85rem',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.target.style.background = 'rgba(29,185,84,0.15)'; e.target.style.borderColor = '#1DB954'; }}
                onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.06)'; e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              >
                {t}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#1DB954', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>Buscando múscia...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ textAlign: 'center', color: '#ff4d4d', padding: 40 }}>{error}</div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div>
          <div style={{ marginBottom: 12, color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.08em' }}>
            RESULTADOS — {results.length} canciones
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {results.map((song, i) => (
              <SongRow
                key={song.id}
                song={song}
                index={i}
                isActive={currentSong?.id === song.id}
                isPlaying={isPlaying}
                onPlay={s => playSong(s, results)}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && searched && results.length === 0 && !error && (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 60 }}>
          No se encontraron resultados para "{query}"
        </div>
      )}
    </div>
  );
}
