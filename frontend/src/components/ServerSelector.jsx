/**
 * components/ServerSelector.jsx
 * UI de selección de servidor/idioma/calidad.
 *
 * Recibe un array de streams agrupados por idioma y muestra:
 *  - Una sección por idioma (Latino, Inglés, Subtitulado…)
 *  - Botones/tarjetas por servidor dentro de cada idioma
 *  - Badge de calidad en cada tarjeta
 *
 * Al hacer clic en una tarjeta, llama a onSelect(stream).
 */

// Emoji e info visual por idioma
const LANG_META = {
  'Latino':      { emoji: '🇲🇽', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.25)' },
  'Castellano':  { emoji: '🇪🇸', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.25)' },
  'Subtitulado': { emoji: '💬', color: '#facc15', bg: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.25)' },
  'Inglés':      { emoji: '🇺🇸', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.2)' },
  'Multi':       { emoji: '🌐', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
};

const DEFAULT_META = { emoji: '📡', color: '#e2e8f0', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)' };

function getLangMeta(lang) {
  return LANG_META[lang] ?? DEFAULT_META;
}

function QualityBadge({ quality }) {
  const is1080 = quality === '1080p';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: '0.65rem', fontWeight: 800,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 99,
      background: is1080 ? 'rgba(229,9,20,0.2)' : 'rgba(255,255,255,0.1)',
      color: is1080 ? '#f87171' : '#94a3b8',
      border: `1px solid ${is1080 ? 'rgba(229,9,20,0.35)' : 'rgba(255,255,255,0.12)'}`,
    }}>
      {is1080 ? '✦' : '◆'} {quality}
    </span>
  );
}

function ServerCard({ stream, isActive, onClick }) {
  const meta = getLangMeta(stream.language);
  return (
    <button
      onClick={() => onClick(stream)}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'flex-start',
        gap:            8,
        padding:        '14px 16px',
        background:     isActive ? `rgba(229,9,20,0.15)` : 'rgba(255,255,255,0.04)',
        border:         `1px solid ${isActive ? 'rgba(229,9,20,0.5)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius:   10,
        cursor:         'pointer',
        textAlign:      'left',
        transition:     'all 0.18s ease',
        position:       'relative',
        minWidth:       130,
        flex:           '1 1 130px',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* Indicador "ACTIVO" */}
      {isActive && (
        <span style={{
          position: 'absolute', top: 8, right: 8,
          background: '#e50914', color: '#fff',
          fontSize: '0.58rem', fontWeight: 800,
          padding: '1px 6px', borderRadius: 99,
          letterSpacing: '0.08em',
        }}>EN VIVO</span>
      )}

      {/* Nombre del servidor */}
      <span style={{
        fontWeight: 700, fontSize: '0.9rem', color: '#f0f0f5',
      }}>
        {stream.server}
      </span>

      {/* Badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <QualityBadge quality={stream.quality} />
        <span style={{
          fontSize: '0.65rem', padding: '2px 8px', borderRadius: 99,
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.5)',
          border: '1px solid rgba(255,255,255,0.1)',
          textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700,
        }}>
          {stream.type?.toUpperCase()}
        </span>
      </div>
    </button>
  );
}

export default function ServerSelector({ streams, activeStream, onSelect }) {
  // Agrupar por idioma preservando el orden ya establecido (Latino primero)
  const groups = {};
  const order  = [];
  for (const s of streams) {
    if (!groups[s.language]) {
      groups[s.language] = [];
      order.push(s.language);
    }
    groups[s.language].push(s);
  }

  if (streams.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Contador total */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingBottom: 12,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <span style={{
          background: 'rgba(229,9,20,0.15)', color: '#f87171',
          border: '1px solid rgba(229,9,20,0.25)',
          fontWeight: 800, fontSize: '0.8rem',
          padding: '3px 10px', borderRadius: 99,
        }}>
          {streams.length} servidor{streams.length !== 1 ? 'es' : ''}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>
          Haz clic en un servidor para reproducir
        </span>
      </div>

      {/* Grupos por idioma */}
      {order.map((lang) => {
        const meta = getLangMeta(lang);
        return (
          <div key={lang}>
            {/* Encabezado del grupo */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 12,
            }}>
              <span style={{
                fontSize: '0.68rem', fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.12em',
                color: meta.color,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: '50%',
                  background: meta.bg, border: `1px solid ${meta.border}`,
                  fontSize: '0.75rem',
                }}>{meta.emoji}</span>
                {lang}
              </span>
              <div style={{
                flex: 1, height: 1,
                background: `linear-gradient(to right, ${meta.border}, transparent)`,
              }} />
              <span style={{
                fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)',
              }}>
                {groups[lang].length} opción{groups[lang].length !== 1 ? 'es' : ''}
              </span>
            </div>

            {/* Tarjetas de servidores */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {groups[lang].map((stream) => (
                <ServerCard
                  key={stream.sourceId}
                  stream={stream}
                  isActive={activeStream?.sourceId === stream.sourceId}
                  onClick={onSelect}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
