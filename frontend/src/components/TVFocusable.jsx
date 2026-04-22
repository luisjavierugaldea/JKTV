/**
 * components/TVFocusable.jsx
 * Componente wrapper que hace cualquier elemento navegable con D-Pad
 * Añade estilos de focus visual mejorados para Android TV
 */
import { useRef, useEffect } from 'react';

export default function TVFocusable({ 
  children, 
  onSelect, 
  onFocus,
  className = '',
  autoFocus = false,
  ...props 
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e) => {
    // Enter o Space = activar
    if ((e.key === 'Enter' || e.key === ' ') && onSelect) {
      e.preventDefault();
      onSelect(e);
    }
  };

  const handleFocus = (e) => {
    // Scroll al elemento cuando recibe focus
    if (ref.current) {
      ref.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }
    onFocus?.(e);
  };

  return (
    <div
      ref={ref}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      className={`tv-focusable ${className}`}
      {...props}
    >
      {children}
      
      <style jsx>{`
        .tv-focusable {
          outline: none;
          position: relative;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          cursor: pointer;
        }

        .tv-focusable:focus {
          transform: scale(1.08);
          z-index: 10;
          box-shadow: 
            0 0 0 4px rgba(229, 9, 20, 0.8),
            0 8px 32px rgba(0, 0, 0, 0.6);
        }

        .tv-focusable:focus::before {
          content: '';
          position: absolute;
          inset: -4px;
          border: 3px solid #e50914;
          border-radius: inherit;
          pointer-events: none;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.02);
          }
        }

        /* Scroll suave para navegación */
        :global(body:has(.tv-focusable:focus)) {
          scroll-behavior: smooth;
        }
      `}</style>
    </div>
  );
}
