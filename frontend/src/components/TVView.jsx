/**
 * TVView.jsx
 * Nueva sección TV con canales agregados de múltiples fuentes (M3U + Scrapers)
 * Con soporte para MultiView (pantalla dividida)
 */

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import MultiPlayer from './MultiPlayer';

const TVView = ({ onSelectChannel }) => {
  const [channels, setChannels] = useState([]);
  const [filteredChannels, setFilteredChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Stats
  const [stats, setStats] = useState(null);

  // MultiView
  const [multiMode, setMultiMode] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [showMultiPlayer, setShowMultiPlayer] = useState(false);

  // Categorías y países disponibles
  const categories = [
    { id: 'all', label: '📺 Todos', icon: '📺' },
    { id: 'sports', label: '⚽ Deportes', icon: '⚽' },
    { id: 'entertainment', label: '🎬 Entretenimiento', icon: '🎬' },
    { id: 'news', label: '📰 Noticias', icon: '📰' },
    { id: 'other', label: '🎭 Otros', icon: '🎭' },
  ];

  const countries = [
    { id: 'all', label: '🌎 Todos', flag: '🌎' },
    { id: 'mexico', label: 'México', flag: '🇲🇽' },
    { id: 'colombia', label: 'Colombia', flag: '🇨🇴' },
    { id: 'argentina', label: 'Argentina', flag: '🇦🇷' },
    { id: 'peru', label: 'Perú', flag: '🇵🇪' },
    { id: 'chile', label: 'Chile', flag: '🇨🇱' },
    { id: 'venezuela', label: 'Venezuela', flag: '🇻🇪' },
    { id: 'ecuador', label: 'Ecuador', flag: '🇪🇨' },
    { id: 'uruguay', label: 'Uruguay', flag: '🇺🇾' },
    { id: 'españa', label: 'España', flag: '🇪🇸' },
    { id: 'latam', label: 'LATAM', flag: '🌎' },
  ];

  // Cargar canales al montar
  useEffect(() => {
    fetchChannels();
    fetchStats();
  }, []);

  // Aplicar filtros
  useEffect(() => {
    applyFilters();
  }, [channels, selectedCategory, selectedCountry, searchQuery]);

  const fetchChannels = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/tv/channels`);
      const data = await response.json();

      if (data.success) {
        setChannels(data.data);
      } else {
        setError('Error cargando canales');
      }
    } catch (err) {
      console.error('Error fetching TV channels:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tv/stats`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const applyFilters = () => {
    let filtered = [...channels];

    // Filtro por categoría
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(ch => ch.category === selectedCategory);
    }

    // Filtro por país
    if (selectedCountry !== 'all') {
      filtered = filtered.filter(ch => ch.country === selectedCountry);
    }

    // Búsqueda por nombre
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ch => 
        ch.name.toLowerCase().includes(query)
      );
    }

    setFilteredChannels(filtered);
  };

  const handleSelectChannel = (channel) => {
    // Modo normal: selección única
    if (!multiMode) {
      // Scroll al inicio
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Pasar al reproductor
      onSelectChannel({
        name: channel.name,
        url: channel.url,
        logo: channel.logo,
        isEmbed: channel.source === 'tvtvhd' || channel.url.includes('embed'),
      });
      return;
    }

    // Modo MultiView: selección múltiple (máx 4)
    const isAlreadySelected = selectedChannels.some(ch => ch.id === channel.id);

    if (isAlreadySelected) {
      // Remover canal
      setSelectedChannels(selectedChannels.filter(ch => ch.id !== channel.id));
    } else {
      // Agregar canal (máximo 4)
      if (selectedChannels.length < 4) {
        setSelectedChannels([...selectedChannels, {
          ...channel,
          isEmbed: channel.source === 'tvtvhd' || channel.url.includes('embed'),
        }]);
      }
    }
  };

  const handleToggleMultiMode = () => {
    setMultiMode(!multiMode);
    // Limpiar selección al cambiar de modo
    setSelectedChannels([]);
    setShowMultiPlayer(false);
  };

  const handleCloseMultiView = () => {
    setSelectedChannels([]);
    setMultiMode(false);
    setShowMultiPlayer(false);
  };

  const handleOpenMultiPlayer = () => {
    if (selectedChannels.length > 0) {
      setShowMultiPlayer(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRefresh = async () => {
    try {
      await fetch(`${API_BASE_URL}/tv/refresh`, { method: 'POST' });
      await fetchChannels();
      await fetchStats();
    } catch (err) {
      console.error('Error refreshing:', err);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        color: '#fff',
        fontSize: '1.2rem',
      }}>
        <div>🔄 Cargando canales...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        color: '#fff',
        textAlign: 'center',
        gap: '1rem',
      }}>
        <div style={{ fontSize: '3rem' }}>❌</div>
        <div style={{ fontSize: '1.2rem' }}>{error}</div>
        <button
          onClick={fetchChannels}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#3b82f6',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          🔄 Reintentar
        </button>
      </div>
    );
  }

  // MODO MULTIVIEW ACTIVO: Mostrar MultiPlayer
  if (showMultiPlayer && selectedChannels.length > 0) {
    return <MultiPlayer channels={selectedChannels} onClose={handleCloseMultiView} />;
  }

  return (
    <>
      {/* Estilos para animaciones */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.9;
              transform: scale(1.05);
            }
          }
        `}
      </style>

      <div style={{
        padding: 'clamp(1rem, 3vw, 2rem)',
        maxWidth: '1400px',
        margin: '0 auto',
      }}>
      {/* Header con stats */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 'clamp(12px, 2vw, 16px)',
        padding: 'clamp(1rem, 3vw, 1.5rem)',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: 'clamp(1.5rem, 4vw, 2rem)',
              color: '#fff',
            }}>
              📺 TV en Vivo
            </h2>
            <p style={{
              margin: '0.5rem 0 0 0',
              fontSize: 'clamp(0.85rem, 2.5vw, 1rem)',
              color: 'rgba(255,255,255,0.9)',
            }}>
              {filteredChannels.length} canales disponibles
              {multiMode && ` • ${selectedChannels.length}/4 seleccionados`}
            </p>
          </div>
          
          <div style={{
            display: 'flex',
            gap: 'clamp(0.5rem, 2vw, 0.75rem)',
            flexWrap: 'wrap',
          }}>
            {/* Botón MultiView */}
            <button
              onClick={handleToggleMultiMode}
              style={{
                background: multiMode
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'rgba(255,255,255,0.2)',
                padding: 'clamp(0.5rem, 2vw, 0.65rem) clamp(0.75rem, 3vw, 1rem)',
                borderRadius: '8px',
                border: multiMode ? '2px solid #34d399' : 'none',
                color: '#fff',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                fontWeight: multiMode ? '700' : '600',
                transition: 'all 0.3s',
                boxShadow: multiMode ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none',
              }}
            >
              {multiMode ? '✅ Modo MultiView' : '📺 MultiView'}
            </button>

            {/* Ver MultiView (solo si hay canales seleccionados) */}
            {multiMode && selectedChannels.length > 0 && (
              <button
                onClick={handleOpenMultiPlayer}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  padding: 'clamp(0.5rem, 2vw, 0.65rem) clamp(0.75rem, 3vw, 1rem)',
                  borderRadius: '8px',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                  fontWeight: '700',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                  animation: 'pulse 2s infinite',
                }}
              >
                🎬 Ver {selectedChannels.length} Canal{selectedChannels.length > 1 ? 'es' : ''}
              </button>
            )}

            {stats && (
              <div style={{
                background: 'rgba(255,255,255,0.2)',
                padding: 'clamp(0.5rem, 2vw, 0.65rem) clamp(0.75rem, 3vw, 1rem)',
                borderRadius: '8px',
                backdropFilter: 'blur(10px)',
                fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                color: '#fff',
              }}>
                📊 {stats.totalChannels} total
              </div>
            )}
            
            <button
              onClick={handleRefresh}
              style={{
                background: 'rgba(255,255,255,0.2)',
                padding: 'clamp(0.5rem, 2vw, 0.65rem) clamp(0.75rem, 3vw, 1rem)',
                borderRadius: '8px',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                fontWeight: '600',
              }}
            >
              🔄 Actualizar
            </button>
          </div>
        </div>

        {/* Instrucciones MultiView */}
        {multiMode && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: '8px',
            color: '#fff',
            fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
            backdropFilter: 'blur(10px)',
          }}>
            💡 <strong>Modo MultiView:</strong> Click en los canales para seleccionar (máximo 4). 
            Luego presiona "🎬 Ver Canales" para ver todos simultáneamente.
          </div>
        )}
      </div>

      {/* Filtros */}
      <div style={{
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        {/* Búsqueda */}
        <input
          type="text"
          placeholder="🔍 Buscar canal..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: 'clamp(0.75rem, 2.5vw, 1rem)',
            fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
            borderRadius: '12px',
            border: '2px solid #374151',
            background: '#1f2937',
            color: '#fff',
            outline: 'none',
          }}
        />

        {/* Categorías */}
        <div style={{
          display: 'flex',
          gap: 'clamp(0.5rem, 2vw, 0.75rem)',
          flexWrap: 'wrap',
        }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: 'clamp(0.5rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)',
                fontSize: 'clamp(0.85rem, 2.5vw, 1rem)',
                borderRadius: '10px',
                border: 'none',
                background: selectedCategory === cat.id
                  ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                  : '#374151',
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: selectedCategory === cat.id ? '600' : '400',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Países */}
        <div style={{
          display: 'flex',
          gap: 'clamp(0.5rem, 2vw, 0.75rem)',
          flexWrap: 'wrap',
        }}>
          {countries.map(country => (
            <button
              key={country.id}
              onClick={() => setSelectedCountry(country.id)}
              style={{
                padding: 'clamp(0.5rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)',
                fontSize: 'clamp(0.85rem, 2.5vw, 1rem)',
                borderRadius: '10px',
                border: 'none',
                background: selectedCountry === country.id
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : '#374151',
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: selectedCountry === country.id ? '600' : '400',
              }}
            >
              {country.flag} {country.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de canales */}
      {filteredChannels.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#9ca3af',
          fontSize: '1.1rem',
        }}>
          📭 No se encontraron canales con esos filtros
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(160px, 45vw, 280px), 1fr))',
          gap: 'clamp(0.75rem, 2vw, 1rem)',
        }}>
          {filteredChannels.map((channel, index) => {
            const isSelected = multiMode && selectedChannels.some(ch => ch.id === channel.id);
            const selectionIndex = isSelected 
              ? selectedChannels.findIndex(ch => ch.id === channel.id) + 1 
              : -1;
            const isMaxReached = multiMode && selectedChannels.length >= 4 && !isSelected;

            return (
              <button
                key={`${channel.id}_${index}`}
                onClick={() => handleSelectChannel(channel)}
                disabled={isMaxReached}
                style={{
                  background: isSelected
                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                    : 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
                  border: isSelected 
                    ? '3px solid #60a5fa'
                    : '2px solid #374151',
                  borderRadius: '12px',
                  padding: 'clamp(0.75rem, 3vw, 1rem)',
                  cursor: isMaxReached ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s',
                  color: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  position: 'relative',
                  opacity: isMaxReached ? 0.5 : 1,
                  boxShadow: isSelected ? '0 8px 24px rgba(59, 130, 246, 0.5)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isMaxReached) {
                    e.currentTarget.style.transform = 'scale(1.03)';
                    e.currentTarget.style.borderColor = isSelected ? '#60a5fa' : '#3b82f6';
                    e.currentTarget.style.boxShadow = isSelected
                      ? '0 12px 32px rgba(59, 130, 246, 0.6)'
                      : '0 8px 16px rgba(59, 130, 246, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.borderColor = isSelected ? '#60a5fa' : '#374151';
                  e.currentTarget.style.boxShadow = isSelected 
                    ? '0 8px 24px rgba(59, 130, 246, 0.5)'
                    : 'none';
                }}
              >
                {/* Badge de selección */}
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    background: '#10b981',
                    color: '#fff',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    border: '3px solid #1f2937',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                  }}>
                    {selectionIndex}
                  </div>
                )}

                {/* Badge de máximo alcanzado */}
                {isMaxReached && (
                  <div style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: '#fff',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                  }}>
                    ⚠️ Máx 4
                  </div>
                )}

                <div style={{
                  fontSize: 'clamp(1rem, 3.5vw, 1.1rem)',
                  fontWeight: '600',
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {channel.name}
                </div>
                
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  fontSize: 'clamp(0.75rem, 2.5vw, 0.85rem)',
                  color: isSelected ? '#e0e7ff' : '#9ca3af',
                  flexWrap: 'wrap',
                }}>
                  {channel.quality && (
                    <>
                      {channel.quality === '4K' && '🔵'}
                      {channel.quality === '1080p' && '🟢'}
                      {channel.quality === 'HD' && '🟡'}
                      {channel.quality === 'SD' && '⚪'}
                      {' '}{channel.quality}
                    </>
                  )}
                  <span>• {channel.language?.toUpperCase() || 'ES'}</span>
                  {channel.source && (
                    <span>• 📡 {channel.source}</span>
                  )}
                  {channel.isAlive !== undefined && (
                    <span>• {channel.isAlive ? '✅ Live' : '⚠️'}</span>
                  )}
                </div>

                {/* Indicador de modo MultiView */}
                {multiMode && !isSelected && !isMaxReached && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#60a5fa',
                    marginTop: '0.25rem',
                  }}>
                    👆 Click para agregar
                  </div>
                )}
                {multiMode && isSelected && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#34d399',
                    marginTop: '0.25rem',
                    fontWeight: '600',
                  }}>
                    ✅ Seleccionado
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
};

export default TVView;
