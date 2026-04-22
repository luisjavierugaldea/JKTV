/**
 * components/MovieModal.jsx
 * Modal de detalle + selector de servidores + reproductor de video.
 *
 * Flujo:
 *  1. Detalle: Sinopsis y info.
 *  2. Búsqueda: Muestra spinner mientras el backend corre el scraper multi-servidor.
 *  3. Selección: Muestra ServerSelector con opciones agrupadas por idioma.
 *  4. Reproducción: Monta el VideoPlayer con el stream elegido.
 */
import { useState, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import ServerSelector from './ServerSelector';
import { stream as streamApi } from '../lib/api';

export default function MovieModal({ movie, type = 'movie', onClose }) {
  const [streams, setStreams]           = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  // Defensivo: TMDB usa 'title' para películas y 'name' para series
  const title = movie.title ?? movie.name ?? movie.original_title ?? movie.original_name ?? '';
  const year  = (movie.release_date ?? movie.first_air_date)?.split('-')[0];
  const poster   = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
  const overview = movie.overview || 'Sinopsis no disponible.';
  const rating   = movie.vote_average?.toFixed(1);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Bloquear scroll del body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Auto-buscar al abrir el modal
  useEffect(() => {
    if (title && title.trim().length >= 2) handleFindServers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFindServers({ forceRefresh = false } = {}) {
    if (!title || title.trim().length < 2) {
      setError('No se pudo identificar el título de este contenido.');
      return;
    }
    if (forceRefresh) streamApi.invalidate({ title: title.trim(), year, type });
    setLoading(true);
    setError(null);
    setStreams([]);
    setSelectedStream(null);

    try {
      const { data } = await streamApi.get({ title: title.trim(), year, type });
      if (data.success && data.streams?.length > 0) {
        setStreams(data.streams);
      } else {
        setError('No se encontraron servidores disponibles para este título.');
      }
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
        'Ocurrió un error al buscar servidores. Intenta de nuevo más tarde.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Botón Cerrar */}
        <button onClick={onClose} aria-label="Cerrar" style={{
          position: 'sticky', top: 16, float: 'right', marginRight: 16,
          background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', width: 36, height: 36, borderRadius: '50%',
          cursor: 'pointer', fontSize: '1rem', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>

        {/* Hero backdrop (se oculta si el reproductor está activo para dar espacio) */}
        {!selectedStream && poster && (
          <div style={{
            width: '100%', height: 220, overflow: 'hidden',
            position: 'relative', borderRadius: '16px 16px 0 0',
          }}>
            <img
              src={poster.replace('/w500/', '/w1280/')} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), var(--bg-card))',
            }} />
          </div>
        )}

        {/* Contenido Principal */}
        <div style={{ padding: '0 28px 32px', marginTop: (!selectedStream && poster) ? -60 : 28 }}>

          {/* Info de la película (solo si no se está reproduciendo o si es pequeño) */}
          {!selectedStream && (
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', marginBottom: 24, position: 'relative' }}>
              {poster && (
                <img src={poster} alt={title} style={{
                  width: 120, borderRadius: 12,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.9)',
                  flexShrink: 0, border: '2px solid rgba(255,255,255,0.1)',
                }} />
              )}
              <div style={{ minWidth: 0, paddingBottom: 8 }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 900, lineHeight: 1.2, marginBottom: 8 }}>{title}</h2>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {year && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{year}</span>}
                  {rating && (
                    <span style={{
                      background: 'rgba(255,215,0,0.1)', color: '#ffd700',
                      border: '1px solid rgba(255,215,0,0.2)',
                      padding: '2px 10px', borderRadius: 99, fontSize: '0.8rem', fontWeight: 700,
                    }}>⭐ {rating}</span>
                  )}
                  <span style={{
                    background: 'rgba(229,9,20,0.1)', color: '#e50914',
                    border: '1px solid rgba(229,9,20,0.2)',
                    padding: '2px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{type === 'tv' ? 'Serie' : 'Película'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Sinopsis (solo si no hay stream o loading) */}
          {!selectedStream && !loading && streams.length === 0 && (
            <p style={{
              color: 'rgba(255,255,255,0.7)', fontSize: '1rem',
              lineHeight: 1.7, marginBottom: 32, maxWidth: 750,
            }}>{overview}</p>
          )}

          {/* ── ESTADOS ── */}

          {/* 1. Estado inicial: la búsqueda arranca automáticamente al montar */}

          {/* 2. Cargando / Scrapeando */}
          {loading && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 20, padding: '60px 0', textAlign: 'center',
            }}>
              <div className="spinner" style={{ width: 50, height: 50, borderWidth: 4 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600 }}>Buscando los mejores streams…</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: 400 }}>
                  Estamos analizando múltiples servidores para encontrar opciones en <span style={{color: '#4ade80'}}>Latino</span> y <span style={{color: '#60a5fa'}}>1080p</span>.
                </p>
              </div>
            </div>
          )}

          {/* 3. Error */}
          {error && !loading && (
            <div style={{
              background: 'rgba(229,9,20,0.08)',
              border: '1px solid rgba(229,9,20,0.2)',
              borderRadius: 14, padding: '24px', marginBottom: 20, textAlign: 'center'
            }}>
              <p style={{ color: '#f87171', fontSize: '0.95rem', marginBottom: 16 }}>⚠️ {error}</p>
              <button className="btn-ghost" onClick={() => handleFindServers({ forceRefresh: true })}>🔄 Reintentar búsqueda</button>
            </div>
          )}

          {/* 4. Selector de Servidores */}
          {streams.length > 0 && !selectedStream && !loading && (
            <div style={{ animation: 'fadeIn 0.4s ease' }}>
              <ServerSelector
                streams={streams}
                activeStream={selectedStream}
                onSelect={(s) => setSelectedStream(s)}
              />
            </div>
          )}

          {/* 5. Reproductor */}
          {selectedStream && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.5s ease' }}>
              {/* Info mínima arriba del player */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => setSelectedStream(null)}
                    style={{
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.6)', padding: '6px 14px', borderRadius: 8,
                      cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >← Volver a servidores</button>
                  <div style={{ fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Reproduciendo desde: </span>
                    <span style={{ fontWeight: 700 }}>{selectedStream.server}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 8px' }}>|</span>
                    <span style={{ color: '#4ade80', fontWeight: 700 }}>{selectedStream.language}</span>
                  </div>
                </div>
              </div>

              <VideoPlayer
                streamUrl={selectedStream.url}
                streamType={selectedStream.type}
                title={title}
              />

              {/* Sinopsis pequeña abajo del player */}
              <div style={{ padding: '0 4px' }}>
                <h4 style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Sinopsis</h4>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', lineHeight: 1.6 }}>{overview}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
