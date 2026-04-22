/**
 * components/MovieGrid.jsx
 * Grid responsivo de tarjetas de películas/series.
 * Muestra skeletons mientras carga.
 */
import MovieCard from './MovieCard';

const SKELETON_COUNT = 12;

function SkeletonGrid() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: 16,
    }}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}

export default function MovieGrid({ movies, loading, error, type, onMovieClick }) {
  if (loading) return <SkeletonGrid />;

  if (error) {
    return (
      <div style={{
        textAlign: 'center', padding: '60px 20px',
        color: 'var(--text-muted)',
      }}>
        <p style={{ fontSize: '2rem', marginBottom: 12 }}>😕</p>
        <p style={{ fontSize: '1rem' }}>{error}</p>
      </div>
    );
  }

  if (!movies || movies.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '60px 20px',
        color: 'var(--text-muted)',
      }}>
        <p style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎬</p>
        <p style={{ fontSize: '1rem' }}>No se encontraron resultados.</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: 16,
    }}>
      {movies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          type={type}
          onClick={onMovieClick}
        />
      ))}
    </div>
  );
}
