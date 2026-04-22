/**
 * components/TVEpisodeSelector.jsx
 * Selector de temporada y episodio para series de TV con diseño tipo anime
 */
import { useState, useEffect } from 'react';
import { tmdb } from '../lib/api';

export default function TVEpisodeSelector({ tvShow, onEpisodeSelect, currentSeason = 1, currentEpisode = 1 }) {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(currentSeason);
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
    
    // Actualizar count de episodios
    const seasonData = seasons.find(s => s.season_number === seasonNum);
    if (seasonData) {
      setEpisodeCount(seasonData.episode_count || 10);
    }
  }

  function handleEpisodeClick(episodeNum) {
    if (onEpisodeSelect) {
      onEpisodeSelect({ season: selectedSeason, episode: episodeNum });
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
    <div style={{ marginBottom: 24 }}>
      {/* Selector de Temporadas (Tabs horizontales) */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ 
          fontSize: '1.1rem', 
          fontWeight: 700,
          marginBottom: 12,
          color: 'rgba(255,255,255,0.9)',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          📺 Selecciona Temporada
        </h3>
        
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 4
        }}>
          {seasons.length > 0 ? seasons.map(season => {
            const isActive = season.season_number === selectedSeason;
            return (
              <button
                key={season.season_number}
                onClick={() => handleSeasonChange(season.season_number)}
                style={{
                  background: isActive 
                    ? 'linear-gradient(135deg, #e50914, #ff6b6b)' 
                    : 'rgba(255,255,255,0.05)',
                  border: isActive
                    ? '2px solid rgba(229,9,20,0.6)'
                    : '1px solid rgba(255,255,255,0.1)',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
                  padding: '10px 20px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: isActive ? 700 : 500,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.target.style.background = 'rgba(255,255,255,0.1)';
                    e.target.style.borderColor = 'rgba(255,255,255,0.3)';
                    e.target.style.color = '#fff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.target.style.background = 'rgba(255,255,255,0.05)';
                    e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.target.style.color = 'rgba(255,255,255,0.7)';
                  }
                }}
              >
                <span style={{ fontSize: '1.1rem', fontWeight: 900 }}>T{season.season_number}</span>
                <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>({season.episode_count} eps)</span>
              </button>
            );
          }) : (
            <button
              style={{
                background: 'linear-gradient(135deg, #e50914, #ff6b6b)',
                border: '2px solid rgba(229,9,20,0.6)',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: 10,
                fontSize: '0.9rem',
                fontWeight: 700,
              }}
            >
              T1 (10 eps)
            </button>
          )}
        </div>
      </div>

      {/* Grid de Episodios (como anime) */}
      <div>
        <h3 style={{ 
          fontSize: '1.1rem', 
          fontWeight: 700,
          marginBottom: 12,
          color: 'rgba(255,255,255,0.9)',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          🎬 Episodios - Temporada {selectedSeason}
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          gap: 12,
          maxHeight: '400px',
          overflowY: 'auto',
          padding: 4,
        }}>
          {Array.from({ length: episodeCount }, (_, i) => i + 1).map(ep => (
            <button
              key={ep}
              onClick={() => handleEpisodeClick(ep)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.7)',
                padding: '12px 8px',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                minHeight: 70,
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #e50914, #ff6b6b)';
                e.target.style.borderColor = 'rgba(229,9,20,0.6)';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.color = '#fff';
                e.target.style.fontWeight = '700';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255,255,255,0.05)';
                e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                e.target.style.transform = 'translateY(0)';
                e.target.style.color = 'rgba(255,255,255,0.7)';
                e.target.style.fontWeight = '500';
              }}
              title={`Temporada ${selectedSeason} - Episodio ${ep}`}
            >
              <div style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                EP
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, lineHeight: 1 }}>
                {ep}
              </div>
            </button>
          ))}
        </div>
      </div>

      <p style={{ 
        fontSize: '0.8rem', 
        color: 'rgba(255,255,255,0.4)', 
        marginTop: 16,
        textAlign: 'center'
      }}>
        Haz clic en un episodio para buscar servidores disponibles
      </p>
    </div>
  );
}
