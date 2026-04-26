/**
 * lib/api.js
 * Cliente Axios para el backend.
 * Las llamadas a /api/* son redirigidas al backend por el proxy de Vite.
 */
import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { API_BASE_URL } from '../config.js';

// Eliminamos la validación condicional porque config.js ya hace todo el trabajo
const getBaseURL = () => {
  return API_BASE_URL;
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 90_000, // 90s — el scraper puede tardar hasta 60s con varias fuentes
});

export default api;

// ── TMDB ──────────────────────────────────────────────────────────────────────
export const tmdb = {
  trending: (type = 'movie', window = 'week', page = 1) =>
    api.get(`/tmdb/trending?type=${type}&window=${window}&page=${page}`),

  search: (query, type = 'movie', page = 1, options = {}) =>
    api.get(`/tmdb/search?query=${encodeURIComponent(query)}&type=${type}&page=${page}`, { signal: options.signal }),

  movieDetail: (id) => api.get(`/tmdb/movie/${id}`),
  tvDetail: (id) => api.get(`/tmdb/tv/${id}`),

  discover: (type = 'movie', genre = '', page = 1, country = '') => {
    const params = new URLSearchParams({ type, page });
    if (genre) params.set('genre', genre);
    if (country) params.set('country', country);
    return api.get(`/tmdb/discover?${params}`);
  },

  topRated: (type = 'movie', page = 1) =>
    api.get(`/tmdb/top-rated?type=${type}&page=${page}`),
};

// ── Stream con caché en memoria ──────────────────────────────────────────────
const STREAM_CACHE_TTL = 60 * 60 * 1000; // 60 minutos (era 30)
const streamCache = new Map(); // key → { data, expiresAt }

function streamCacheKey(params) {
  const s = params.type === 'tv' ? `|S${params.season ?? 1}E${params.episode ?? 1}` : '';
  return `${params.title}|${params.year ?? ''}|${params.type ?? 'movie'}${s}`;
}

export const stream = {
  get: async (params) => {
    const key = streamCacheKey(params);
    const cached = streamCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      console.log(`[StreamCache] HIT → "${params.title}"`);
      return cached.data;
    }
    const response = await api.get('/stream', { params, timeout: 90_000 });
    if (response.data?.success) {
      streamCache.set(key, { data: response, expiresAt: Date.now() + STREAM_CACHE_TTL });
    }
    return response;
  },
  // Forzar re-scraping (útil para el botón "Reintentar")
  invalidate: (params) => {
    const key = streamCacheKey(params);
    streamCache.delete(key);
  },
};

// ── Anime (AnimeAV1) ──────────────────────────────────────────────────────────
export const anime = {
  // Buscar anime por nombre
  search: (query, optionsOrDomain = {}) => {
    const params = new URLSearchParams({ q: query });
    let config = {};
    
    if (typeof optionsOrDomain === 'string') {
      if (optionsOrDomain) params.set('domain', optionsOrDomain);
    } else if (optionsOrDomain) {
      if (optionsOrDomain.domain) params.set('domain', optionsOrDomain.domain);
      config = { ...optionsOrDomain };
      delete config.domain;
    }
    
    return api.get(`/anime/search?${params}`, config);
  },

  // Obtener información completa del anime (con episodios)
  getInfo: (url) => api.get('/anime/info', { params: { url } }),

  // Obtener enlaces de un episodio específico
  getEpisode: (url, includeMega = false, excludeServers = '') => {
    const params = new URLSearchParams({ url });
    if (includeMega) params.set('includeMega', 'true');
    if (excludeServers) params.set('excludeServers', excludeServers);
    return api.get(`/anime/episode?${params}`);
  },
};

// ── IPTV (TV en Vivo) ─────────────────────────────────────────────────────────
export const iptv = {
  getChannels: () => api.get('/iptv/channels'),
};
