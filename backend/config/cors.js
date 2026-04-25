/**
 * config/cors.js
 * Configuración de CORS para Express.
 * En desarrollo: acepta cualquier origen (cómodo para celular/tablet/APK).
 * En producción: solo acepta orígenes de la lista de .env
 */

import cors from 'cors';
import { config } from './env.js';

const corsOptions = {
  origin: (origin, callback) => {
    // En desarrollo, aceptar TODO. Es seguro porque el backend no está expuesto en internet.
    if (config.isDev) {
      return callback(null, true);
    }

    // Permitir peticiones sin Origin (Postman, curl, apps nativas, Capacitor)
    if (!origin) return callback(null, true);

    // Permitir Capacitor (apps Android/iOS)
    if (
      origin.startsWith('capacitor://') ||
      origin.startsWith('ionic://') ||
      origin === 'http://localhost'
    ) {
      return callback(null, true);
    }

    // En producción: verificar lista de orígenes permitidos
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
