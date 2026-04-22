/**
 * components/MovieRow.jsx
 * Fila horizontal scrolleable estilo Netflix para una categoría.
 * - Botones ‹ › para navegar sin trackpad
 * - Filtra automáticamente contenido sin poster o sin lanzar
 * - Skeletons mientras carga
 */
import { useRef, useState, useEffect } from 'react';
import MovieCard from './MovieCard';
import { tmdb } from '../lib/api';

const TODAY = new Date().toISOString().split('T')[0]; // "2026-04-21"

/** Descarta trailers / no lanzados */
function isReleased(item) {
  const date = item.release_date ?? item.first_air_date ?? '';
  if (!date || date > TODAY) return false;
  if (!item.poster_path) return false;
  if ((item.vote_count ?? 0) < 5) return false;
  return true;
}

function SkeletonRow() {
  return (
    <div className="movie-row-track" style={{ gap: 12, overflowX: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ minWidth: 140, height: 210, borderRadius: 10, flexShrink: 0 }}
        />
      ))}
    </div>
  );
}

export default function MovieRow({ title, type, tmdbType, genre, country, fetchFn, onMovieClick }) {
  const trackRef = useRef(null);
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  // tmdbType permite que filas de Anime/KDrama usen 'movie' o 'tv' independientemente del tab
  const resolvedType = tmdbType ?? type;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const fetcher = fetchFn
      ? fetchFn()
      : (genre || country)
        ? tmdb.discover(resolvedType, genre ?? '', 1, country ?? '')
        : tmdb.trending(resolvedType, 'week');

    fetcher
      .then(({ data }) => {
        if (cancelled) return;
        const raw = data.data?.results ?? [];
        setItems(raw.filter(isReleased));
      })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [resolvedType, genre, country]);

  function scroll(dir) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 600, behavior: 'smooth' });
  }

  if (!loading && items.length === 0) return null; // si no hay nada, no mostrar la sección

  return (
    <section style={{ marginBottom: 40 }}>
      {/* ── Título de sección ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>{title}</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="row-arrow" onClick={() => scroll(-1)} aria-label="Anterior">‹</button>
          <button className="row-arrow" onClick={() => scroll(1)}  aria-label="Siguiente">›</button>
        </div>
      </div>

      {/* ── Pista de scroll ── */}
      {loading ? <SkeletonRow /> : (
        <div ref={trackRef} className="movie-row-track">
          {items.map((movie) => (
            <div key={movie.id} style={{ minWidth: 140, flexShrink: 0 }}>
              <MovieCard movie={movie} type={type} onClick={onMovieClick} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
