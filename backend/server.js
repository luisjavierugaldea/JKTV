/**
 * server.js — Punto de entrada del backend "JKTV"
 *
 * Stack: Node.js + Express
 * Ejecutar en desarrollo: npm run dev
 * Ejecutar en producción: npm start
 * Última actualización: 2026-04-22 - Rutas de anime + películas/series activas
 */

import express from 'express';
import helmet from 'helmet';
import { createServer as createTcpServer } from 'net';
import { execSync } from 'child_process';

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

// Browser pool (para cierre limpio en shutdown)
import { closeBrowser } from './scrapers/browserPool.js';

// ─── Liberar puerto si está ocupado ──────────────────────────────────────────
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
  try {
    await freePort(config.port);
    
    const server = app.listen(config.port, () => {
      console.log(`\n🎬  Stremio Clone Backend`);
      console.log(`    Entorno    : ${config.nodeEnv}`);
      console.log(`    Puerto     : ${config.port}`);
      console.log(`    Health     : http://localhost:${config.port}/api/health`);
      console.log(`    TMDB Proxy : http://localhost:${config.port}/api/tmdb/trending`);
      console.log(`    Stream     : http://localhost:${config.port}/api/stream?title=Inception&year=2010`);
      console.log(`\n    Origenes CORS permitidos:`);
      config.cors.allowedOrigins.forEach((o) => console.log(`      • ${o}`));
      console.log('\n    ✅  Servidor listo. Esperando peticiones...\n');
    });
    
    server.on('error', async (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌  Error: El puerto ${config.port} ya está en uso.`);
        
        if (!isRetry) {
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
        }
        
        console.error(`\n❌  No se pudo liberar el puerto después del reintento.`);
        console.error(`    Ejecuta manualmente: taskkill /F /IM node.exe\n`);
        process.exit(1);
      } else {
        console.error(`\n❌  Error al iniciar el servidor:`, err);
        process.exit(1);
      }
    });
    
    // Manejo de señales para cierre limpio
    const shutdown = async (signal) => {
      console.log(`\n⚠️  Señal ${signal} recibida. Cerrando servidor...`);
      await closeBrowser();
      server.close(() => {
        console.log('✅  Servidor cerrado correctamente.');
        process.exit(0);
      });
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
  } catch (err) {
    if (!isRetry) {
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
    }
    
    console.error(`\n❌  No se pudo iniciar el servidor después del reintento.`);
    console.error(`    Ejecuta manualmente: netstat -ano | findstr ":${config.port}"\n`);
    process.exit(1);
  }
}

startServer();

// Manejo elegante de cierre (SIGTERM / SIGINT)
async function shutdown(signal) {
  console.log(`\n🛑  Señal ${signal} recibida. Apagando servidor...`);
  await closeBrowser(); // Cerrar instancia de Chromium
  console.log('👋  Servidor apagado limpiamente.\n');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
