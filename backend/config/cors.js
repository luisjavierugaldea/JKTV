/**
 * config/cors.js
 * Configuración de CORS para Express.
 * Permite el origen del frontend en desarrollo y producción.
 */

import cors from 'cors';
import { config } from './env.js';

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir peticiones sin Origin (Postman, curl, apps nativas)
    if (!origin) return callback(null, true);

    // Permitir Capacitor (apps Android/iOS)
    if (origin.startsWith('capacitor://') || origin.startsWith('ionic://')) {
      return callback(null, true);
    }

    if (config.cors.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(
        new Error(
          `CORS bloqueado: El origen "${origin}" no está en la lista de permitidos.`
        )
      );
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  credentials: true,
  maxAge: 86400, // 24h preflight cache
};

export const corsMiddleware = cors(corsOptions);
