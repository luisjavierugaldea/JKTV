import { useState, useEffect, useCallback, useRef } from 'react';
import SearchBar from './components/SearchBar';
import MovieGrid from './components/MovieGrid';
import MovieRow from './components/MovieRow';
import AnimeRow from './components/AnimeRow';
import MovieModal from './components/MovieModal';
import AnimeModal from './components/AnimeModal';
import IptvModal from './components/IptvModal';
import IptvDashboard from './components/IptvDashboard';
import LocalWatchHistory from './components/LocalWatchHistory';
import MusicDashboard from './components/MusicDashboard';
import GlobalAudioPlayer from './components/GlobalAudioPlayer';
import { MusicProvider } from './context/MusicContext';
import { tmdb, anime as animeApi, iptv } from './lib/api';

const TODAY = new Date().toISOString().split('T')[0];

function isReleased(item, allowUnpopular = false) {
  const date = item.release_date ?? item.first_air_date ?? '';
  if (!date || date > TODAY) return false;
  if (!item.poster_path) return false;
  if (!allowUnpopular && (item.vote_count ?? 0) < 5) return false;
  return true;
}

// Géneros por tipo de contenido
const MOVIE_ROWS = [
  { id: 'trending', emoji: '🔥', label: 'En Tendencia', genre: '' },
  { id: 'toprated', emoji: '⭐', label: 'Mejor Calificadas', genre: '', fetchKey: 'top-rated' },
  { id: 'action', emoji: '💥', label: 'Acción', genre: '28' },
  { id: 'comedy', emoji: '😂', label: 'Comedia', genre: '35' },
  { id: 'horror', emoji: '😱', label: 'Terror', genre: '27' },
  { id: 'scifi', emoji: '🚀', label: 'Ciencia Ficción', genre: '878' },
  { id: 'drama', emoji: '🎭', label: 'Drama', genre: '18' },
  { id: 'animation', emoji: '🎨', label: 'Animación', genre: '16' },
  { id: 'crime', emoji: '🕵️', label: 'Crimen', genre: '80' },
  { id: 'adventure', emoji: '🗺️', label: 'Aventura', genre: '12' },
];

const TV_ROWS = [
  { id: 'trending', emoji: '🔥', label: 'En Tendencia', genre: '' },
  { id: 'toprated', emoji: '⭐', label: 'Mejor Calificadas', genre: '', fetchKey: 'top-rated' },
  { id: 'drama', emoji: '🎭', label: 'Drama', genre: '18' },
  { id: 'comedy', emoji: '😂', label: 'Comedia', genre: '35' },
  { id: 'action', emoji: '💥', label: 'Acción y Aventura', genre: '10759' },
  { id: 'mystery', emoji: '🔍', label: 'Misterio', genre: '9648' },
  { id: 'scifi', emoji: '🚀', label: 'Ciencia Ficción', genre: '10765' },
  { id: 'crime', emoji: '🕵️', label: 'Crimen', genre: '80' },
  { id: 'animation', emoji: '🎨', label: 'Animación', genre: '16' },
];

const ANIME_ROWS = [
  { id: 'popular', emoji: '🔥', label: 'Populares', searchTerms: ['one piece', 'naruto', 'dragon ball'] },
  { id: 'action', emoji: '🗡️', label: 'Acción / Shonen', searchTerms: ['shonen', 'action', 'battle'] },
  { id: 'isekai', emoji: '🌍', label: 'Isekai', searchTerms: ['isekai', 'reencarnacion'] },
  { id: 'romance', emoji: '💕', label: 'Romance', searchTerms: ['romance', 'amor'] },
  { id: 'comedy', emoji: '😂', label: 'Comedia', searchTerms: ['comedia', 'comedy'] },
  { id: 'fantasy', emoji: '🧙', label: 'Fantasía', searchTerms: ['magia', 'fantasy'] },
  { id: 'scifi', emoji: '🚀', label: 'Ciencia Ficción', searchTerms: ['mecha', 'sci-fi'] },
];

const KDRAMA_ROWS = [
  { id: 'trending', emoji: '🔥', label: 'Tendencias', tmdbType: 'tv', genre: '', country: 'KR' },
  { id: 'romance', emoji: '💕', label: 'Romance Coreano', tmdbType: 'tv', genre: '18', country: 'KR' },
  { id: 'action', emoji: '💥', label: 'Acción', tmdbType: 'tv', genre: '10759', country: 'KR' },
  { id: 'thriller', emoji: '🔍', label: 'Thriller / Misterio', tmdbType: 'tv', genre: '9648', country: 'KR' },
  { id: 'comedy', emoji: '😂', label: 'Comedia', tmdbType: 'tv', genre: '35', country: 'KR' },
  { id: 'movie', emoji: '🎬', label: 'Películas Coreanas', tmdbType: 'movie', genre: '', country: 'KR' },
];

export default function App() {
  const [type, setType] = useState('movie');
  const [movies, setMovies] = useState([]);     // solo para búsqueda
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [isFuzzy, setIsFuzzy] = useState(false);
  const [suggestedTitle, setSuggestedTitle] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedType, setSelectedType] = useState('movie');
  const [section, setSection] = useState('trending');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [heroBg, setHeroBg] = useState(null); // película para el hero banner
  const queryRef = useRef('');

  // ── Cargar hero banner desde trending ───────────────────────────────────────
  useEffect(() => {
    setHeroBg(null);
    setSection('trending');
    setMovies([]);
    setError(null);

    // Para iptv, cargar canales
    if (type === 'iptv') {
      setLoading(true);
      iptv.getChannels()
        .then(({ data }) => {
          setMovies(data.data || []);
          setTotalPages(1);
        })
        .catch((err) => {
          setError(err.response?.data?.error?.message || 'Error cargando canales de TV.');
        })
        .finally(() => setLoading(false));
    }
    // Para anime, usar AnimeAV1; para kdrama y otros, usar TMDB
    else if (type === 'anime') {
      // Buscar anime popular para el hero
      animeApi.search('one piece')
        .then(({ data }) => {
          const results = data.data?.results ?? [];
          if (results.length > 0) {
            // Normalizar al formato esperado
            const normalized = {
              ...results[0],
              name: results[0].title,
              poster_path: results[0].image || null,
              backdrop_path: results[0].backdrop || results[0].image || null,
              first_air_date: results[0].year ? `${results[0].year}-01-01` : null,
              vote_average: results[0].score || 0,
              overview: results[0].description || 'Anime popular',
            };
            setHeroBg(normalized);
          }
        })
        .catch(() => { });
    }
    // Para música o custom_iptv no cargar nada inicial de TMDB
    else if (type === 'music' || type === 'custom_iptv') {
      setMovies([]);
      setHeroBg(null);
      setTotalPages(1);
    } else {
      // TMDB para movies, tv, kdrama
      const heroFetch =
        type === 'kdrama' ? tmdb.discover('tv', '', 1, 'KR') :
          tmdb.trending(type, 'week', 1);

      heroFetch
        .then(({ data }) => {
          const results = (data.data?.results ?? []).filter(isReleased);
          setHeroBg(results[0] ?? null);
        })
        .catch(() => { });
    }
  }, [type]);

  // Tipo TMDB real para búsqueda (anime/kdrama son siempre 'tv')
  const tmdbSearchType = (type === 'anime' || type === 'kdrama') ? 'tv' : type;

  // ── Búsqueda ────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (q, signal, pg = 1) => {
    queryRef.current = q;
    if (!q) {
      setSection('trending');
      setMovies([]);
      setError(null);
      return;
    }
    setSection('search');
    if (pg === 1) { setLoading(true); setMovies([]); setIsFuzzy(false); setSuggestedTitle(null); }
    else setLoadingMore(true);
    setError(null);

    try {
      // Usar API de anime para búsquedas de anime
      if (type === 'anime') {
        const { data } = await animeApi.search(q, { signal });
        const results = data.data?.results ?? [];
        // Normalizar resultados de anime al formato esperado
        const normalized = results.map(item => ({
          ...item,
          name: item.title,
          poster_path: item.image || null,  // Mantener URL completa de AnimeAV1
          first_air_date: item.year ? `${item.year}-01-01` : null,
          vote_average: item.score || 0,
          vote_count: 100, // Simular votos para que pase el filtro
        }));
        setMovies(normalized);
        setTotalPages(1); // AnimeAV1 no tiene paginación
        setPage(1);
      } else {
        const { data } = await tmdb.search(q, tmdbSearchType, pg, { signal });
        setIsFuzzy(data.data?.isFuzzy || false);
        setSuggestedTitle(data.data?.suggestedTitle || null);
        
        let results = (data.data?.results ?? []).filter(item => isReleased(item));
        // Si el filtro estricto oculta todo, usar un filtro más flexible
        if (results.length === 0 && data.data?.results?.length > 0) {
          results = data.data.results.filter(item => isReleased(item, true));
        }
        const pages = data.data?.total_pages ?? 1;
        setMovies((prev) => pg === 1 ? results : [...prev, ...results]);
        setTotalPages(pages);
        setPage(pg);
      }
    } catch (err) {
      // Ignorar errores de peticiones canceladas (usuario sigue escribiendo)
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
      console.error('Search error:', err);
      setError('Error al buscar. Verifica que el backend esté corriendo.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [type, tmdbSearchType]);


  function loadMore() {
    handleSearch(queryRef.current, null, page + 1);
  }


  function openMovie(movie, forceType) {
    setSelected(movie);
    // kdrama son siempre series ('tv') para el backend y el scraper
    // anime ahora tiene su propio AnimeModal especializado
    const resolvedType = forceType ?? type;
    setSelectedType(
      resolvedType === 'kdrama' ? 'tv' : resolvedType
    );
  }

  const rows =
    type === 'anime' ? ANIME_ROWS :
      type === 'kdrama' ? KDRAMA_ROWS :
        type === 'tv' ? TV_ROWS : MOVIE_ROWS;
  const hasMore = page < totalPages;

  return (
    <MusicProvider>
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>

        <header className="glass" style={{ position: 'sticky', top: 0, zIndex: 100, padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{
            maxWidth: 1400, margin: '0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 70, gap: 20
          }}>
            {/* Lado Izquierdo: Logo + Nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => { setSection('trending'); setMovies([]); setType('movie'); }}>
                <img src="/logo.png" alt="JKTV Logo" style={{ height: 45, width: 45, borderRadius: 10, objectFit: 'cover', boxShadow: '0 0 20px rgba(229,9,20,0.4)' }} />
                <span style={{
                  fontWeight: 900, fontSize: '1.6rem',
                  background: 'linear-gradient(135deg, #fff, #bbb)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.04em',
                }}>JKTV</span>
              </div>

              {/* Nav Tabs Desktop */}
              <nav className="hide-mobile" style={{ display: 'flex', gap: 10 }}>
                {['movie', 'tv', 'anime', 'kdrama', 'iptv', 'music'].map(t => (
                  <button
                    key={t}
                    className={`tab-btn ${type === t ? 'active' : ''}`}
                    onClick={() => {
                      setType(t);
                      setSection('trending');
                      setMovies([]);
                    }}
                  >
                    {t === 'movie' ? 'Películas' : t === 'tv' ? 'Series' : t === 'anime' ? 'Anime' : t === 'kdrama' ? 'K-Drama' : t === 'iptv' ? '📺 TV' : '🎵 Música'}
                  </button>
                ))}
              </nav>
            </div>

            {/* Lado Derecho: Buscador */}
            <div style={{ width: '100%', maxWidth: 400 }}>
              <SearchBar key={type} onSearch={handleSearch} type={type} />
            </div>
          </div>

          {/* Nav Tabs Mobile (Solo se ve en móvil) */}
          <nav className="show-mobile" style={{ display: 'none', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto', gap: 8 }}>
            {['movie', 'tv', 'anime', 'kdrama', 'iptv', 'music'].map(t => (
              <button
                key={t}
                className={`tab-btn ${type === t ? 'active' : ''}`}
                onClick={() => {
                  setType(t);
                  setSection('trending');
                  setMovies([]);
                }}
              >
                {t === 'movie' ? '🎬 Películas' : t === 'tv' ? '📺 Series' : t === 'anime' ? '🎌 Anime' : t === 'kdrama' ? '🇰🇷 K-Drama' : t === 'iptv' ? '📺 TV' : '🎵 Música'}
              </button>
            ))}
          </nav>
        </header>

        {/* ── Hero Banner (solo en trending) ── */}
        {section === 'trending' && heroBg && type !== 'iptv' && type !== 'music' && (
          <HeroBanner movie={heroBg} type={type} onPlay={openMovie} />
        )}

        {/* ── Catálogo ── */}
        <main style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px 80px' }}>

          {/* ── BÚSQUEDA: grid plano ── */}
          {section === 'search' && (
            <>
              <p className="section-title">Resultados de búsqueda</p>

              <MovieGrid
                movies={movies}
                loading={loading}
                error={error}
                type={type}
                onMovieClick={(m) => openMovie(m)}
              />
              {!loading && !error && hasMore && movies.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}>
                  <button
                    className="btn-ghost"
                    onClick={loadMore}
                    disabled={loadingMore}
                    style={{ padding: '14px 48px', fontSize: '0.92rem', opacity: loadingMore ? 0.6 : 1 }}
                  >
                    {loadingMore
                      ? <><Spinner /> Cargando…</>
                      : `⬇ Cargar más (página ${page + 1} de ${totalPages})`}
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── TRENDING: filas por categoría ── */}
          {section === 'trending' && (type === 'movie' || type === 'tv' || type === 'anime' || type === 'kdrama') && (
            <LocalWatchHistory onMovieClick={openMovie} />
          )}

          {section === 'trending' && type === 'iptv' && (
            <IptvDashboard
              channels={movies}
              loading={loading}
              error={error}
              onRemoveChannel={(id) => setMovies(prev => prev.filter(c => c.id !== id))}
            />
          )}

          {section === 'trending' && type === 'music' && (
            <MusicDashboard />
          )}

          {section === 'trending' && type === 'anime' && rows.map((row) => (
            <AnimeRow
              key={`anime-${row.id}`}
              title={`${row.emoji} ${row.label}`}
              searchTerms={row.searchTerms}
              onAnimeClick={openMovie}
            />
          ))}

          {section === 'trending' && type !== 'anime' && type !== 'iptv' && type !== 'music' && rows.map((row) => (
            <MovieRow
              key={`${type}-${row.id}`}
              title={`${row.emoji} ${row.label}`}
              type={type}
              tmdbType={row.tmdbType}
              genre={row.genre}
              country={row.country}
              fetchFn={row.fetchKey === 'top-rated'
                ? () => tmdb.topRated(type)
                : undefined}
              onMovieClick={openMovie}
            />
          ))}
        </main>

        {/* ── Modal ── */}
        {selected && selectedType === 'iptv' ? (
          <IptvModal
            channel={selected}
            onClose={() => setSelected(null)}
          />
        ) : selected && selectedType === 'anime' && selected.url ? (
          // Usar AnimeModal solo si viene de búsqueda de AnimeAV1 (tiene URL)
          <AnimeModal
            anime={selected}
            onClose={() => setSelected(null)}
          />
        ) : selected ? (
          // Usar MovieModal para todo lo demás (TMDB, kdrama, movies, tv)
          <MovieModal
            movie={selected}
            type={selectedType}
            onClose={() => setSelected(null)}
          />
        ) : null}
        <GlobalAudioPlayer />
      </div>
    </MusicProvider>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 16, height: 16,
      border: '2px solid rgba(255,255,255,0.2)',
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      verticalAlign: 'middle', marginRight: 8,
    }} />
  );
}

/* ── Hero Banner ──────────────────────────────────────────────────────────── */
function HeroBanner({ movie, type, onPlay }) {
  const title = movie.title ?? movie.name ?? movie.original_title ?? movie.original_name ?? '';
  const year = (movie.release_date ?? movie.first_air_date)?.split('-')[0];

  // Detectar si backdrop_path es URL completa (anime) o path relativo (TMDB)
  const backdrop = movie.backdrop_path
    ? (movie.backdrop_path.startsWith('http')
      ? movie.backdrop_path  // URL completa de anime
      : `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`)  // Path relativo de TMDB
    : null;

  const overview = movie.overview?.length > 220
    ? movie.overview.slice(0, 220) + '…'
    : movie.overview;
  const rating = movie.vote_average?.toFixed(1);

  if (!backdrop) return null;

  return (
    <div style={{ position: 'relative', width: '100%', height: 480, overflow: 'hidden' }}>
      <img src={backdrop} alt={title}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to right, rgba(10,10,15,0.95) 35%, rgba(10,10,15,0.4) 70%, transparent 100%), linear-gradient(to top, rgba(10,10,15,1) 0%, transparent 45%)',
      }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, padding: '0 48px 48px', maxWidth: 620 }}>
        <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: 10 }}>
          {title}
        </h1>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {year && <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem' }}>{year}</span>}
          {rating && <span style={{ color: '#ffd700', fontWeight: 700, fontSize: '0.9rem' }}>⭐ {rating}</span>}
        </div>
        {overview && (
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.95rem', lineHeight: 1.65, marginBottom: 22 }}>
            {overview}
          </p>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-primary" onClick={() => onPlay(movie)}>▶ Reproducir</button>
          <button className="btn-ghost" onClick={() => onPlay(movie)}>ℹ️ Más info</button>
        </div>
      </div>
    </div>
  );
}
