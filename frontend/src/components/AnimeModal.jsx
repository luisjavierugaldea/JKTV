/**
 * components/AnimeModal.jsx
 * Modal especializado para anime con selector de episodios y servidores
 */
import { useState, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import ServerSelector from './ServerSelector';
import AnimeEpisodeSelector from './AnimeEpisodeSelector';
import { anime as animeApi } from '../lib/api';

export default function AnimeModal({ anime, onClose }) {
  const [animeInfo, setAnimeInfo] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [episodeData, setEpisodeData] = useState(null);
  const [streams, setStreams] = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const [showServerPanel, setShowServerPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingEpisode, setLoadingEpisode] = useState(false);
  const [error, setError] = useState(null);

  const title = anime.title || anime.name || '';
  const poster = anime.image || (anime.poster_path 
    ? (anime.poster_path.startsWith('http') ? anime.poster_path : `https://image.tmdb.org/t/p/w500${anime.poster_path}`) 
    : null);

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

  // Cargar información del anime al abrir
  useEffect(() => {
    if (anime.url) {
      loadAnimeInfo();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAnimeInfo() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await animeApi.getInfo(anime.url);
      if (data.success && data.data) {
        setAnimeInfo(data.data);
        // NO auto-seleccionar episodio - dejar que usuario elija
      } else {
        setError('No se pudo cargar la información del anime');
      }
    } catch (err) {
      console.error('Error loading anime info:', err);
      setError(err.response?.data?.error?.message || 'Error al cargar la información del anime');
    } finally {
      setLoading(false);
    }
  }

  async function handleEpisodeSelect(episode) {
    if (!episode.url) {
      setError('Este episodio no tiene URL disponible');
      return;
    }

    setSelectedEpisode(episode);
    setSelectedStream(null);
    setStreams([]);
    setLoadingEpisode(true);
    setError(null);

    try {
      const { data } = await animeApi.getEpisode(episode.url);
      if (data.success && data.data) {
        setEpisodeData(data.data);
        
        // Convertir los servidores de anime al formato esperado por ServerSelector
        const allServers = [];
        
        // Servidores SUB
        if (data.data.streamLinks?.SUB) {
          data.data.streamLinks.SUB.forEach(server => {
            // Detectar si es URL embebida (iframe) o HLS directo
            const isEmbed = server.url.includes('embed') || 
                           server.url.includes('player.') || 
                           server.url.includes('/play/') ||
                           server.url.includes('mp4upload') ||
                           server.url.includes('pixeldrain') ||
                           server.url.includes('terabox');
            
            allServers.push({
              server: server.server,
              language: 'SUB',
              quality: server.quality || '1080p',
              url: server.url,
              type: isEmbed ? 'embed' : 'hls',
              sourceId: server.server.toLowerCase().replace(/\s+/g, '_'),
            });
          });
        }

        // Servidores DUB
        if (data.data.streamLinks?.DUB) {
          data.data.streamLinks.DUB.forEach(server => {
            // Detectar si es URL embebida (iframe) o HLS directo
            const isEmbed = server.url.includes('embed') || 
                           server.url.includes('player.') || 
                           server.url.includes('/play/') ||
                           server.url.includes('mp4upload') ||
                           server.url.includes('pixeldrain') ||
                           server.url.includes('terabox');
            
            allServers.push({
              server: server.server,
              language: 'DUB',
              quality: server.quality || '1080p',
              url: server.url,
              type: isEmbed ? 'embed' : 'hls',
              sourceId: server.server.toLowerCase().replace(/\s+/g, '_'),
            });
          });
        }

        if (allServers.length > 0) {
          setStreams(allServers);
          // ⚡ Siempre auto-seleccionar el primer servidor para auto-play
          setSelectedStream(allServers[0]);
        } else {
          setError('No se encontraron servidores disponibles para este episodio');
        }
      } else {
        setError('No se encontraron enlaces para este episodio');
      }
    } catch (err) {
      console.error('Error loading episode:', err);
      setError(err.response?.data?.error?.message || 'Error al cargar el episodio');
    } finally {
      setLoadingEpisode(false);
    }
  }

  function handleNextEpisode() {
    if (animeInfo?.episodes && selectedEpisode) {
      const nextEp = animeInfo.episodes.find(ep => ep.number === selectedEpisode.number + 1);
      if (nextEp) {
        handleEpisodeSelect(nextEp);
      }
    }
  }

  const displayInfo = animeInfo || anime;
  const description = displayInfo.description || displayInfo.overview || 'Descripción no disponible';
  const genres = displayInfo.genres || [];
  const year = displayInfo.year || (displayInfo.first_air_date?.split('-')[0]);
  const rating = displayInfo.score || displayInfo.vote_average;
  const totalEpisodes = displayInfo.totalEpisodes || displayInfo.episodes?.length || 0;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-content ${selectedStream ? 'player-active' : ''}`}
        style={{ maxHeight: selectedStream ? '100vh' : '90vh', overflowY: 'auto' }}>

        {/* Botón Cerrar — siempre sticky y visible */}
        <button onClick={onClose} aria-label="Cerrar" style={{
          position: 'sticky', top: 8, float: 'right',
          marginRight: selectedStream ? 8 : 16,
          marginTop: selectedStream ? 8 : 0,
          background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff', width: 34, height: 34, borderRadius: '50%',
          cursor: 'pointer', fontSize: '0.9rem', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}>✕</button>

        {/* Hero Banner */}
        {poster && !selectedStream && (
          <div className="modal-hero" style={{
            width: '100%', height: 240, overflow: 'hidden',
            position: 'relative', borderRadius: '16px 16px 0 0',
          }}>
            <img
              src={poster}
              alt={title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), var(--bg-card))',
            }} />
          </div>
        )}

        {/* Contenido Principal */}
        <div style={{ padding: selectedStream ? '0' : '0 28px 32px', marginTop: (!selectedStream && poster) ? -60 : (selectedStream ? 0 : 28) }}>

          {/* Info del Anime */}
          {!selectedStream && (
            <div style={{ marginBottom: 24 }}>
              {/* Título y metadatos */}
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 16 }}>
                {poster && (
                  <img src={poster} alt={title} style={{
                    width: 120, borderRadius: 12,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.9)',
                    flexShrink: 0, border: '2px solid rgba(255,255,255,0.1)',
                  }} />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 900, lineHeight: 1.2, marginBottom: 8 }}>
                    {title}
                  </h2>
                  {displayInfo.titleJapanese && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 8, fontStyle: 'italic' }}>
                      {displayInfo.titleJapanese}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                    {year && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{year}</span>}
                    {rating && (
                      <span style={{
                        background: 'rgba(255,215,0,0.1)', color: '#ffd700',
                        border: '1px solid rgba(255,215,0,0.2)',
                        padding: '2px 10px', borderRadius: 99, fontSize: '0.8rem', fontWeight: 700,
                      }}>⭐ {typeof rating === 'number' ? rating.toFixed(1) : rating}</span>
                    )}
                    {totalEpisodes > 0 && (
                      <span style={{
                        background: 'rgba(96,165,250,0.1)', color: '#60a5fa',
                        border: '1px solid rgba(96,165,250,0.2)',
                        padding: '2px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700,
                      }}>📺 {totalEpisodes} eps</span>
                    )}
                    {displayInfo.status && (
                      <span style={{
                        background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                        border: '1px solid rgba(34,197,94,0.2)',
                        padding: '2px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700,
                      }}>{displayInfo.status}</span>
                    )}
                  </div>
                  
                  {/* Géneros */}
                  {genres.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {genres.slice(0, 5).map((genre, idx) => (
                        <span key={idx} style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '4px 10px', borderRadius: 6,
                          fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)',
                        }}>
                          {genre.name || genre}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sinopsis */}
              <p style={{
                color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem',
                lineHeight: 1.6, marginBottom: 24,
              }}>
                {description}
              </p>
            </div>
          )}

          {/* Estado de Carga */}
          {loading && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 20, padding: '60px 0', textAlign: 'center',
            }}>
              <div className="spinner" style={{ width: 50, height: 50, borderWidth: 4 }} />
              <p style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600 }}>
                Cargando información del anime...
              </p>
            </div>
          )}

          {/* Error */}
          {error && !loading && !loadingEpisode && (
            <div style={{
              background: 'rgba(229,9,20,0.08)',
              border: '1px solid rgba(229,9,20,0.2)',
              borderRadius: 14, padding: '24px', marginBottom: 20, textAlign: 'center'
            }}>
              <p style={{ color: '#f87171', fontSize: '0.95rem' }}>⚠️ {error}</p>
            </div>
          )}

          {/* Selector de Episodios */}
          {!loading && animeInfo?.episodes && animeInfo.episodes.length > 0 && !selectedStream && (
            <AnimeEpisodeSelector
              episodes={animeInfo.episodes}
              currentEpisode={selectedEpisode}
              onEpisodeSelect={handleEpisodeSelect}
            />
          )}

          {/* Cargando Episodio */}
          {loadingEpisode && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 20, padding: '40px 0', textAlign: 'center',
            }}>
              <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
              <p style={{ color: '#fff', fontSize: '1rem', fontWeight: 600 }}>
                Cargando episodio {selectedEpisode?.number}...
              </p>
            </div>
          )}

          {/* Reproductor — vista compacta tipo YouTube */}
          {selectedStream && selectedEpisode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, animation: 'fadeIn 0.4s ease' }}>

              {/* Video con panel flotante */}
              <div style={{ position: 'relative' }}>
                <VideoPlayer
                  streamUrl={selectedStream.url}
                  streamType={selectedStream.type}
                  title={`${title} - Episodio ${selectedEpisode.number}`}
                  meta={{
                    id: anime.id || anime.url,
                    type: 'anime',
                    season: 1,
                    episode: selectedEpisode.number
                  }}
                  onNextEpisode={
                    animeInfo?.episodes?.some(ep => ep.number === selectedEpisode.number + 1)
                      ? handleNextEpisode
                      : null
                  }
                />
                {/* ServerSelector flotante ENCIMA del video */}
                <ServerSelector
                  streams={streams}
                  activeStream={selectedStream}
                  onSelect={(s) => { setSelectedStream(s); setShowServerPanel(false); }}
                  isOpen={showServerPanel}
                  onClose={() => setShowServerPanel(false)}
                />
              </div>

              {/* Barra de info — compacta, pegada al video */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.03)',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '0 0 12px 12px',
                flexWrap: 'nowrap', overflow: 'hidden',
              }}>
                <button
                  onClick={() => setSelectedStream(null)}
                  style={{
                    background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.2)',
                    color: '#60a5fa', padding: '4px 10px', borderRadius: 6,
                    cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >← Episodios</button>

                <span style={{
                  fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>
                  <span style={{ fontWeight: 700, color: '#fff', marginRight: 4 }}>EP {selectedEpisode.number}</span>
                  {' · '}
                  <b style={{ color: 'rgba(255,255,255,0.8)' }}>{selectedStream.server}</b>
                  {' · '}
                  <span style={{ color: selectedStream.language === 'SUB' ? '#4ade80' : '#60a5fa' }}>{selectedStream.language}</span>
                </span>

                {streams.length > 1 && (
                  <button
                    onClick={() => setShowServerPanel(p => !p)}
                    title="Cambiar servidor"
                    style={{
                      background: showServerPanel ? 'rgba(229,9,20,0.2)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${showServerPanel ? 'rgba(229,9,20,0.35)' : 'rgba(255,255,255,0.1)'}`,
                      color: '#fff', borderRadius: 6,
                      padding: '4px 10px', cursor: 'pointer',
                      fontSize: '0.75rem', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 4,
                      flexShrink: 0, whiteSpace: 'nowrap',
                      transition: 'all 0.15s',
                    }}
                  >⚙️ {streams.length}</button>
                )}
              </div>


              {/* Título del episodio */}
              {selectedEpisode.title && (
                <div style={{ padding: '0 4px' }}>
                  <h4 style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: 700, 
                    color: '#fff',
                    marginBottom: 8 
                  }}>
                    {selectedEpisode.title}
                  </h4>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
