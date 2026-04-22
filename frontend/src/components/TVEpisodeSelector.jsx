/**
 * components/TVEpisodeSelector.jsx
 * Selector de temporada y episodio para series de TV
 */
import { useState, useEffect } from 'react';
import { tmdb } from '../lib/api';

export default function TVEpisodeSelector({ tvShow, onEpisodeSelect, currentSeason = 1, currentEpisode = 1 }) {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(currentSeason);
  const [selectedEpisode, setSelectedEpisode] = useState(currentEpisode);
  const [episodeCount, setEpisodeCount] = useState(10); // Default
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tvShow.id) {
      loadSeasons();
    }
  }, [tvShow.id]);

  async function loadSeasons() {
    setLoading(true);
    try {
      const { data } = await tmdb.tvDetail(tvShow.id);
      if (data.data) {
        const tvData = data.data;
        const seasonList = tvData.seasons?.filter(s => s.season_number > 0) || [];
        setSeasons(seasonList);
        
        // Encontrar la temporada actual
        const currentSeasonData = seasonList.find(s => s.season_number === selectedSeason);
        if (currentSeasonData) {
          setEpisodeCount(currentSeasonData.episode_count || 10);
        }
      }
    } catch (err) {
      console.error('Error loading seasons:', err);
      // Si falla, usar valores por defecto
      setSeasons([{ season_number: 1, episode_count: 10, name: 'Temporada 1' }]);
      setEpisodeCount(10);
    } finally {
      setLoading(false);
    }
  }

  function handleSeasonChange(seasonNum) {
    setSelectedSeason(seasonNum);
    setSelectedEpisode(1); // Reset a episodio 1
    
    // Actualizar count de episodios
    const seasonData = seasons.find(s => s.season_number === seasonNum);
    if (seasonData) {
      setEpisodeCount(seasonData.episode_count || 10);
    }
  }

  function handleConfirm() {
    if (onEpisodeSelect) {
      onEpisodeSelect({ season: selectedSeason, episode: selectedEpisode });
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div className="spinner" style={{ width: 30, height: 30, borderWidth: 3, margin: '0 auto' }} />
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginTop: 12 }}>
          Cargando temporadas...
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'rgba(255,255,255,0.04)', 
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, 
      padding: 24,
      marginBottom: 24 
    }}>
      <h3 style={{ 
        fontSize: '1.1rem', 
        fontWeight: 700,
        marginBottom: 16,
        color: 'rgba(255,255,255,0.9)',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        📺 Selecciona Episodio
      </h3>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 20
      }}>
        {/* Selector de Temporada */}
        <div>
          <label style={{ 
            display: 'block', 
            fontSize: '0.85rem', 
            color: 'rgba(255,255,255,0.6)',
            marginBottom: 8,
            fontWeight: 600
          }}>
            Temporada
          </label>
          <select
            value={selectedSeason}
            onChange={(e) => handleSeasonChange(parseInt(e.target.value))}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: '#fff',
              fontSize: '1rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              outline: 'none'
            }}
          >
            {seasons.length > 0 ? seasons.map(season => (
              <option key={season.season_number} value={season.season_number}>
                {season.name || `Temporada ${season.season_number}`}
              </option>
            )) : (
              <option value={1}>Temporada 1</option>
            )}
          </select>
        </div>

        {/* Selector de Episodio */}
        <div>
          <label style={{ 
            display: 'block', 
            fontSize: '0.85rem', 
            color: 'rgba(255,255,255,0.6)',
            marginBottom: 8,
            fontWeight: 600
          }}>
            Episodio
          </label>
          <select
            value={selectedEpisode}
            onChange={(e) => setSelectedEpisode(parseInt(e.target.value))}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: '#fff',
              fontSize: '1rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              outline: 'none'
            }}
          >
            {Array.from({ length: episodeCount }, (_, i) => i + 1).map(ep => (
              <option key={ep} value={ep}>
                Episodio {ep}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Botón de Buscar Servidores */}
      <button
        onClick={handleConfirm}
        className="btn-primary"
        style={{
          width: '100%',
          justifyContent: 'center',
          padding: '14px 24px',
          fontSize: '1rem',
          fontWeight: 700
        }}
      >
        🎬 Buscar Servidores para T{selectedSeason} EP{selectedEpisode}
      </button>

      <p style={{ 
        fontSize: '0.8rem', 
        color: 'rgba(255,255,255,0.4)', 
        marginTop: 12,
        textAlign: 'center'
      }}>
        Se buscará en Cuevana y otros servidores disponibles
      </p>
    </div>
  );
}
