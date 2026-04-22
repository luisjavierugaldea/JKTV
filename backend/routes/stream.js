/**
 * routes/stream.js — FASE 2: Endpoint de extracción de streams
 *
 * GET /api/stream
 *   ?title=   Título de la película o serie (obligatorio)
 *   ?year=    Año de estreno (opcional, mejora la precisión)
 *   ?type=    "movie" | "tv" (por defecto: "movie")
 *   ?season=  Temporada (solo para type=tv, por defecto: 1)
 *   ?episode= Episodio (solo para type=tv, por defecto: 1)
 *
 * Ejemplos de uso en Postman:
 *   GET http://localhost:3001/api/stream?title=Inception&year=2010
 *   GET http://localhost:3001/api/stream?title=Breaking+Bad&type=tv&season=1&episode=1
 *   GET http://localhost:3001/api/stream?title=Avengers+Endgame&year=2019
 *
 * Respuesta exitosa (200):
 *   {
 *     "success": true,
 *     "stream": {
 *       "url": "https://cdn.example.com/stream.m3u8",
 *       "type": "hls",
 *       "source": { "id": "vidsrc_me", "name": "VidSrc.me" }
 *     },
 *     "media": {
 *       "tmdbId": "27205",
 *       "title": "Inception",
 *       "year": "2010",
 *       "posterPath": "https://image.tmdb.org/t/p/w500/...",
 *       "overview": "...",
 *       "voteAverage": 8.3,
 *       "contentType": "movie"
 *     }
 *   }
 */

import { Router } from 'express';
import { scraperLimiter } from '../middlewares/rateLimiter.js';
import { AppError } from '../middlewares/errorHandler.js';
import { extractAllStreams } from '../scrapers/streamExtractor.js';

const router = Router();

/**
 * GET /api/stream — Multi-servidor
 *
 * Respuesta: {
 *   success: true,
 *   streams: [
 *     { server, language, quality, url, directUrl, type, sourceId },
 *     ...
 *   ],
 *   media: { tmdbId, title, year, posterPath, overview, voteAverage }
 * }
 */
router.get('/', scraperLimiter, async (req, res, next) => {
  const { title, year, type = 'movie', season, episode } = req.query;

  if (!title || title.trim().length < 2) {
    return next(new AppError('El parámetro "title" es obligatorio (mínimo 2 caracteres).', 400));
  }
  if (!['movie', 'tv'].includes(type)) {
    return next(new AppError('El parámetro "type" debe ser "movie" o "tv".', 400));
  }
  if (year && !/^\d{4}$/.test(year)) {
    return next(new AppError('El parámetro "year" debe ser un año de 4 dígitos.', 400));
  }

  const seasonNum  = season  ? parseInt(season, 10)  : 1;
  const episodeNum = episode ? parseInt(episode, 10) : 1;

  if (isNaN(seasonNum)  || seasonNum  < 1) return next(new AppError('"season" debe ser positivo.', 400));
  if (isNaN(episodeNum) || episodeNum < 1) return next(new AppError('"episode" debe ser positivo.', 400));

  // ── Timeout global de 90 segundos para toda la operación ──────────────────
  const GLOBAL_TIMEOUT = 90_000;
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new AppError(
        `La búsqueda de servidores superó el tiempo límite (${GLOBAL_TIMEOUT / 1000}s). ` +
        `Los scrapers pueden estar experimentando problemas. Intenta de nuevo más tarde.`,
        504
      ));
    }, GLOBAL_TIMEOUT);
  });

  try {
    const result = await Promise.race([
      extractAllStreams({
        title:   title.trim(),
        year:    year?.trim(),
        type,
        season:  seasonNum,
        episode: episodeNum,
      }),
      timeoutPromise,
    ]);
    return res.json(result);
  } catch (err) {
    // Asegurar que siempre devolvemos un error apropiado
    if (err instanceof AppError) {
      return next(err);
    }
    // Error genérico
    console.error('❌ [Stream] Error inesperado:', err);
    return next(new AppError(
      'Ocurrió un error al buscar servidores. Los scrapers pueden estar inaccesibles. Intenta de nuevo más tarde.',
      502
    ));
  }
});

export default router;
