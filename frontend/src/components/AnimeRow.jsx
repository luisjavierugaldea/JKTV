/**
 * components/AnimeRow.jsx
 * Fila horizontal de anime usando AnimeAV1 API
 * Busca automáticamente por términos específicos de cada categoría
 */
import { useRef, useState, useEffect } from 'react';
import MovieCard from './MovieCard';
import { anime as animeApi } from '../lib/api';

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

export default function AnimeRow({ title, searchTerms, onAnimeClick }) {
  const trackRef = useRef(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Probar cada término de búsqueda hasta encontrar resultados
    async function fetchAnime() {
      for (const term of searchTerms) {
        if (cancelled) return;
        
        try {
          const { data } = await animeApi.search(term);
          const results = data.data?.results ?? [];
          
          if (results.length > 0) {
            // Normalizar al formato esperado por MovieCard
            const normalized = results.map(item => ({
              ...item,
              name: item.title,
              poster_path: item.image || null,
              first_air_date: item.year ? `${item.year}-01-01` : null,
              vote_average: item.score || 0,
              vote_count: 100,
            }));
            
            if (!cancelled) {
              setItems(normalized);
              setLoading(false);
            }
            return; // Salir después de encontrar resultados
          }
        } catch (err) {
          console.error(`Error buscando anime con término "${term}":`, err);
        }
      }
      
      // Si llegamos aquí, no se encontraron resultados
      if (!cancelled) {
        setItems([]);
        setLoading(false);
      }
    }

    fetchAnime();

    return () => { cancelled = true; };
  }, [searchTerms]);

  function scroll(dir) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 600, behavior: 'smooth' });
  }

  if (!loading && items.length === 0) return null;

  return (
    <section style={{ marginBottom: 40 }}>
      {/* Título de sección */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>{title}</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="row-arrow" onClick={() => scroll(-1)} aria-label="Anterior">‹</button>
          <button className="row-arrow" onClick={() => scroll(1)} aria-label="Siguiente">›</button>
        </div>
      </div>

      {/* Pista de scroll */}
      {loading ? <SkeletonRow /> : (
        <div ref={trackRef} className="movie-row-track">
          {items.map((anime) => (
            <div key={anime.id || anime.slug} style={{ minWidth: 140, flexShrink: 0 }}>
              <MovieCard movie={anime} type="anime" onClick={onAnimeClick} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
