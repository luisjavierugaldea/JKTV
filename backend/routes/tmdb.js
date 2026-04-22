/**
 * routes/tmdb.js
 * Proxy hacia la API de TMDB.
 * El Backend actúa como intermediario para no exponer la API key en el Frontend.
 *
 * GET /api/tmdb/search?query=&type=movie|tv&page=1
 * GET /api/tmdb/movie/:id
 * GET /api/tmdb/tv/:id
 * GET /api/tmdb/trending?type=movie|tv
 */

import { Router } from 'express';
import axios from 'axios';
import { config } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';

const router = Router();

// Cliente axios preconfigurado para TMDB
const tmdb = axios.create({
  baseURL: config.tmdb.baseUrl,
  params: {
    api_key: config.tmdb.apiKey,
    language: 'es-ES', // Resultados en español por defecto
  },
  timeout: 8000,
});

/**
 * Helper: Reenvía la respuesta de TMDB normalizando errores.
 */
async function proxyTmdb(endpoint, extraParams = {}, res, next) {
  try {
    const { data } = await tmdb.get(endpoint, { params: extraParams });
    res.json({ success: true, data });
  } catch (err) {
    if (err.response) {
      return next(
        new AppError(
          `Error TMDB: ${err.response.data?.status_message ?? 'Desconocido'}`,
          err.response.status
        )
      );
    }
    next(err);
  }
}

// Búsqueda multitipo (película o serie)
router.get('/search', async (req, res, next) => {
  const { query, type = 'movie', page = 1 } = req.query;

  if (!query || query.trim().length < 2) {
    return next(new AppError('El parámetro "query" es obligatorio (mínimo 2 caracteres).', 400));
  }

  const endpoint = type === 'tv' ? '/search/tv' : '/search/movie';
  await proxyTmdb(endpoint, { query: query.trim(), page }, res, next);
});

// Detalle de película
router.get('/movie/:id', async (req, res, next) => {
  const { id } = req.params;
  await proxyTmdb(`/movie/${id}`, { append_to_response: 'credits,videos,similar' }, res, next);
});

// Detalle de serie
router.get('/tv/:id', async (req, res, next) => {
  const { id } = req.params;
  await proxyTmdb(`/tv/${id}`, { append_to_response: 'credits,videos,similar' }, res, next);
});

// Trending (películas o series populares)
router.get('/trending', async (req, res, next) => {
  const { type = 'movie', window = 'week', page = 1 } = req.query;
  const validTypes = ['movie', 'tv', 'all'];
  const validWindows = ['day', 'week'];

  if (!validTypes.includes(type)) {
    return next(new AppError(`type debe ser uno de: ${validTypes.join(', ')}`, 400));
  }
  if (!validWindows.includes(window)) {
    return next(new AppError(`window debe ser "day" o "week"`, 400));
  }

  await proxyTmdb(`/trending/${type}/${window}`, { page }, res, next);
});

// Descubrimiento por género y otras listas curadas
router.get('/discover', async (req, res, next) => {
  const { type = 'movie', genre, sort = 'popularity.desc', page = 1, country } = req.query;
  const endpoint = type === 'tv' ? '/discover/tv' : '/discover/movie';
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const params = {
    page,
    sort_by: sort,
    // Filtrar contenido sin lanzar: solo incluir hasta hoy
    ...(type === 'movie'
      ? { 'primary_release_date.lte': today, 'vote_count.gte': 20 }
      : { 'first_air_date.lte': today,       'vote_count.gte': 20 }),
    ...(genre   ? { with_genres: genre } : {}),
    ...(country ? { with_origin_country: country } : {}),
  };

  await proxyTmdb(endpoint, params, res, next);
});

// Top rated
router.get('/top-rated', async (req, res, next) => {
  const { type = 'movie', page = 1 } = req.query;
  const endpoint = type === 'tv' ? '/tv/top_rated' : '/movie/top_rated';
  await proxyTmdb(endpoint, { page }, res, next);
});

export default router;
