/**
 * components/AnimeEpisodeSelector.jsx
 * Selector de episodios para anime con grid visual
 */
import { useState } from 'react';

export default function AnimeEpisodeSelector({ episodes = [], currentEpisode, onEpisodeSelect }) {
  const [showAll, setShowAll] = useState(false);
  
  if (!episodes || episodes.length === 0) {
    return null;
  }

  // Mostrar primeros 24 episodios por defecto
  const displayedEpisodes = showAll ? episodes : episodes.slice(0, 24);
  const hasMore = episodes.length > 24;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 16 
      }}>
        <h3 style={{ 
          fontSize: '1.1rem', 
          fontWeight: 700,
          color: 'rgba(255,255,255,0.9)',
          letterSpacing: '-0.02em'
        }}>
          📺 Episodios ({episodes.length})
        </h3>
        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              padding: '6px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255,255,255,0.1)';
              e.target.style.color = 'rgba(255,255,255,0.9)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255,255,255,0.05)';
              e.target.style.color = 'rgba(255,255,255,0.6)';
            }}
          >
            Ver todos
          </button>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
        gap: 12,
        maxHeight: showAll ? 'none' : '400px',
        overflowY: showAll ? 'visible' : 'auto',
        padding: 4,
      }}>
        {displayedEpisodes.map((episode) => {
          const isActive = currentEpisode?.number === episode.number;
          return (
            <button
              key={episode.id || episode.number}
              onClick={() => onEpisodeSelect(episode)}
              style={{
                background: isActive 
                  ? 'linear-gradient(135deg, #e50914, #ff6b6b)' 
                  : 'rgba(255,255,255,0.05)',
                border: isActive
                  ? '2px solid rgba(229,9,20,0.6)'
                  : '1px solid rgba(255,255,255,0.1)',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
                padding: '12px 8px',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: isActive ? 700 : 500,
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                minHeight: 70,
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.target.style.background = 'rgba(255,255,255,0.1)';
                  e.target.style.borderColor = 'rgba(255,255,255,0.3)';
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.color = '#fff';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.color = 'rgba(255,255,255,0.7)';
                }
              }}
              title={episode.title || `Episodio ${episode.number}`}
            >
              <div style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                EP
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, lineHeight: 1 }}>
                {episode.number}
              </div>
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  fontSize: '0.7rem',
                }}>▶</div>
              )}
            </button>
          );
        })}
      </div>

      {hasMore && showAll && (
        <button
          onClick={() => setShowAll(false)}
          style={{
            marginTop: 16,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.6)',
            padding: '8px 16px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: '0.85rem',
            width: '100%',
          }}
        >
          Mostrar menos
        </button>
      )}
    </div>
  );
}
