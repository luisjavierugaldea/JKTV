import { Router } from 'express';
import { scraperLimiter } from '../middlewares/rateLimiter.js';
import { AppError } from '../middlewares/errorHandler.js';
import { extractAllStreams } from '../scrapers/streamExtractor.js';

const router = Router();

// ─── Caché en Servidor (persiste entre sesiones de navegador) ────────────────
// TTL: 2 horas — suficiente para una sesión de maratón
const CACHE_TTL = 2 * 60 * 60 * 1000;
const serverCache = new Map();

function getCacheKey(title, year, type, season, episode) {
  const ep = type === 'tv' ? `|S${season}E${episode}` : '';
  return `${title.toLowerCase().trim()}|${year ?? ''}|${type}${ep}`;
}

// Limpieza automática cada 30 minutos para no acumular memoria
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, val] of serverCache.entries()) {
    if (now > val.expiresAt) { serverCache.delete(key); cleaned++; }
  }
  if (cleaned > 0) console.log(`🗑️  [StreamCache] Limpieza automática: ${cleaned} entradas expiradas eliminadas.`);
}, 30 * 60 * 1000);

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

  const cleanTitle = title.trim();
  const cacheKey = getCacheKey(cleanTitle, year, type, seasonNum, episodeNum);

  // ── Revisar caché del servidor primero ────────────────────────────────────
  const cached = serverCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`⚡ [StreamCache] HIT servidor → "${cleanTitle}" (${type}${type === 'tv' ? ` S${seasonNum}E${episodeNum}` : ''})`);
    return res.json(cached.result);
  }

  // ── Timeout global de 90 segundos ─────────────────────────────────────────
  const GLOBAL_TIMEOUT = 90_000;
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new AppError(
        `La búsqueda de servidores superó el tiempo límite (${GLOBAL_TIMEOUT / 1000}s). Intenta de nuevo más tarde.`,
        504
      ));
    }, GLOBAL_TIMEOUT);
  });

  try {
    const result = await Promise.race([
      extractAllStreams({
        title:   cleanTitle,
        year:    year?.trim(),
        type,
        season:  seasonNum,
        episode: episodeNum,
      }),
      timeoutPromise,
    ]);

    // ── Guardar en caché del servidor si fue exitoso ───────────────────────
    if (result?.success && result?.streams?.length > 0) {
      serverCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL });
      console.log(`💾 [StreamCache] GUARDADO → "${cleanTitle}" (${serverCache.size} entradas en caché)`);
    }

    return res.json(result);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    console.error('❌ [Stream] Error inesperado:', err);
    return next(new AppError(
      'Ocurrió un error al buscar servidores. Los scrapers pueden estar inaccesibles. Intenta de nuevo más tarde.',
      502
    ));
  }
});

export default router;
