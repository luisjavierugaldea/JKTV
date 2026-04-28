/**
 * server.js — Punto de entrada del backend "JKTV"
 *
 * Stack: Node.js + Express
 * Ejecutar en desarrollo: npm run dev
 * Ejecutar en producción: npm start
 * Última actualización: 2026-04-25 - Fix de compatibilidad Windows/Linux (Railway)
 */

import express from 'express';
import http from 'http';
import { EventEmitter } from 'events';
import helmet from 'helmet';
import { createServer as createTcpServer } from 'net';
import { execSync } from 'child_process';
import fs from 'fs';

// 🚀 Aumentar el límite para procesar miles de canales sin advertencias de memoria
EventEmitter.defaultMaxListeners = 100;

// Config — debe cargarse primero (valida .env y hace process.exit si faltan vars)
import { config } from './config/env.js';
import { corsMiddleware } from './config/cors.js';

// Middlewares
import { requestLogger } from './middlewares/requestLogger.js';
import { generalLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';

// Rutas
import healthRouter from './routes/health.js';
import tmdbRouter from './routes/tmdb.js';
import streamRouter from './routes/stream.js';
import proxyStreamRouter from './routes/proxyStream.js';
import animeRouter from './routes/anime.js';
import torrentProxyRouter from './routes/torrentProxy.js';
import iptvRouter from './routes/iptv.js';
import iptvProxyRouter from './routes/iptvProxy.js';
import musicRouter from './routes/music.js';
import eventsRouter from './routes/events.js';
import channelsRouter from './routes/channels.js';
import tvRouter from './routes/tv.js';
import otaRouter from './routes/ota.js';

// Browser pool (para cierre limpio en shutdown)
import { closeBrowser } from './scrapers/browserPool.js';

// Agregador de contenido IPTV
import aggregator from './core/aggregator.js';

// ─── Liberar puerto si está ocupado (Solo para Windows/Desarrollo) ────────────
function freePort(port, maxRetries = 3) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const checkPort = () => {
      attempts++;
      const tester = createTcpServer();

      tester.once('error', async () => {
        tester.close();

        if (attempts >= maxRetries) {
          console.error(`❌  No se pudo liberar el puerto ${port} después de ${maxRetries} intentos.`);
          return reject(new Error(`Puerto ${port} ocupado después de ${maxRetries} intentos`));
        }

        console.log(`⚠️  Puerto ${port} en uso. Intentando liberar (intento ${attempts}/${maxRetries})...`);

        try {
          const out = execSync(`netstat -ano | findstr ":${port} "`, { encoding: 'utf8' });
          const pids = [...new Set(
            out.split('\n')
              .filter((l) => l.includes('LISTENING'))
              .map((l) => l.trim().split(/\s+/).at(-1))
              .filter(Boolean)
          )];

          if (pids.length === 0) {
            console.log(`⏳  Esperando que el SO libere el puerto ${port}...`);
          } else {
            pids.forEach((pid) => {
              try {
                execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
                console.log(`⚡  PID ${pid} terminado.`);
              } catch (err) {
                console.warn(`⚠️  No se pudo terminar PID ${pid}`);
              }
            });
          }
        } catch (err) {
          // netstat sin resultados o error
        }

        // Esperar más tiempo para que el SO libere el puerto
        setTimeout(checkPort, 1000);
      });

      tester.once('listening', () => {
        tester.close();
        if (attempts > 1) {
          console.log(`✅  Puerto ${port} ahora está disponible.`);
        }
        resolve();
      });

      tester.listen(port, '0.0.0.0');
    };

    checkPort();
  });
}

// ─── Inicialización ───────────────────────────────────────────────────────────
const app = express();

// ─── Middlewares Globales ─────────────────────────────────────────────────────

// Seguridad HTTP (headers)
app.use(
  helmet({
    // Permite cargar contenido multimedia de orígenes externos (necesario para streams)
    contentSecurityPolicy: false,
    // Permite que el frontend lea el stream de audio desde otro origen
    crossOriginResourcePolicy: false,
    // Permite que el frontend (puerto 3000) pueda incrustar el iframe del backend (puerto 3001)
    xFrameOptions: false,
  })
);

// CORS
app.use(corsMiddleware);

// Logger de peticiones
app.use(requestLogger);

// Rate limiter general
app.use(generalLimiter);

// Parseo de JSON y URL-encoded
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── Rutas de la API ──────────────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/tmdb', tmdbRouter);
app.use('/api/stream', streamRouter);
app.use('/api/proxy-stream', proxyStreamRouter);
app.use('/api/anime', animeRouter);
app.use('/api/torrent', torrentProxyRouter);
app.use('/api/iptv', iptvRouter);
app.use('/api/iptv-proxy', iptvProxyRouter);
app.use('/api/music', musicRouter);
app.use('/api/events', eventsRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/tv', tvRouter);            // Nueva sección TV agregada
app.use('/app', otaRouter);              // Sistema OTA

// Ruta de fallback para endpoints no existentes
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Endpoint no encontrado. Consulta /api/health para ver el estado del servidor.',
    },
  });
});

// ─── Manejo Global de Errores (debe ir al final) ──────────────────────────────
app.use(errorHandler);

// ─── Arranque del Servidor ────────────────────────────────────────────────────
async function startServer(isRetry = false) {
  // 🌟 VARIABLE DE ENTORNO SEGURA: Detecta si estamos en Railway (Producción)
  const isProd = config.nodeEnv === 'production' || process.env.NODE_ENV === 'production';

  try {
    // 🛡️ FIX NUBE: Solo liberamos el puerto si estamos en nuestra PC con Windows
    if (!isProd) {
      await freePort(config.port);
    }

    // Crear servidor HTTP con límite de URI ampliado (fix para streams con URLs muy largas)
    const server = http.createServer({ maxHeaderSize: 262144 }, app);

    server.listen(config.port, () => {
      console.log(`\n🎬  JKTV Backend`);
      console.log(`    Entorno    : ${isProd ? '☁️ Producción (Nube)' : '💻 Desarrollo (Local)'}`);
      console.log(`    Puerto     : ${config.port}`);
      console.log(`    Health     : http://localhost:${config.port}/api/health`);
      console.log(`\n    ✅  Servidor listo. Esperando peticiones...\n`);

      console.log('    🎬  Motor FFmpeg listo y conectado al sistema\n');

      // Inicializar agregador de contenido IPTV
      aggregator.initialize().catch(err => {
        console.error('❌  Error inicializando agregador:', err);
      });
    });

    server.on('error', async (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌  Error: El puerto ${config.port} ya está en uso.`);

        // 🛡️ FIX NUBE: Solo ejecutamos comandos de Windows (taskkill) si estamos en local
        if (!isRetry && !isProd) {
          console.log(`🔄  Ejecutando: taskkill /F /IM node.exe`);
          try {
            execSync('taskkill /F /IM node.exe', { stdio: 'ignore' });
            console.log(`⏳  Esperando 2 segundos antes de reintentar...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log(`🔄  Reintentando iniciar el servidor...\n`);
            return startServer(true);
          } catch (killErr) {
            console.error(`⚠️  Error al ejecutar taskkill:`, killErr.message);
          }
        } else if (isProd) {
          console.error(`\n❌  Error Crítico en la Nube: Puerto bloqueado. Revisar logs de Railway.`);
          process.exit(1);
        }

        console.error(`\n❌  No se pudo liberar el puerto después del reintento.`);
        process.exit(1);
      } else {
        console.error(`\n❌  Error al iniciar el servidor:`, err);
        process.exit(1);
      }
    });

    // Guardamos la referencia del servidor globalmente para apagarlo limpio luego
    global.jktvServer = server;

  } catch (err) {
    // 🛡️ FIX NUBE: Mismo escudo protector para el bloque catch
    if (!isRetry && !isProd) {
      console.error(`\n❌  Error al liberar el puerto ${config.port}:`, err.message);
      console.log(`🔄  Ejecutando: taskkill /F /IM node.exe`);
      try {
        execSync('taskkill /F /IM node.exe', { stdio: 'ignore' });
        console.log(`⏳  Esperando 2 segundos antes de reintentar...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log(`🔄  Reintentando iniciar el servidor...\n`);
        return startServer(true);
      } catch (killErr) {
        console.error(`⚠️  Error al ejecutar taskkill:`, killErr.message);
      }
    } else if (isProd) {
      console.error(`\n❌  Error Crítico en la Nube:`, err.message);
      process.exit(1);
    }

    console.error(`\n❌  No se pudo iniciar el servidor.`);
    process.exit(1);
  }
}

startServer();

// ─── Manejo elegante de cierre (SIGTERM / SIGINT) ─────────────────────────────
// (Movido aquí para no duplicarse y cerrar los scrapers limpiamente)
async function shutdown(signal) {
  console.log(`\n🛑  Señal ${signal} recibida. Apagando servidor...`);

  // 1. Matamos los navegadores ocultos de Playwright
  await closeBrowser();

  // 2. Cerramos el servidor HTTP
  if (global.jktvServer) {
    global.jktvServer.close(() => {
      console.log('👋  Servidor apagado limpiamente.\n');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Prevención de Crashes Globales (ej. Errores de Playwright Stealth) ───────
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Global] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [Global] Uncaught Exception:', err.message);
  // No salimos del proceso (process.exit) para evitar que la app se caiga por completo
  // si un scraper o navegador oculto lanza un error repentino.
});

export default app;