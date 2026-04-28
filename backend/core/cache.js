/**
 * core/cache.js
 * Sistema de caché inteligente con TTL y limpieza automática
 */

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttlTimers = new Map();
    
    // Limpieza automática cada 10 minutos
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /**
   * Guardar dato en caché con TTL
   * @param {string} key - Clave única
   * @param {*} value - Valor a cachear
   * @param {number} ttlMs - Tiempo de vida en milisegundos
   */
  set(key, value, ttlMs) {
    // Limpiar timer anterior si existe
    if (this.ttlTimers.has(key)) {
      clearTimeout(this.ttlTimers.get(key));
    }

    // Guardar valor
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs
    });

    // Configurar auto-eliminación
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttlMs);

    this.ttlTimers.set(key, timer);

    console.log(`[Cache] ✅ Guardado: ${key} (TTL: ${Math.round(ttlMs / 1000)}s)`);
  }

  /**
   * Obtener dato del caché
   * @param {string} key - Clave
   * @returns {*|null} - Valor o null si no existe/expiró
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Verificar si expiró
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }

    const age = Math.round((Date.now() - entry.timestamp) / 1000);
    console.log(`[Cache] 📦 Hit: ${key} (edad: ${age}s)`);
    return entry.value;
  }

  /**
   * Eliminar entrada del caché
   */
  delete(key) {
    if (this.ttlTimers.has(key)) {
      clearTimeout(this.ttlTimers.get(key));
      this.ttlTimers.delete(key);
    }
    this.cache.delete(key);
    console.log(`[Cache] 🗑️  Eliminado: ${key}`);
  }

  /**
   * Limpiar entradas expiradas
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Cache] 🧹 Limpieza: ${cleaned} entradas eliminadas`);
    }
  }

  /**
   * Obtener estadísticas del caché
   */
  getStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Limpiar todo el caché
   */
  clear() {
    for (const timer of this.ttlTimers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.ttlTimers.clear();
    console.log('[Cache] 🧨 Cache completo limpiado');
  }
}

// Singleton
const cacheManager = new CacheManager();

export default cacheManager;
