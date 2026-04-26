/**
 * components/ServerSelector.jsx
 * Panel compacto tipo YouTube — aparece sobre el video como un menú flotante.
 * Se abre/cierra con un botón ⚙️ sin interrumpir la reproducción.
 */
import { useEffect, useRef } from 'react';

const LANG_META = {
  'Latino':      { emoji: '🇲🇽', color: '#22c55e' },
  'Castellano':  { emoji: '🇪🇸', color: '#60a5fa' },
  'Subtitulado': { emoji: '💬',  color: '#facc15' },
  'Inglés':      { emoji: '🇺🇸', color: '#94a3b8' },
  'Multi':       { emoji: '🌐',  color: '#a78bfa' },
};
const DEFAULT_META = { emoji: '📡', color: '#e2e8f0' };
const getLangMeta = (lang) => LANG_META[lang] ?? DEFAULT_META;

/**
 * Panel flotante — estilo menú de configuración de YouTube.
 * isOpen / onClose controlan su visibilidad.
 */
export default function ServerSelector({ streams, activeStream, onSelect, isOpen, onClose }) {
  const panelRef = useRef(null);

  // Cerrar al hacer clic fuera del panel
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [isOpen, onClose]);

  // Agrupar por idioma
  const groups = {};
  const order = [];
  for (const s of streams) {
    if (!groups[s.language]) { groups[s.language] = []; order.push(s.language); }
    groups[s.language].push(s);
  }

  if (!isOpen || streams.length === 0) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        bottom: 52,       // justo encima de la barra de controles del player
        right: 8,
        zIndex: 200,
        width: 'min(320px, calc(100vw - 24px))',
        background: 'rgba(18,18,26,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
        overflow: 'hidden',
        animation: 'slideUpPanel 0.18s ease',
      }}
    >
      <style>{`
        @keyframes slideUpPanel {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Cabecera del panel */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>
          ⚙️ Cambiar servidor
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.08)', border: 'none',
            color: 'rgba(255,255,255,0.7)', borderRadius: 6,
            width: 26, height: 26, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.85rem', fontWeight: 700,
          }}
        >✕</button>
      </div>

      {/* Lista de opciones */}
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: '8px 0' }}>
        {order.map((lang) => {
          const meta = getLangMeta(lang);
          return (
            <div key={lang}>
              {/* Encabezado de grupo de idioma */}
              <div style={{
                padding: '6px 16px 4px',
                fontSize: '0.68rem', fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.12em',
                color: meta.color, opacity: 0.8,
              }}>
                {meta.emoji} {lang}
              </div>

              {/* Opciones de servidor */}
              {groups[lang].map((stream) => {
                const isActive = activeStream?.sourceId === stream.sourceId;
                return (
                  <button
                    key={stream.sourceId}
                    onClick={() => { onSelect(stream); onClose(); }}
                    style={{
                      width: '100%', display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 16px', border: 'none',
                      background: isActive ? 'rgba(229,9,20,0.15)' : 'transparent',
                      color: '#fff', cursor: 'pointer',
                      transition: 'background 0.15s',
                      gap: 10,
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      {/* Punto activo */}
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: isActive ? '#e50914' : 'rgba(255,255,255,0.2)',
                        boxShadow: isActive ? '0 0 6px rgba(229,9,20,0.8)' : 'none',
                      }} />
                      <span style={{
                        fontSize: '0.88rem', fontWeight: isActive ? 700 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {stream.server}
                      </span>
                    </div>
                    {/* Badges calidad */}
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 800,
                        padding: '2px 6px', borderRadius: 99,
                        background: stream.quality === '1080p' || stream.quality === 'Full HD'
                          ? 'rgba(229,9,20,0.2)' : 'rgba(255,255,255,0.08)',
                        color: stream.quality === '1080p' || stream.quality === 'Full HD'
                          ? '#f87171' : '#94a3b8',
                        border: `1px solid ${stream.quality === '1080p' || stream.quality === 'Full HD'
                          ? 'rgba(229,9,20,0.35)' : 'rgba(255,255,255,0.1)'}`,
                        textTransform: 'uppercase',
                      }}>
                        {stream.quality}
                      </span>
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 700,
                        padding: '2px 6px', borderRadius: 99,
                        background: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.4)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        textTransform: 'uppercase',
                      }}>
                        {stream.type}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
