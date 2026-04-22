/**
 * middlewares/rateLimiter.js
 * Limitador de tasa ajustado para uso local intensivo.
 */

import rateLimit from 'express-rate-limit';

// Limiter general para todas las rutas (agradable para desarrollo local)
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 2000,                // 2000 peticiones (imposible de bloquearte solo)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Demasiadas peticiones. Intenta de nuevo más tarde.',
    },
  },
});

// Limiter para el scraper (donde más se suele notar el bloqueo)
export const scraperLimiter = rateLimit({
  windowMs: 60_000, // 1 minuto
  max: 100,         // 100 búsquedas por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message:
        'Límite de búsqueda alcanzado. El sistema está procesando demasiado, espera un momento.',
    },
  },
});
