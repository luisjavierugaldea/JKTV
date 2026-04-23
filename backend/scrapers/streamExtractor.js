/**
 * scrapers/streamExtractor.js
 * * Arquitectura multi-servidor con FILTRO DE PRIORIDAD LATINO (TOP 5)
 * * ULTRA-OPTIMIZADO: Películas solo usan Cuevana y Torrentio.
 */

import axios from 'axios';
import { createContext } from './browserPool.js';
import {
  MOVIE_SOURCES,
  TV_SOURCES,
  STREAM_PATTERNS,
  BLOCKED_PATTERNS,
} from './sources.js';
import { getCuevanaEmbedUrls } from './cuevana.js';
import { getPelisPlusSeriesEmbeds } from './pelisplus.js'; // Eliminamos getPelisPlusMovieEmbeds
import { getStremioAddonStreams, getImdbIdFromTmdb } from './stremioAddons.js';
import { getAnimeFLVEmbedUrls } from './animeflv.js';
import { getJKAnimeEmbedUrls } from './jkanime.js';
import { config } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';
import { enc } from '../routes/proxyStream.js';

// ─── Cliente TMDB ─────────────────────────────────────────────────────────────
const tmdb = axios.create({
  baseURL: config.tmdb.baseUrl,
  params: { api_key: config.tmdb.apiKey, language: 'es-ES' },
  timeout: 8_000,
});

// ─── Helpers y Detección ───────────────────────────────────────────────────────
const STREAM_URL_IN_JSON = /https?:\/\/(?:[^"\\]|\\.)+(?:\.m3u8|\.mp4|\.mpd)(?:\?(?:[^"\\]|\\.)*)?/gi;

function jsonUnescape(s) {
  return s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function detectQualityFromUrl(url) {
  const m = url.match(/(\d{3,4})p/i);
  if (m) return `${m[1]}p`;
  if (/\.m3u8/i.test(url)) return '1080p';
  return '720p';
}

function isStreamUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (BLOCKED_PATTERNS.some((p) => p.test(url))) return false;
  return STREAM_PATTERNS.some((p) => p.test(url));
}

function extractUrlsFromJsonBody(body) {
  if (!body || typeof body !== 'string') return [];
  const unescaped = jsonUnescape(body);
  return [...new Set(unescaped.match(STREAM_URL_IN_JSON) ?? [])];
}

function toProxyUrl(streamUrl, embedUrl) {
  const isHls = /\.m3u8/i.test(streamUrl);
  const isMp4 = /\.mp4/i.test(streamUrl);
  let finalUrl = streamUrl;
  let referer = embedUrl;

  if (streamUrl.includes('?headers=')) {
    const qIdx = streamUrl.indexOf('?headers=');
    finalUrl = streamUrl.substring(0, qIdx);
    const headersJson = streamUrl.substring(qIdx + '?headers='.length);
    try {
      const parsed = JSON.parse(decodeURIComponent(headersJson));
      referer = parsed.Referer ?? parsed.referer ?? embedUrl;
    } catch { }
  }

  const proxyUrl = isHls
    ? `/api/proxy-stream/playlist?url=${enc(finalUrl)}&ref=${enc(referer)}`
    : finalUrl;

  return {
    url: proxyUrl,
    directUrl: finalUrl,
    referer,
    type: isHls ? 'hls' : isMp4 ? 'mp4' : 'dash',
  };
}

// ─── Interceptación de Red (Playwright) ───────────────────────────────────────
function waitForStreamUrl(page, timeoutMs, skipBeforeMs = 0) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const startTime = Date.now();
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        page.off('request', requestHandler);
        page.off('response', responseHandler);
        reject(new Error('Timeout'));
      }
    }, timeoutMs);

    function done(url) {
      if (resolved) return;
      const elapsed = Date.now() - startTime;
      if (elapsed < skipBeforeMs) return;
      resolved = true;
      clearTimeout(timer);
      page.off('request', requestHandler);
      page.off('response', responseHandler);
      resolve(url);
    }

    function requestHandler(request) {
      try { if (isStreamUrl(request.url())) done(request.url()); } catch { }
    }

    async function responseHandler(response) {
      try {
        const url = response.url();
        const contentType = response.headers()['content-type'] ?? '';
        if (isStreamUrl(url)) { done(url); return; }
        if (!contentType.includes('json') && !contentType.includes('javascript') && !contentType.includes('text/plain')) return;
        const body = await response.text().catch(() => null);
        if (!body || body.length > 500_000) return;
        const found = extractUrlsFromJsonBody(body);
        if (found.length > 0) done(found[0]);
      } catch { }
    }

    page.on('request', requestHandler);
    page.on('response', responseHandler);
  });
}

// ─── Extracción Individual ─────────────────────────────────────────────────────
async function trySourceExtraction({ embedUrl, sourceId, timeoutMs, isInteractive = false, adSkipMs = 0 }) {
  let context = null;
  try {
    context = await createContext();
    const domain = new URL(embedUrl).hostname;
    await context.addCookies([
      { name: 'lang', value: 'es', domain, path: '/' },
      { name: 'language', value: 'es-MX', domain, path: '/' },
    ]);

    const page = await context.newPage();
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['font', 'image', 'stylesheet'].includes(type)) return route.abort();
      return route.continue();
    });

    const streamPromise = waitForStreamUrl(page, timeoutMs, adSkipMs);
    try {
      await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    } catch { }

    await page.waitForTimeout(2000);
    try { await page.mouse.click(960, 540); } catch { }

    return await streamPromise;
  } catch (err) {
    return null;
  } finally {
    if (context) await context.close();
  }
}

// ─── Función Principal ─────────────────────────────────────────────────────────
export async function extractAllStreams({ title, year, type = 'movie', season = 1, episode = 1 }) {
  console.log(`\n🎬 [Extractor] Buscando: "${title}" [${type}]`);

  const mediaInfo = type === 'tv'
    ? await resolveTmdbTv(title)
    : await resolveTmdbMovie(title, year);

  const PER_SOURCE_TIMEOUT = 30_000;

  // 1. Ejecutar Scrapers de manera INTELIGENTE (Ahorro Masivo de CPU)
  const scraperPromises = [
    // Cuevana es el rey del Latino, siempre corre.
    getCuevanaEmbedUrls({ title: mediaInfo.title, originalTitle: mediaInfo.originalTitle, year: mediaInfo.year, type, season, episode }).catch(() => [])
  ];

  // 🔥 CONDICIÓN CRÍTICA: Solo abrir los scrapers extra si es una Serie (TV)
  if (type === 'tv') {
    console.log(' 📺 [Extractor] Modo Serie: Añadiendo PelisPlus y Scrapers de Anime');
    scraperPromises.push(getPelisPlusSeriesEmbeds({ title: mediaInfo.title, season, episode }).catch(() => []));
    scraperPromises.push(getAnimeFLVEmbedUrls({ title: mediaInfo.title, type, season, episode }).catch(() => []));
    scraperPromises.push(getJKAnimeEmbedUrls({ title: mediaInfo.title, type, season, episode }).catch(() => []));
  } else {
    console.log(' 🎬 [Extractor] Modo Película: Usando SOLO Cuevana y Torrentio para máxima velocidad');
  }

  const resultsArray = await Promise.all(scraperPromises);
  const allScraperEmbeds = resultsArray.flat();
  const scraperResults = [];

  // Extraer links de los embeds de scrapers
  const scraperTasks = allScraperEmbeds.map(embed => async () => {
    const rawUrl = await trySourceExtraction({ embedUrl: embed.embedUrl, sourceId: embed.id, timeoutMs: PER_SOURCE_TIMEOUT });
    if (rawUrl) {
      const { url, directUrl, type: st } = toProxyUrl(rawUrl, embed.embedUrl);
      scraperResults.push({
        server: embed.name,
        language: embed.language || 'Latino',
        quality: embed.qualityHint || detectQualityFromUrl(rawUrl),
        url, directUrl, type: st, sourceId: embed.id
      });
    }
  });
  await Promise.all(scraperTasks.map(t => t()));

  // 2. Stremio Addons (Torrentio) - Siempre corre, es súper rápido
  let stremioResults = [];
  const imdbId = await getImdbIdFromTmdb(mediaInfo.tmdbId, type === 'tv' ? 'series' : 'movie', config.tmdb.apiKey);
  if (imdbId) {
    const stremioEmbeds = await getStremioAddonStreams({ type: type === 'tv' ? 'series' : 'movie', imdbId, season, episode });
    stremioResults = stremioEmbeds.map(e => ({
      server: e.name,
      language: e.language,
      quality: e.qualityHint,
      url: e.embedUrl,
      directUrl: e.embedUrl,
      type: e.streamType,
      sourceId: e.id
    }));
  }

  // 3. Backup Sources (Vidsrc, etc) - Son APIs HTTP, no gastan Chromium
  const backupResults = [];
  const sources = type === 'tv' ? TV_SOURCES : MOVIE_SOURCES;
  const backupTasks = sources.map(source => async () => {
    const embedUrl = source.buildUrl({ tmdbId: mediaInfo.tmdbId, season, episode });
    const rawUrl = await trySourceExtraction({ embedUrl, sourceId: source.id, timeoutMs: PER_SOURCE_TIMEOUT });
    if (rawUrl) {
      const { url, directUrl, type: st } = toProxyUrl(rawUrl, embedUrl);
      backupResults.push({
        server: source.name,
        language: source.language || 'Inglés',
        quality: source.qualityHint || detectQualityFromUrl(rawUrl),
        url, directUrl, type: st, sourceId: source.id
      });
    }
  });
  await Promise.all(backupTasks.map(t => t()));

  const allResults = [...scraperResults, ...stremioResults, ...backupResults];
  return buildFinalResponse(allResults, mediaInfo, type, season, episode);
}


/**
 * ─── LÓGICA DE FILTRADO Y ORDENAMIENTO (1 TORRENT + TOP 3 WEB) ───
 */
function buildFinalResponse(results, mediaInfo, type, season, episode) {
  if (results.length === 0) throw new AppError('No se encontraron streams.', 404);

  // Prioridad de idiomas (0 es lo más importante)
  const LANG_PRIO = { 'Latino': 0, 'Español Latino': 0, 'Castellano': 1, 'Subtitulado': 2, 'Inglés': 3 };

  // 1. Ordenar TODOS los resultados por Idioma y luego por Calidad (1080p > 720p)
  results.sort((a, b) => {
    const pA = LANG_PRIO[a.language] ?? 99;
    const pB = LANG_PRIO[b.language] ?? 99;
    if (pA !== pB) return pA - pB;

    const qA = parseInt(a.quality) || 0;
    const qB = parseInt(b.quality) || 0;
    return qB - qA;
  });

  // 2. Buscar preferiblemente los que estén en Latino
  let pool = results.filter(s => s.language.includes('Latino'));

  if (pool.length === 0) {
    pool = results;
  }

  // 3. Separar en dos "Cajas" (Torrents vs Web)
  const torrentStreams = pool.filter(s => s.type === 'torrent' || (s.server && s.server.toLowerCase().includes('torrentio')));
  const webStreams = pool.filter(s => s.type !== 'torrent' && !(s.server && s.server.toLowerCase().includes('torrentio')));

  let finalSelection = [];

  // 4. Extraer el Rey de los Torrents (Solo 1, el mejor)
  if (torrentStreams.length > 0) {
    finalSelection.push(torrentStreams[0]);
  }

  // 5. Extraer el Top 3 de la Web (Para tener red de seguridad anti-502)
  if (webStreams.length > 0) {
    // Tomamos hasta 3 servidores. Si hay Filemoon o Streamwish, estarán aquí.
    const topWeb = webStreams.slice(0, 3);
    finalSelection = [...finalSelection, ...topWeb];
  }

  console.log(`[Extractor] ✅ Selección Final: 1 Torrent + ${webStreams.slice(0, 3).length} Web`);

  return {
    success: true,
    streams: finalSelection,
    media: { ...mediaInfo, contentType: type, season, episode }
  };
}

// Resolvers de TMDB
export async function resolveTmdbMovie(title, year) {
  const { data } = await tmdb.get('/search/movie', { params: { query: title, year } });
  if (!data.results?.length) throw new AppError('No encontrado en TMDB', 404);
  const m = data.results[0];
  return { tmdbId: String(m.id), title: m.title, originalTitle: m.original_title, year: m.release_date?.split('-')[0], posterPath: `https://image.tmdb.org/t/p/w500${m.poster_path}`, overview: m.overview };
}

export async function resolveTmdbTv(title) {
  const { data } = await tmdb.get('/search/tv', { params: { query: title } });
  if (!data.results?.length) throw new AppError('No encontrado en TMDB', 404);
  const s = data.results[0];
  return { tmdbId: String(s.id), title: s.name, originalTitle: s.original_name, year: s.first_air_date?.split('-')[0], posterPath: `https://image.tmdb.org/t/p/w500${s.poster_path}`, overview: s.overview };
}

// Backward compat
export async function extractStream(params) {
  const res = await extractAllStreams(params);
  return { ...res, stream: res.streams[0] };
}