/**
 * AgendaView.jsx — Vista de eventos y canales deportivos
 * Diseño inspirado en tvtvhd.com
 * 
 * Contiene 2 tabs:
 * - Eventos en Vivo: agenda deportiva del día
 * - Canales por País: canales organizados por región
 */

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import ChannelsView from './ChannelsView';
import MultiPlayer from './MultiPlayer';

export default function AgendaView({ onSelectChannel }) {
  const [activeTab, setActiveTab] = useState('events'); // 'events' o 'channels'
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEvent, setExpandedEvent] = useState(null);

  // MultiView
  const [multiMode, setMultiMode] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [showMultiPlayer, setShowMultiPlayer] = useState(false);

  // Cargar eventos desde el backend
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/events`);
      const data = await response.json();
      
      if (data.success) {
        setEvents(data.data);
      } else {
        throw new Error('Error al cargar eventos');
      }
    } catch (err) {
      console.error('[AgendaView] Error:', err);
      setError('No se pudieron cargar los eventos deportivos. Intenta de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    // Actualizar cada 5 minutos
    const interval = setInterval(fetchEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  // Filtrar eventos
  const filteredEvents = events.filter(event => {
    return event.titulo.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Manejar selección de canal
  const handleSelectChannel = (event, canal) => {
    // Auto-detectar si es embed o M3U8
    const isM3U8 = canal.url.includes('.m3u8') || canal.url.includes('m3u8');
    
    // Modo normal: selección única
    if (!multiMode) {
      console.log('[AgendaView] 📺 Canal seleccionado:', canal.nombre, '→', canal.url);
      console.log('[AgendaView] 🔍 Tipo:', isM3U8 ? 'M3U8 (HLS)' : 'Embed (iframe)');
      
      onSelectChannel({
        name: `${event.titulo} - ${canal.nombre}`,
        url: canal.url,
        logo: event.logo,
        isEmbed: !isM3U8,
type: isM3U8 ? 'hls' : 'embed'  // Si es M3U8 → false (usar HLS), si no → true (usar iframe)
      });
      
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
      return;
    }

    // Modo MultiView: selección múltiple (máx 4)
    const channelData = {
      id: `${event.id}_${canal.nombre}`,
      name: `${event.titulo} - ${canal.nombre}`,
      url: canal.url,
      logo: event.logo,
      isEmbed: !isM3U8,
type: isM3U8 ? 'hls' : 'embed'  // Si es M3U8 → false (usar HLS), si no → true (usar iframe)
    };

    const isAlreadySelected = selectedChannels.some(ch => ch.id === channelData.id);

    if (isAlreadySelected) {
      // Remover canal
      setSelectedChannels(selectedChannels.filter(ch => ch.id !== channelData.id));
    } else {
      // Agregar canal (máximo 4)
      if (selectedChannels.length < 4) {
        setSelectedChannels([...selectedChannels, channelData]);
      }
    }
  };

  const handleToggleMultiMode = () => {
    setMultiMode(!multiMode);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Cargando eventos deportivos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <p className="text-white text-lg mb-4">{error}</p>
          <button
            onClick={fetchEvents}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            🔄 Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Obtener fecha actual
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

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

      <div style={{ minHeight: '60vh' }}>
      {/* Tabs Header */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('events')}
          className={`flex-1 py-3 px-6 rounded-lg font-bold text-lg transition-all ${
            activeTab === 'events'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          📅 Eventos en Vivo
        </button>
        <button
          onClick={() => setActiveTab('channels')}
          className={`flex-1 py-3 px-6 rounded-lg font-bold text-lg transition-all ${
            activeTab === 'channels'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          📺 Canales por País
        </button>
      </div>

      {/* Contenido según tab activo */}
      {activeTab === 'channels' ? (
        <ChannelsView onSelectChannel={onSelectChannel} />
      ) : (
        <div>
          {/* Header con título y búsqueda */}
          <div style={{ 
            background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
            padding: '2rem',
            borderRadius: '12px',
            marginBottom: '2rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
          }}>
            <h1 style={{ 
              fontSize: 'clamp(1.5rem, 5vw, 2rem)', 
              fontWeight: 'bold', 
              color: 'white',
              marginBottom: '0.5rem',
              textTransform: 'capitalize'
            }}>
              Agenda {dateStr}
            </h1>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              flexWrap: 'wrap',
              gap: '0.75rem',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)'
            }}>
              <span>⚽ {filteredEvents.length} partido{filteredEvents.length !== 1 ? 's' : ''}</span>
              <span>📺 {filteredEvents.reduce((acc, e) => acc + e.canales.length, 0)} canales</span>
              {multiMode && <span>• {selectedChannels.length}/4 seleccionados</span>}
              
              {/* Botón MultiView */}
              <button
                onClick={handleToggleMultiMode}
                style={{
                  marginLeft: 'auto',
                  background: multiMode
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'rgba(255, 255, 255, 0.2)',
                  border: multiMode ? '2px solid #34d399' : 'none',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: multiMode ? '700' : '500',
                  transition: 'all 0.2s',
                  boxShadow: multiMode ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none'
                }}
                onMouseOver={(e) => {
                  if (!multiMode) e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseOut={(e) => {
                  if (!multiMode) e.target.style.background = 'rgba(255, 255, 255, 0.2)';
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
                    border: 'none',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                    animation: 'pulse 2s infinite'
                  }}
                >
                  🎬 Ver {selectedChannels.length} Canal{selectedChannels.length > 1 ? 'es' : ''}
                </button>
              )}

              <button
                onClick={fetchEvents}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
              >
                🔄 Actualizar
              </button>
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
              }}>
                💡 <strong>Modo MultiView:</strong> Click en los canales para seleccionar (máximo 4). 
                Luego presiona "🎬 Ver Canales" para ver todos simultáneamente.
              </div>
            )}

            {/* Buscador */}
            <div style={{ marginTop: '1.5rem' }}>
              <input
                type="text"
                placeholder="🔍 Buscar partido o canal..."
                value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '500px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '1rem',
              outline: 'none',
              transition: 'all 0.2s'
            }}
            onFocus={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.25)'}
            onBlur={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.15)'}
          />
        </div>
      </div>

      {/* Lista de eventos */}
      {filteredEvents.length === 0 ? (
        <div className="text-center" style={{ padding: '4rem 0' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📭</div>
          <p style={{ color: '#9ca3af', fontSize: '1.25rem' }}>No se encontraron eventos</p>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Intenta con otros términos de búsqueda
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              style={{
                background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}
            >
              {/* Header del evento */}
              <div style={{ 
                padding: 'clamp(0.75rem, 3vw, 1.25rem)',
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(0.5rem, 2vw, 1rem)',
                flexWrap: 'wrap'
              }}>
                {/* Hora */}
                <div style={{
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color: '#1f2937',
                  padding: 'clamp(0.5rem, 2vw, 0.75rem)',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: 'clamp(0.75rem, 2.5vw, 0.85rem)',
                  textAlign: 'center',
                  minWidth: 'clamp(50px, 15vw, 60px)',
                  lineHeight: '1.2',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                }}>
                  <div style={{ fontSize: 'clamp(0.9rem, 3vw, 1.1rem)' }}>{event.hora}</div>
                  <div style={{ fontSize: 'clamp(0.6rem, 1.8vw, 0.7rem)', opacity: 0.8 }}>LOCAL</div>
                </div>

                {/* Logo del deporte */}
                <div style={{ fontSize: 'clamp(2rem, 6vw, 2.5rem)', flexShrink: 0 }}>
                  {event.logo}
                </div>

                {/* Información del evento */}
                <div style={{ flex: 1, minWidth: '0' }}>
                  <h3 style={{ 
                    color: 'white', 
                    fontWeight: '600', 
                    fontSize: 'clamp(0.9rem, 3.5vw, 1.1rem)',
                    marginBottom: '0.25rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: '1.3'
                  }}>
                    {event.titulo}
                  </h3>
                  <div style={{ 
                    color: '#9ca3af', 
                    fontSize: 'clamp(0.75rem, 2.5vw, 0.85rem)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span>🏅 {event.liga}</span>
                  </div>
                </div>

                {/* Canales disponibles */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'clamp(0.5rem, 2vw, 0.75rem)',
                  width: '100%',
                  marginTop: '0.5rem'
                }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    padding: 'clamp(0.4rem, 2vw, 0.5rem) clamp(0.75rem, 3vw, 1rem)',
                    borderRadius: '6px',
                    fontSize: 'clamp(0.75rem, 2.5vw, 0.85rem)',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                  }}>
                    📡 {event.canales.length} canal{event.canales.length !== 1 ? 'es' : ''}
                  </div>
                  <div style={{ 
                    color: 'white', 
                    fontSize: 'clamp(1rem, 3vw, 1.25rem)',
                    transition: 'transform 0.2s'
                  }}>
                    {expandedEvent === event.id ? '▼' : '▶'}
                  </div>
                </div>
              </div>

              {/* Lista de canales (expandible) */}
              {expandedEvent === event.id && (
                <div style={{
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: 'clamp(0.75rem, 3vw, 1rem)'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(140px, 45vw, 200px), 1fr))',
                    gap: 'clamp(0.5rem, 2vw, 0.75rem)'
                  }}>
                    {event.canales.map((canal, index) => {
                      const channelId = `${event.id}_${canal.nombre}`;
                      const isSelected = multiMode && selectedChannels.some(ch => ch.id === channelId);
                      const selectionIndex = isSelected 
                        ? selectedChannels.findIndex(ch => ch.id === channelId) + 1 
                        : -1;
                      const isMaxReached = multiMode && selectedChannels.length >= 4 && !isSelected;

                      return (
                        <button
                          key={index}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isMaxReached || isSelected) {
                              handleSelectChannel(event, canal);
                            }
                          }}
                          disabled={isMaxReached}
                          style={{
                            background: isSelected
                              ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                              : 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                            border: isSelected 
                              ? '2px solid #60a5fa'
                              : '1px solid rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            padding: 'clamp(0.75rem, 3vw, 1rem)',
                            borderRadius: '8px',
                            cursor: isMaxReached ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'left',
                            position: 'relative',
                            opacity: isMaxReached ? 0.5 : 1,
                            boxShadow: isSelected ? '0 4px 12px rgba(59, 130, 246, 0.5)' : 'none'
                          }}
                          onMouseOver={(e) => {
                            if (!isMaxReached) {
                              e.target.style.background = isSelected
                                ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                                : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                              e.target.style.transform = 'scale(1.05)';
                            }
                          }}
                          onMouseOut={(e) => {
                            e.target.style.background = isSelected
                              ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                              : 'linear-gradient(135deg, #374151 0%, #1f2937 100%)';
                            e.target.style.transform = 'scale(1)';
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
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              border: '2px solid #1f2937',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
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
                              padding: '0.2rem 0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.65rem',
                              fontWeight: '600',
                            }}>
                              ⚠️ Máx 4
                            </div>
                          )}

                          <div style={{ 
                            fontWeight: '600', 
                            fontSize: 'clamp(0.85rem, 3vw, 1rem)', 
                            marginBottom: '0.25rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            📺 {canal.nombre}
                          </div>
                          <div style={{ 
                            fontSize: 'clamp(0.7rem, 2vw, 0.75rem)', 
                            color: isSelected ? '#e0e7ff' : 'rgba(255, 255, 255, 0.7)',
                            display: 'flex',
                            gap: '0.5rem',
                            flexWrap: 'wrap'
                          }}>
                            <span>🟢 {canal.calidad}</span>
                            <span>• {canal.idioma}</span>
                          </div>

                          {/* Indicador de modo MultiView */}
                          {multiMode && !isSelected && !isMaxReached && (
                            <div style={{
                              fontSize: '0.7rem',
                              color: '#60a5fa',
                              marginTop: '0.25rem',
                            }}>
                              👆 Click para agregar
                            </div>
                          )}
                          {multiMode && isSelected && (
                            <div style={{
                              fontSize: '0.7rem',
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
                </div>
              )}
            </div>
          ))}
        </div>
      )}
        </div>
      )}
      </div>
    </>
  );
}
