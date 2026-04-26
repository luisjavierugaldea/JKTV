/**
 * components/MovieCard.jsx
 * Tarjeta de película con poster, rating y overlay al hacer hover.
 */
export default function MovieCard({ movie, onClick, type = 'movie' }) {
  const title = movie.title ?? movie.name ?? movie.original_title ?? movie.original_name ?? '—';
  const year  = (movie.release_date ?? movie.first_air_date)?.split('-')[0];
  
  // Detectar si poster_path es una URL completa (anime) o path relativo (TMDB)
  const poster = movie.poster_path
    ? (movie.poster_path.startsWith('http') 
        ? movie.poster_path  // URL completa de anime
        : `https://image.tmdb.org/t/p/w342${movie.poster_path}`)  // Path relativo de TMDB
    : null;
  
  const rating   = movie.vote_average?.toFixed(1);

  return (
    <div className="movie-card" onClick={() => onClick(movie)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick(movie)}>

      {poster
        ? <img src={poster} alt={title} loading="lazy" />
        : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            fontSize: '3rem',
          }}>🎬</div>
        )
      }

      {rating && (
        <div className="rating-badge">⭐ {rating}</div>
      )}
      
      {year && (
        <div className="year-badge">{year}</div>
      )}

      <div className="movie-card-overlay">
        <p style={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3, marginBottom: 4 }}>
          {title}
        </p>
        {year && (
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>{year}</p>
        )}
        <button
          className="btn-primary"
          style={{ marginTop: 10, padding: '8px 14px', fontSize: '0.82rem', width: '100%', justifyContent: 'center' }}
          onClick={(e) => { e.stopPropagation(); onClick(movie); }}
        >
          ▶ Reproducir
        </button>
      </div>
    </div>
  );
}
