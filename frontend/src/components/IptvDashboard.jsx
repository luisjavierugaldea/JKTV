import { useState, useMemo, useEffect, useCallback } from 'react';
import VideoPlayer from './VideoPlayer';
import { API_BASE_URL } from '../config';

export default function IptvDashboard({ channels, loading, error, onRemoveChannel }) {
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('TODOS');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showSidebar, setShowSidebar] = useState(true);

  // Función para envolver la URL en el proxy del backend
  const wrapUrl = useCallback((url, channelId) => {
    if (!url) return '';
    if (url.includes('localhost') || url.includes('127.0.0.1')) return url;
    const base64Url = btoa(unescape(encodeURIComponent(url)));
    let proxyUrl = `${API_BASE_URL}/iptv-proxy/stream?url=${base64Url}`;
    if (channelId) proxyUrl += `&channelId=${encodeURIComponent(channelId)}`;
    return proxyUrl;
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setShowSidebar(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Extraer grupos únicos (excluyendo adultos si no está desbloqueado)
  const groups = useMemo(() => {
    if (!channels) return [];
    const g = new Set(['TODOS']);
    channels.forEach(c => {
      if (c.group && (isUnlocked || !c.isAdult)) g.add(c.group);
    });
    return Array.from(g).sort();
  }, [channels, isUnlocked]);

  // Filtrar canales
  const filteredChannels = useMemo(() => {
    if (!channels) return [];
    return channels.filter(c => {
      const matchesSearch = c.displayName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup = selectedGroup === 'TODOS' || c.group === selectedGroup;
      const matchesAdult = isUnlocked || !c.isAdult;
      return matchesSearch && matchesGroup && matchesAdult;
    });
  }, [channels, searchTerm, selectedGroup, isUnlocked]);

  // Autoseleccionar el primer canal al cargar
  useEffect(() => {
    if (!selectedChannel && filteredChannels.length > 0) {
      setSelectedChannel(filteredChannels[0]);
    }
  }, [filteredChannels, selectedChannel]);

  const handleUnlock = () => {
    const pin = prompt('Introduce el PIN Parental (por defecto es 0000):');
    if (pin === '0000') {
      setIsUnlocked(true);
      alert('Contenido +18 desbloqueado.');
    } else {
      alert('PIN incorrecto.');
    }
  };

  const handleAutoSkip = () => {
    if (!selectedChannel) return;
    const deadChannelId = selectedChannel.id;
    
    // 1. Identificar el siguiente canal antes de borrar el actual
    const currentIndex = filteredChannels.findIndex(c => c.id === deadChannelId);
    let nextChannel = null;
    if (filteredChannels.length > 1) {
      const nextIndex = (currentIndex + 1) % filteredChannels.length;
      nextChannel = filteredChannels[nextIndex];
    }

    // 2. Borrar visualmente el canal de la lista - DESACTIVADO A PETICIÓN DEL USUARIO
    // if (onRemoveChannel) onRemoveChannel(deadChannelId);
    
    // 3. Saltar al siguiente
    if (nextChannel) {
      console.log(`[IPTV Auto-Skip] ⏭️ Canal no disponible. Saltando al siguiente: ${nextChannel.displayName}`);
      setSelectedChannel(nextChannel);
    } else {
      setSelectedChannel(null);
    }
  };

  // Memorizar las URLs para que no cambien al filtrar la lista lateral
  const memoizedStreamUrl = useMemo(() => {
    if (!selectedChannel) return null;
    return wrapUrl(selectedChannel.urls[0], selectedChannel.id);
  }, [selectedChannel, wrapUrl]);

  const memoizedStreamUrls = useMemo(() => {
    if (!selectedChannel) return [];
    return selectedChannel.urls.map(u => wrapUrl(u, selectedChannel.id));
  }, [selectedChannel, wrapUrl]);

  if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><div className="spinner" /> Cargando sistema de TV...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: 50, color: '#f87171' }}>⚠️ {error}</div>;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: isMobile ? 'column' : 'row',
      height: isMobile ? 'auto' : 'calc(100vh - 120px)', 
      background: 'linear-gradient(135deg, #0f0f1a 0%, #050505 100%)', 
      borderRadius: isMobile ? 12 : 24, 
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
      position: 'relative'
    }}>
      
      {/* BOTÓN TOGGLE (SOLO MÓVIL) */}
      {isMobile && selectedChannel && (
        <button 
          onClick={() => setShowSidebar(!showSidebar)}
          style={{
            position: 'absolute', top: 10, left: 10, zIndex: 100,
            background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
            padding: '6px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
            backdropFilter: 'blur(10px)'
          }}
        >
          {showSidebar ? '📺 Modo Cine' : '📂 Mostrar Lista'}
        </button>
      )}

      {/* ÁREA DEL REPRODUCTOR (ARRIBA EN MÓVIL, DERECHA EN PC) */}
      <div style={{ 
        flex: 1, 
        background: '#000', 
        position: 'relative', 
        display: 'flex', 
        flexDirection: 'column',
        order: isMobile ? 1 : 2,
        height: isMobile ? (showSidebar ? '35vh' : '85vh') : 'auto',
        transition: 'all 0.3s ease-in-out'
      }}>
        {selectedChannel ? (
          <>
            <div style={{ flex: 1 }}>
              <VideoPlayer 
                key={selectedChannel.id}
                streamUrl={memoizedStreamUrl}
                streamUrls={memoizedStreamUrls}
                streamType="hls"
                title={selectedChannel.displayName}
                poster={selectedChannel.logo}
                onFatalError={handleAutoSkip}
              />
            </div>
            
            {!isMobile && (
              <div style={{ padding: '20px 30px', background: 'linear-gradient(to bottom, transparent, #0a0a0f)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#fff' }}>{selectedChannel.displayName}</h2>
                      <p style={{ margin: '5px 0 0 0', color: '#00e676', fontSize: '0.9rem', fontWeight: 500 }}>
                         ● EN VIVO <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 10 }}>{selectedChannel.group}</span>
                      </p>
                    </div>
                 </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', flexDirection: 'column', gap: 20 }}>
             <span style={{ fontSize: '4rem' }}>📡</span>
             <p>Selecciona un canal para comenzar</p>
          </div>
        )}
      </div>

      {/* SIDEBAR (ABAJO EN MÓVIL, IZQUIERDA EN PC) */}
      <div style={{ 
        width: isMobile ? '100%' : 350, 
        borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.1)', 
        borderTop: isMobile ? '1px solid rgba(255,255,255,0.1)' : 'none',
        display: 'flex', 
        flexDirection: 'column',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        zIndex: 10,
        order: isMobile ? 2 : 1,
        maxHeight: isMobile ? (showSidebar ? '65vh' : '0px') : 'none',
        overflow: 'hidden',
        transition: 'all 0.3s ease-in-out'
      }}>
        
        {/* Header del Sidebar */}
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#00e676' }}>📡</span> TV en Vivo
            </h3>
            <button 
              onClick={handleUnlock}
              style={{
                background: isUnlocked ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.05)',
                border: 'none', color: isUnlocked ? '#00e676' : '#888',
                padding: '4px 8px', borderRadius: 6, fontSize: '0.7rem', cursor: 'pointer'
              }}
            >
              {isUnlocked ? '🔓 +18' : '🔒 Adultos'}
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px 10px 34px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)',
                color: '#fff', outline: 'none', fontSize: '0.85rem'
              }}
            />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
          </div>
        </div>

        {/* Carpetas / Categorías */}
        <div style={{ padding: '12px 0' }}>
          <div style={{ 
            padding: '0 20px', overflowX: 'auto', display: 'flex', gap: 8, scrollbarWidth: 'none'
          }}>
            {groups.map(g => (
              <button 
                key={g} onClick={() => setSelectedGroup(g)}
                style={{
                  padding: '6px 12px', borderRadius: 10, border: '1px solid',
                  borderColor: selectedGroup === g ? '#00e676' : 'rgba(255,255,255,0.1)',
                  background: selectedGroup === g ? 'rgba(0, 230, 118, 0.1)' : 'transparent',
                  color: selectedGroup === g ? '#00e676' : 'rgba(255,255,255,0.6)',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Canales */}
        <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
          {filteredChannels.map(c => (
            <div 
              key={c.id} 
              onClick={() => {
                setSelectedChannel(c);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px',
                borderRadius: 12, cursor: 'pointer',
                background: selectedChannel?.id === c.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                marginBottom: 4, position: 'relative'
              }}
            >
              <div style={{ 
                width: 40, height: 40, borderRadius: 10, overflow: 'hidden', 
                background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <img 
                  src={c.logo} alt="" 
                  loading="lazy"
                  style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<span style="font-size:10px;color:#444">TV</span>';
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#fff', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.displayName}
                </p>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>{c.group}</p>
              </div>
              {c.isAdult && <span style={{ fontSize: '0.6rem', color: '#ff1a26', opacity: 0.6 }}>18+</span>}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
