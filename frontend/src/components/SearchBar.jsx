/**
 * components/SearchBar.jsx
 * Barra de búsqueda con debounce integrado.
 */
import { useState, useEffect, useRef } from 'react';

export default function SearchBar({ onSearch, type, onTypeChange }) {
  const [value, setValue] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearch(value.trim());
    }, 450); // debounce 450ms
    return () => clearTimeout(timerRef.current);
  }, [value]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 640, width: '100%' }} className="search-bar-wrapper">
      {/* Selector de tipo */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          className={`tab-btn ${type === 'movie' ? 'active' : ''}`}
          onClick={() => onTypeChange('movie')}
        >🎬 Películas</button>
        <button
          className={`tab-btn ${type === 'tv' ? 'active' : ''}`}
          onClick={() => onTypeChange('tv')}
        >📺 Series</button>
        <button
          className={`tab-btn ${type === 'anime' ? 'active' : ''}`}
          onClick={() => onTypeChange('anime')}
        >🎌 Anime</button>
        <button
          className={`tab-btn ${type === 'kdrama' ? 'active' : ''}`}
          onClick={() => onTypeChange('kdrama')}
        >🇰🇷 KDramas</button>
      </div>

      {/* Input */}
      <div style={{ position: 'relative', width: '100%' }}>
        <span className="search-icon" style={{
          position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)', fontSize: '1.1rem', pointerEvents: 'none', zIndex: 1,
        }}>🔍</span>
        <input
          id="search-input"
          className="search-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            type === 'tv'     ? 'Buscar series…'  :
            type === 'anime'  ? 'Buscar anime…'   :
            type === 'kdrama' ? 'Buscar KDramas…' :
                                'Buscar películas…'
          }
          autoComplete="off"
          spellCheck="false"
        />
        {value && (
          <button
            onClick={() => setValue('')}
            aria-label="Limpiar búsqueda"
            style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: '1rem', padding: 4, zIndex: 1,
            }}
          >✕</button>
        )}
      </div>
    </div>
  );
}
