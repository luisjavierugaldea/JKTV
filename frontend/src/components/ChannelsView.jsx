/**
 * ChannelsView.jsx — Vista de canales de TV organizados por países
 * SOLO DISEÑO - Optimizado para Web, Android TV y Smart TV
 */

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config';

// Helper para obtener banderas O iconos personalizados
const getCountryIcon = (countryName) => {
  const name = (countryName || '').toLowerCase();

  // 🌍 REGIONES ESPECIALES (Devuelven una URL directa de imagen)
  if (name.includes('latinoamerica') || name.includes('latinoamérica') || name.includes('latam')) {
    return 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f30e.png'; // Globo centrado en América
  }
  if (name.includes('mundo') || name.includes('internacional') || name.includes('global')) {
    return 'https://www.vhv.rs/dpng/d/544-5441921_mundo-png-sin-fondo-transparent-png.png'; // Globo con meridianos
  }
  if (name.includes('deporte') || name.includes('sports')) {
    return 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/26bd.png'; // Balón de fútbol
  }

  // 🇲🇽 PAÍSES NORMALES (Devuelven el código de 2 letras para FlagCDN)
  if (name.includes('argentina')) return 'ar';
  if (name.includes('perú') || name.includes('peru')) return 'pe';
  if (name.includes('colombia')) return 'co';
  if (name.includes('méxico') || name.includes('mexico')) return 'mx';
  if (name.includes('usa') || name.includes('estados unidos') || name.includes('eeuu')) return 'us';
  if (name.includes('chile')) return 'cl';
  if (name.includes('brasil')) return 'br';
  if (name.includes('españa') || name.includes('espana')) return 'es';
  if (name.includes('uruguay')) return 'uy';
  if (name.includes('ecuador')) return 'ec';
  if (name.includes('venezuela')) return 've';
  if (name.includes('bolivia')) return 'bo';
  if (name.includes('paraguay')) return 'py';
  if (name.includes('honduras')) return 'hn';
  if (name.includes('guatemala')) return 'gt';
  if (name.includes('el salvador')) return 'sv';
  if (name.includes('costa rica')) return 'cr';
  if (name.includes('panama') || name.includes('panamá')) return 'pa';
  if (name.includes('republica dominicana') || name.includes('república')) return 'do';
  if (name.includes('cuba')) return 'cu';
  if (name.includes('puerto rico')) return 'pr';
  if (name.includes('nicaragua')) return 'ni';
  if (name.includes('portugal')) return 'pt';

  return 'un'; // Código por defecto de la ONU si no encuentra el país
};

export default function ChannelsView({ onSelectChannel }) {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCountries, setExpandedCountries] = useState(new Set());

  // Cargar canales por países
  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/channels`);
      const data = await response.json();
      
      if (data.success) {
        setCountries(data.data);
        if (data.data.length > 0) {
          setExpandedCountries(new Set([data.data[0].id]));
        }
      } else {
        throw new Error('Error al cargar canales');
      }
    } catch (err) {
      console.error('[ChannelsView] Error:', err);
      setError('No se pudieron cargar los canales. Intenta de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
    const interval = setInterval(fetchChannels, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchChannels]);

  const toggleCountry = (countryId) => {
    setExpandedCountries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(countryId)) {
        newSet.delete(countryId);
      } else {
        newSet.add(countryId);
      }
      return newSet;
    });
  };

  const filteredCountries = countries
    .map(country => ({
      ...country,
      canales: country.canales.filter(canal =>
        canal.nombre.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }))
    .filter(country => country.canales.length > 0);

  const handleSelectChannel = (country, canal) => {
    console.log('[ChannelsView] 📺 Canal seleccionado:', canal.nombre, 'de', country.pais);
    onSelectChannel({
      name: `${canal.nombre} (${country.pais})`,
      url: canal.url,
      logo: country.flag || '📺',
      isEmbed: true
    });
    
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  // ESTADOS DE CARGA Y ERROR CON DISEÑO PREMIUM
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#a0a0b0' }}>
        <div className="spinner" style={{ width: 50, height: 50, border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 20 }}></div>
        <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>Sintonizando satélites...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: 15 }}>📡</div>
        <p style={{ color: '#fff', fontSize: '1.2rem', marginBottom: 20 }}>{error}</p>
        <button
          onClick={fetchChannels}
          style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 8, fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
          onFocus={(e) => e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.4)'}
          onBlur={(e) => e.target.style.boxShadow = 'none'}
        >
          Reintentar conexión
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      width: '100%', 
      maxWidth: 1200, 
      margin: '0 auto', 
      padding: 'clamp(15px, 4vw, 30px)', 
      fontFamily: "'Inter', sans-serif" 
    }}>
      
      {/* HEADER TIPO DASHBOARD TV */}
      <div style={{ 
        background: 'linear-gradient(135deg, rgba(20,20,30,0.9) 0%, rgba(10,10,15,0.95) 100%)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 24, 
        padding: 'clamp(20px, 4vw, 30px)', 
        marginBottom: 30,
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 15, marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', margin: 0, color: '#fff', fontWeight: 800, letterSpacing: '-0.5px' }}>
              Televisión Global
            </h2>
            <p style={{ color: '#888899', margin: '5px 0 0 0', fontSize: '1rem' }}>
              Explora {countries.reduce((sum, c) => sum + c.totalCanales, 0)} canales en vivo de {countries.length} regiones
            </p>
          </div>
          
          <button
            onClick={fetchChannels}
            style={{ 
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', 
              padding: '10px 20px', borderRadius: 12, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.2s', outline: 'none'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
          >
            <span style={{ fontSize: '1.2rem' }}>↻</span> Actualizar
          </button>
        </div>

        {/* BUSCADOR OPTIMIZADO PARA TV */}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem', color: '#666' }}>🔍</span>
          <input
            type="text"
            placeholder="Buscar canal (Ej. ESPN, Fox, Caracol)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', padding: '16px 16px 16px 48px', borderRadius: 16, fontSize: '1.1rem',
              outline: 'none', transition: 'all 0.2s'
            }}
            onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = 'rgba(0,0,0,0.6)'; e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.2)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(0,0,0,0.4)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
      </div>

      {/* LISTADO DE PAÍSES */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {filteredCountries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#666' }}>
            <div style={{ fontSize: '4rem', marginBottom: 10 }}>👀</div>
            <h3 style={{ color: '#fff', fontSize: '1.5rem', margin: '0 0 5px 0' }}>Ningún canal encontrado</h3>
            <p>Intenta buscar con otro nombre.</p>
          </div>
        ) : (
          filteredCountries.map(country => {
            const isExpanded = expandedCountries.has(country.id);
            const iconData = getCountryIcon(country.pais);
            
            // Si el iconData tiene más de 2 caracteres, es una URL directa (ej. Twemoji). Si no, es para FlagCDN.
            const imgSrc = iconData.length > 2 
              ? iconData 
              : `https://flagcdn.com/w80/${iconData}.png`;
            
            return (
              <div
                key={country.id}
                style={{
                  background: isExpanded ? '#15151e' : '#101016',
                  border: `1px solid ${isExpanded ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: 20,
                  overflow: 'hidden',
                  transition: 'all 0.3s ease'
                }}
              >
                {/* BOTÓN DEL PAÍS (ACORDEÓN) */}
                <button
                  onClick={() => toggleCountry(country.id)}
                  style={{
                    width: '100%', padding: 'clamp(15px, 3vw, 24px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', outline: 'none'
                  }}
                  onFocus={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onBlur={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    {/* CONTENEDOR DE LA BANDERA O ICONO */}
                    <div style={{ 
                      width: 'clamp(48px, 6vw, 64px)', height: 'clamp(48px, 6vw, 64px)', borderRadius: '50%', 
                      background: '#222', border: '2px solid rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
                    }}>
                      <img 
                        src={imgSrc} 
                        alt={country.pais} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '🌍'; }}
                      />
                    </div>
                    
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {country.pais}
                      </h3>
                      <div style={{ display: 'inline-block', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '4px 10px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600 }}>
                        📡 {country.totalCanales} Canales
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ 
                    width: 40, height: 40, borderRadius: '50%', background: isExpanded ? '#3b82f6' : 'rgba(255,255,255,0.05)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.2rem',
                    transition: 'all 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}>
                    ▼
                  </div>
                </button>

                {/* GRID DE CANALES (Se muestra si está expandido) */}
                {isExpanded && (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
                    gap: 12, padding: '0 clamp(15px, 3vw, 24px) clamp(15px, 3vw, 24px)', 
                    borderTop: '1px solid rgba(255,255,255,0.05)' 
                  }}>
                    <div style={{ gridColumn: '1 / -1', height: 16 }}></div> {/* Espaciador interno */}
                    
                    {country.canales.map((canal, idx) => (
                      <button
                        key={`${country.id}-${idx}`}
                        onClick={() => handleSelectChannel(country, canal)}
                        className="channel-card"
                        style={{
                          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                          padding: '16px', borderRadius: 16, cursor: 'pointer', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 12, outline: 'none',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.3)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        onFocus={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.4)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                        onBlur={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.3)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0, boxShadow: '0 0 8px #10b981' }}></div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {canal.nombre}
                          </div>
                          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginTop: 2 }}>
                            Transmisión HD
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}