/**
 * routes/tmdb.js
 * Proxy hacia la API de TMDB con búsqueda inteligente (Fuzzy Search).
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
    language: 'es-MX', // 🇲🇽 Español Latino
  },
  timeout: 8000,
});

/**
 * Helper: Llama a TMDB y devuelve la data directamente.
 */
async function proxyTmdb(endpoint, extraParams = {}) {
  const { data } = await tmdb.get(endpoint, { params: extraParams });
  return data;
}

// ─── FUZZY SEARCH: Generador de Variantes Ortográficas ───────────────────────
// Dado "sherk", genera "shrek", "shrk", "serk", etc. para tolerar dislexia.
function generateFuzzyVariants(query) {
  const q = query.toLowerCase().trim();
  const variants = new Set();

  // 1. Transposición de letras adyacentes: "sherk" → "shrek", "hserk", "seerk"...
  for (let i = 0; i < q.length - 1; i++) {
    const arr = q.split('');
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    variants.add(arr.join(''));
  }

  // 2. Eliminación de una letra: "shrek" → "hrek", "srek", "shek", "shrk", "shre"
  for (let i = 0; i < q.length; i++) {
    variants.add(q.slice(0, i) + q.slice(i + 1));
  }

  // 3. Sustitución fonética española: k↔c, v↔b, y↔i, z↔s
  const phonetic = { 'k': 'c', 'c': 'k', 'v': 'b', 'b': 'v', 'y': 'i', 'i': 'y', 'z': 's', 's': 'z' };
  for (let i = 0; i < q.length; i++) {
    if (phonetic[q[i]]) {
      variants.add(q.slice(0, i) + phonetic[q[i]] + q.slice(i + 1));
    }
  }

  // Quitar el original y variantes muy cortas
  variants.delete(q);
  return [...variants].filter(v => v.length >= 3).slice(0, 8);
}

// ─── RUTA: Búsqueda con Corrección Automática ────────────────────────────────
router.get('/search', async (req, res, next) => {
  const { query, type = 'movie', page = 1 } = req.query;

  if (!query || query.trim().length < 2) {
    return next(new AppError('El parámetro "query" es obligatorio (mínimo 2 caracteres).', 400));
  }

  const cleanQuery = query.trim();
  const endpoint = type === 'tv' ? '/search/tv' : '/search/movie';

  try {
    // 1. Búsqueda principal
    const mainData = await proxyTmdb(endpoint, { query: cleanQuery, page });
    let combined = [...(mainData.results || [])];

    // 2. ¿El resultado más popular es muy poco famoso (< popularidad 10)?
    //    Si es así, significa que el usuario probablemente escribió mal algo.
    //    Generamos variantes y buscamos en paralelo.
    const topPopularity = combined[0]?.popularity || 0;
    const needsFuzzy = combined.length === 0 || topPopularity < 10;

    if (needsFuzzy && cleanQuery.length >= 3) {
      console.log(` 🧠 [Fuzzy] "${cleanQuery}" → top popularidad: ${topPopularity.toFixed(1)}. Buscando variantes...`);
      const variants = generateFuzzyVariants(cleanQuery);

      // Buscar variantes en paralelo, ignorar errores individuales
      const fuzzyResults = await Promise.all(
        variants.slice(0, 5).map(v =>
          proxyTmdb(endpoint, { query: v, page: 1 }).catch(() => ({ results: [] }))
        )
      );

      // Unir sin duplicados
      const seen = new Set(combined.map(i => i.id));
      fuzzyResults.forEach(data => {
        (data.results || []).forEach(item => {
          if (!seen.has(item.id)) {
            combined.push(item);
            seen.add(item.id);
          }
        });
      });
    }

    // 3. Ordenar por popularidad: las películas famosas siempre van primero
    combined.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    // 4. ¿El top resultado es diferente a lo que escribió el usuario?
    //    Si sí, es una corrección → mostrar "¿Quisiste decir...?"
    const topTitle = (combined[0]?.title || combined[0]?.name || '').toLowerCase();
    const isFuzzy = combined.length > 0 && !topTitle.includes(cleanQuery.toLowerCase());
    const suggestedTitle = isFuzzy ? (combined[0]?.title || combined[0]?.name) : null;

    if (isFuzzy) {
      console.log(` ✨ [Fuzzy] "${cleanQuery}" → Sugerencia: "${suggestedTitle}" (popularidad: ${combined[0]?.popularity?.toFixed(1)})`);
    }

    res.json({
      success: true,
      data: {
        results: combined,
        total_results: combined.length,
        total_pages: mainData.total_pages || 1,
        isFuzzy,
        suggestedTitle,
      }
    });
  } catch (err) {
    next(err);
  }
});

// ─── DETALLES ────────────────────────────────────────────────────────────────

// Detalle de película
router.get('/movie/:id', async (req, res, next) => {
  try {
    const data = await proxyTmdb(`/movie/${req.params.id}`, { append_to_response: 'credits,videos,similar' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Detalle de serie
router.get('/tv/:id', async (req, res, next) => {
  try {
    const data = await proxyTmdb(`/tv/${req.params.id}`, { append_to_response: 'credits,videos,similar' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── COLECCIONES ─────────────────────────────────────────────────────────────

// Trending
router.get('/trending', async (req, res, next) => {
  const { type = 'movie', window = 'week', page = 1 } = req.query;
  if (!['movie', 'tv', 'all'].includes(type)) return next(new AppError('type inválido', 400));
  if (!['day', 'week'].includes(window)) return next(new AppError('window inválido', 400));
  try {
    const data = await proxyTmdb(`/trending/${type}/${window}`, { page });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Descubrimiento por género
router.get('/discover', async (req, res, next) => {
  const { type = 'movie', genre, sort = 'popularity.desc', page = 1, country } = req.query;
  const endpoint = type === 'tv' ? '/discover/tv' : '/discover/movie';
  const today = new Date().toISOString().split('T')[0];
  const params = {
    page, sort_by: sort,
    ...(type === 'movie'
      ? { 'primary_release_date.lte': today, 'vote_count.gte': 20 }
      : { 'first_air_date.lte': today, 'vote_count.gte': 20 }),
    ...(genre   ? { with_genres: genre }          : {}),
    ...(country ? { with_origin_country: country } : {}),
  };
  try {
    const data = await proxyTmdb(endpoint, params);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Top rated
router.get('/top-rated', async (req, res, next) => {
  const { type = 'movie', page = 1 } = req.query;
  const endpoint = type === 'tv' ? '/tv/top_rated' : '/movie/top_rated';
  try {
    const data = await proxyTmdb(endpoint, { page });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

export default router;
