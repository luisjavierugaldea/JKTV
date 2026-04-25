/**
 * lib/api.js
 * Cliente Axios para el backend.
 * Las llamadas a /api/* son redirigidas al backend por el proxy de Vite.
 */
import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { API_BASE_URL } from '../config.js';

// Detectar si es Android/iOS (APK) o Web
const getBaseURL = () => {
  if (Capacitor.isNativePlatform()) {
    // APK: Usa la URL configurada en config.js (dev o prod)
    return API_BASE_URL;
  }
  // Web: Usa proxy de Vite (desarrollo local)
  return '/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 90_000, // 90s — el scraper puede tardar hasta 60s con varias fuentes
});

export default api;

// ── TMDB ──────────────────────────────────────────────────────────────────────
export const tmdb = {
  trending:  (type = 'movie', window = 'week', page = 1) =>
    api.get(`/tmdb/trending?type=${type}&window=${window}&page=${page}`),

  search: (query, type = 'movie', page = 1) =>
    api.get(`/tmdb/search?query=${encodeURIComponent(query)}&type=${type}&page=${page}`),

  movieDetail: (id) => api.get(`/tmdb/movie/${id}`),
  tvDetail:    (id) => api.get(`/tmdb/tv/${id}`),

  discover: (type = 'movie', genre = '', page = 1, country = '') => {
    const params = new URLSearchParams({ type, page });
    if (genre)   params.set('genre', genre);
    if (country) params.set('country', country);
    return api.get(`/tmdb/discover?${params}`);
  },

  topRated: (type = 'movie', page = 1) =>
    api.get(`/tmdb/top-rated?type=${type}&page=${page}`),
};

// ── Stream con caché en memoria ──────────────────────────────────────────────
const STREAM_CACHE_TTL = 30 * 60 * 1000; // 30 minutos
const streamCache = new Map(); // key → { data, expiresAt }

export const stream = {
  get: async (params) => {
    const key = `${params.title}|${params.year ?? ''}|${params.type ?? 'movie'}`;
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
    const key = `${params.title}|${params.year ?? ''}|${params.type ?? 'movie'}`;
    streamCache.delete(key);
  },
};

// ── Anime (AnimeAV1) ──────────────────────────────────────────────────────────
export const anime = {
  // Buscar anime por nombre
  search: (query, domain = '') => {
    const params = new URLSearchParams({ q: query });
    if (domain) params.set('domain', domain);
    return api.get(`/anime/search?${params}`);
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
