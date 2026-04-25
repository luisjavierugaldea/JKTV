/**
 * config/env.js
 * Carga y valida todas las variables de entorno al arrancar.
 * Si falta alguna crítica, el proceso termina con un mensaje claro.
 */

import 'dotenv/config';
import os from 'os';

const required = ['TMDB_API_KEY'];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌  [ENV] Falta la variable de entorno requerida: ${key}`);
    console.error(`    Copia .env.example a .env y rellena el valor.`);
    process.exit(1);
  }
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isDev: (process.env.NODE_ENV ?? 'development') === 'development',

  tmdb: {
    apiKey: process.env.TMDB_API_KEY,
    baseUrl: process.env.TMDB_BASE_URL ?? 'https://api.themoviedb.org/3',
  },

  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    anonKey: process.env.SUPABASE_ANON_KEY ?? '',
  },

  cors: {
    allowedOrigins: (() => {
      // Orígenes base
      const base = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:3000')
        .split(',')
        .map((o) => o.trim());

      // Auto-detectar IPs de red locales y añadirlas (para celular/tablet en el mismo WiFi)
      const ifaces = os.networkInterfaces();
      for (const iface of Object.values(ifaces)) {
        for (const details of iface) {
          if (details.family === 'IPv4' && !details.internal) {
            const ip = details.address;
            base.push(`http://${ip}:3000`);
            base.push(`http://${ip}:5173`);
            base.push(`http://${ip}`);
            console.log(`[CORS] ✅ IP local detectada: ${ip} — añadida a orígenes permitidos`);
          }
        }
      }
      return base;
    })(),
  },

  scraper: {
    headless: process.env.SCRAPER_HEADLESS !== 'false',
    timeoutMs: parseInt(process.env.SCRAPER_TIMEOUT_MS ?? '30000', 10),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
  },
};
