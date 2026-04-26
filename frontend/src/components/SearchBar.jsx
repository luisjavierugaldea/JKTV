/**
 * components/SearchBar.jsx
 * Barra de búsqueda con debounce integrado.
 */
import { useState, useEffect, useRef } from 'react';

export default function SearchBar({ onSearch, type, onTypeChange }) {
  const [value, setValue] = useState('');
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  // Clear search bar when switching categories
  useEffect(() => {
    setValue('');
  }, [type]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Cancelar la petición anterior si sigue en vuelo
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      // No buscar si hay menos de 3 letras (evita bombardear el backend)
      const q = value.trim();
      if (q.length === 0 || q.length >= 3) {
        onSearch(q, controller.signal);
      }
    }, 600); // Aumentado a 600ms para mayor estabilidad
    return () => clearTimeout(timerRef.current);
  }, [value]);

  return (
    <div style={{ position: 'relative', width: '100%' }} className="search-bar-wrapper">
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
  );
}
