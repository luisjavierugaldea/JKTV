/**
 * hooks/useDPadNavigation.js
 * Hook para navegación con control remoto de Android TV
 * Maneja teclas: Arriba, Abajo, Izquierda, Derecha, Enter/Select, Back
 */
import { useEffect, useCallback } from 'react';

const DPAD_KEYS = {
  UP: ['ArrowUp', 38],
  DOWN: ['ArrowDown', 40],
  LEFT: ['ArrowLeft', 37],
  RIGHT: ['ArrowRight', 39],
  SELECT: ['Enter', 13, ' ', 32],
  BACK: ['Escape', 27, 'Backspace', 8],
};

export function useDPadNavigation({ 
  onUp, 
  onDown, 
  onLeft, 
  onRight, 
  onSelect, 
  onBack,
  enabled = true 
}) {
  const handleKeyDown = useCallback((event) => {
    if (!enabled) return;

    const key = event.key;
    const keyCode = event.keyCode || event.which;

    // Prevenir scroll default de las flechas
    if ([37, 38, 39, 40].includes(keyCode)) {
      event.preventDefault();
    }

    // UP
    if (DPAD_KEYS.UP.includes(key) || DPAD_KEYS.UP.includes(keyCode)) {
      event.preventDefault();
      onUp?.();
      return;
    }

    // DOWN
    if (DPAD_KEYS.DOWN.includes(key) || DPAD_KEYS.DOWN.includes(keyCode)) {
      event.preventDefault();
      onDown?.();
      return;
    }

    // LEFT
    if (DPAD_KEYS.LEFT.includes(key) || DPAD_KEYS.LEFT.includes(keyCode)) {
      event.preventDefault();
      onLeft?.();
      return;
    }

    // RIGHT
    if (DPAD_KEYS.RIGHT.includes(key) || DPAD_KEYS.RIGHT.includes(keyCode)) {
      event.preventDefault();
      onRight?.();
      return;
    }

    // SELECT (Enter/Space)
    if (DPAD_KEYS.SELECT.includes(key) || DPAD_KEYS.SELECT.includes(keyCode)) {
      event.preventDefault();
      onSelect?.();
      return;
    }

    // BACK (Escape/Backspace)
    if (DPAD_KEYS.BACK.includes(key) || DPAD_KEYS.BACK.includes(keyCode)) {
      event.preventDefault();
      onBack?.();
      return;
    }
  }, [enabled, onUp, onDown, onLeft, onRight, onSelect, onBack]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

/**
 * Hook para detectar si estamos en Android TV
 */
export function useIsAndroidTV() {
  const isTV = typeof window !== 'undefined' && (
    // Detectar por user agent
    /Android TV|BRAVIA|SmartTV/i.test(navigator.userAgent) ||
    // Detectar por características del dispositivo
    (window.matchMedia('(pointer: coarse)').matches && 
     window.matchMedia('(min-width: 1280px)').matches)
  );

  return isTV;
}

/**
 * Clase helper para focus management
 */
export class FocusManager {
  constructor() {
    this.focusableElements = [];
    this.currentIndex = 0;
  }

  setElements(elements) {
    this.focusableElements = elements.filter(el => el && !el.disabled);
    if (this.focusableElements.length > 0 && this.currentIndex >= this.focusableElements.length) {
      this.currentIndex = 0;
    }
  }

  focusCurrent() {
    const current = this.focusableElements[this.currentIndex];
    if (current) {
      current.focus();
      current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  focusNext() {
    if (this.focusableElements.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.focusableElements.length;
    this.focusCurrent();
  }

  focusPrevious() {
    if (this.focusableElements.length === 0) return;
    this.currentIndex = this.currentIndex - 1;
    if (this.currentIndex < 0) {
      this.currentIndex = this.focusableElements.length - 1;
    }
    this.focusCurrent();
  }

  focusFirst() {
    this.currentIndex = 0;
    this.focusCurrent();
  }

  focusLast() {
    this.currentIndex = Math.max(0, this.focusableElements.length - 1);
    this.focusCurrent();
  }
}
