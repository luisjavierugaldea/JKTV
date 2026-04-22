/**
 * scrapers/streamExtractor.js
 *
 * Arquitectura multi-servidor:
 *  - extractAllStreams() corre TODAS las fuentes en paralelo (máx 3 simultáneas)
 *  - Timeout total: 30 segundos
 *  - Retorna un array de streams: [{ server, language, quality, url, type, sourceId }]
 *  - Cada stream representa un servidor/idioma distinto
 */

import axios from 'axios';
import { createContext } from './browserPool.js';
import {
  MOVIE_SOURCES,
  TV_SOURCES,
  STREAM_PATTERNS,
  BLOCKED_PATTERNS,
} from './sources.js';
import { getCuevanaEmbedUrls } from './cuevana.js'; // ✅ REACTIVADO con delays anti-bot
import { getPelisPlusMovieEmbeds, getPelisPlusSeriesEmbeds } from './pelisplus.js';
import { getDoramasFlixEmbedUrls } from './doramasflix.js';
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

// ─── Regex: captura URLs con headers JSON escapados ───────────────────────────
const STREAM_URL_IN_JSON =
  /https?:\/\/(?:[^"\\]|\\.)+(?:\.m3u8|\.mp4|\.mpd)(?:\?(?:[^"\\]|\\.)*)?/gi;

function jsonUnescape(s) {
  return s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

// ─── Detección de calidad desde URL ──────────────────────────────────────────
function detectQualityFromUrl(url) {
  const m = url.match(/(\d{3,4})p/i);
  if (m) return `${m[1]}p`;
  // Las URLs de proxy HLS suelen ser 1080p
  if (/\.m3u8/i.test(url)) return '1080p';
  return '720p';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Convierte una URL cruda del CDN a una URL del proxy del backend.
 * Extrae el referer si la URL incluye ?headers={}.
 */
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
    } catch { /* usar embedUrl */ }
  }

  const proxyUrl = isHls
    ? `/api/proxy-stream/playlist?url=${enc(finalUrl)}&ref=${enc(referer)}`
    : finalUrl; // MP4: acceso directo (menos restricciones CORS)

  return {
    url: proxyUrl,
    directUrl: finalUrl,
    referer,
    type: isHls ? 'hls' : isMp4 ? 'mp4' : 'dash',
  };
}

// ─── Interceptación de red ────────────────────────────────────────────────────

/**
 * @param {import('playwright').Page} page
 * @param {number} timeoutMs      - Tiempo máximo total de espera
 * @param {number} skipBeforeMs   - Ignorar URLs capturadas antes de este tiempo (ms).
 *                                  Útil para saltarse el pre-roll de anuncios (p. ej. 19000 = 19s).
 */
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
      if (elapsed < skipBeforeMs) {
        // URL demasiado temprana → probablemente es el pre-roll publicitario
        console.log(`  ⏭️  [Ad-skip T+${Math.round(elapsed / 1000)}s] ${url.substring(0, 70)}`);
        return;
      }
      resolved = true;
      clearTimeout(timer);
      page.off('request', requestHandler);
      page.off('response', responseHandler);
      resolve(url);
    }

    function requestHandler(request) {
      try { if (isStreamUrl(request.url())) done(request.url()); } catch { /* ignorar */ }
    }

    async function responseHandler(response) {
      try {
        const url = response.url();
        const contentType = response.headers()['content-type'] ?? '';

        if (isStreamUrl(url)) { done(url); return; }

        if (
          !contentType.includes('json') &&
          !contentType.includes('javascript') &&
          !contentType.includes('text/plain')
        ) return;

        const body = await response.text().catch(() => null);
        if (!body || body.length > 500_000) return;

        const found = extractUrlsFromJsonBody(body);
        if (found.length > 0) {
          console.log(`  📡  [JSON] ${found[0].substring(0, 100)}`);
          done(found[0]);
        }
      } catch { /* ignorar */ }
    }

    page.on('request', requestHandler);
    page.on('response', responseHandler);
  });
}

// ─── Prioridad de servidores para Latino ─────────────────────────────────────
// Orden descendente de preferencia. DoodStream excluido por captchas y ads.
const PREFERRED_SERVERS = ['filemoon', 'streamwish', 'vidhide', 'voesx', 'netu', 'vimeos'];
const IGNORED_SERVERS = ['doodstream', 'dood'];

/**
 * Intenta localizar y activar la pestaña de idioma Latino dentro de un frame,
 * luego selecciona el servidor preferido de la lista desplegada.
 *
 * @param {import('playwright').Frame} frame  - Frame donde buscar los controles
 * @param {import('playwright').Page}  page   - Página raíz (para waitForTimeout)
 * @param {string}                     sourceId
 * @returns {Promise<boolean>} true si se logró seleccionar un servidor Latino
 */
async function selectLatinoServer(frame, page, sourceId) {
  // ── PASO 1: Localizar la pestaña / botón de idioma Latino ──────────────────
  // Buscamos cualquier elemento visible cuyo texto contenga LATIN o LATINO.
  // Usamos evaluate() para inspeccionar el DOM real y devolver un selector
  // único que podamos usar desde Playwright.
  const latinoSelector = await frame.evaluate(() => {
    const CANDIDATES = 'li, button, span, div, a, [role="tab"], [role="option"]';
    const elements = Array.from(document.querySelectorAll(CANDIDATES));

    const el = elements.find((e) => {
      const text = (e.innerText ?? e.textContent ?? '').trim();
      const visible = e.offsetParent !== null || e.offsetWidth > 0 || e.offsetHeight > 0;
      return visible && /\bLATIN(?:O|_SPANISH)?\b/i.test(text);
    });

    if (!el) return null;

    // Intentar construir un selector robusto por ID, data-*, o contenido de texto
    if (el.id) return `#${CSS.escape(el.id)}`;
    if (el.dataset.lang) return `[data-lang="${el.dataset.lang}"]`;
    if (el.dataset.id) return `[data-id="${el.dataset.id}"]`;

    // Fallback: devolver el texto limpio para usarlo con locator('text=')
    return `__TEXT__:${(el.innerText ?? el.textContent ?? '').trim()}`;
  });

  if (!latinoSelector) {
    console.log(`  ⚠️   [${sourceId}] No se encontró pestaña Latino en este frame.`);
    return false;
  }

  console.log(`  🌎  [${sourceId}] Pestaña Latino detectada → selector: "${latinoSelector}"`);

  // ── PASO 2: Hacer clic en la pestaña Latino ────────────────────────────────
  try {
    if (latinoSelector.startsWith('__TEXT__:')) {
      const text = latinoSelector.replace('__TEXT__:', '');
      // Usamos locator con has-text para mayor compatibilidad
      await frame.locator(`text=${JSON.stringify(text)}`).first().click({ timeout: 4_000 });
    } else {
      await frame.locator(latinoSelector).first().click({ timeout: 4_000 });
    }
  } catch (clickErr) {
    console.log(`  ⚠️   [${sourceId}] Fallo al hacer clic en Latino: ${clickErr.message}`);
    return false;
  }

  // Esperar a que el dropdown/lista de servidores se despliegue
  await page.waitForTimeout(1_500);

  // ── PASO 3: Localizar y seleccionar el servidor preferido ─────────────────
  // Re-leemos el DOM después del clic para encontrar los servidores que ahora
  // son visibles en la lista desplegada.
  const serverInfo = await frame.evaluate(
    ({ preferred, ignored }) => {
      const CANDIDATES = 'li, button, span, div, a, [role="option"], [role="menuitem"]';
      const elements = Array.from(document.querySelectorAll(CANDIDATES));

      // Filtrar sólo elementos visibles que parezcan ser opciones de servidor
      const serverEls = elements.filter((e) => {
        const text = (e.innerText ?? e.textContent ?? '').trim().toLowerCase();
        const visible = e.offsetParent !== null || e.offsetWidth > 0 || e.offsetHeight > 0;
        if (!visible || !text) return false;
        // Debe coincidir con algún nombre de servidor conocido
        return [...preferred, ...ignored].some((s) => text.includes(s.toLowerCase()));
      });

      // Ignorar servidores problemáticos
      const validEls = serverEls.filter((e) => {
        const text = (e.innerText ?? e.textContent ?? '').trim().toLowerCase();
        return !ignored.some((s) => text.includes(s.toLowerCase()));
      });

      if (validEls.length === 0) return null;

      // Ordenar por preferencia
      validEls.sort((a, b) => {
        const tA = (a.innerText ?? a.textContent ?? '').trim().toLowerCase();
        const tB = (b.innerText ?? b.textContent ?? '').trim().toLowerCase();
        const iA = preferred.findIndex((s) => tA.includes(s.toLowerCase()));
        const iB = preferred.findIndex((s) => tB.includes(s.toLowerCase()));
        return (iA === -1 ? 99 : iA) - (iB === -1 ? 99 : iB);
      });

      const chosen = validEls[0];
      const text = (chosen.innerText ?? chosen.textContent ?? '').trim();

      // Devolver info del elemento elegido
      return {
        text,
        id: chosen.id || null,
        dataId: chosen.dataset?.id || null,
        dataLang: chosen.dataset?.lang || null,
      };
    },
    { preferred: PREFERRED_SERVERS, ignored: IGNORED_SERVERS }
  );

  if (!serverInfo) {
    console.log(`  ⚠️   [${sourceId}] No se encontraron servidores válidos en la lista Latino.`);
    return false;
  }

  console.log(`  🎯  [${sourceId}] Servidor elegido: "${serverInfo.text}"`);

  // ── PASO 4: Hacer clic en el servidor seleccionado ────────────────────────
  try {
    let serverLocator;
    if (serverInfo.id) {
      serverLocator = frame.locator(`#${CSS.escape(serverInfo.id)}`);
    } else if (serverInfo.dataId) {
      serverLocator = frame.locator(`[data-id="${serverInfo.dataId}"]`);
    } else {
      // Último recurso: localizar por texto exacto del servidor
      serverLocator = frame.locator(`text=${JSON.stringify(serverInfo.text)}`).first();
    }

    await serverLocator.click({ timeout: 4_000 });
  } catch (serverClickErr) {
    console.log(`  ⚠️   [${sourceId}] Fallo al hacer clic en servidor: ${serverClickErr.message}`);
    return false;
  }

  // ── PASO 5: Esperar a que el reproductor se actualice ─────────────────────
  // Después del clic en el servidor el iframe principal suele recargarse.
  // Esperamos a que haya actividad de red antes de continuar la captura.
  try {
    await page.waitForLoadState('networkidle', { timeout: 6_000 });
  } catch {
    // networkidle puede no cumplirse si hay polling — un wait fijo es suficiente
    await page.waitForTimeout(2_500);
  }

  console.log(`  ✅  [${sourceId}] Selección Latino completada.`);
  return true;
}

// ─── Extracción de UN stream desde UNA fuente ─────────────────────────────────

async function trySourceExtraction({ embedUrl, sourceId, timeoutMs, isInteractive = false, adSkipMs = 0 }) {
  let context = null;
  try {
    console.log(`  🔍  [${sourceId}] → ${embedUrl.substring(0, 80)}`);
    if (adSkipMs > 0) console.log(`  ⏭️  [${sourceId}] Modo anti-anuncio: ignorando primeros ${adSkipMs / 1000}s`);
    context = await createContext();

    // ── Inyección de cookies de idioma ────────────────────────────────
    const domain = new URL(embedUrl).hostname;
    await context.addCookies([
      { name: 'lang', value: 'es', domain, path: '/' },
      { name: 'language', value: 'es-MX', domain, path: '/' },
      { name: 'primaryLang', value: 'es', domain, path: '/' },
    ]);

    const page = await context.newPage();

    // ── Bloquear recursos innecesarios ───────────────────────────────
    await page.route('**/*', (route) => {
      const url = route.request().url();
      const type = route.request().resourceType();
      if (['font', 'image', 'stylesheet'].includes(type)) return route.abort();
      if (BLOCKED_PATTERNS.some((p) => p.test(url))) return route.abort();
      return route.continue();
    });

    // Empezar a interceptar la red ANTES de navegar
    const streamPromise = waitForStreamUrl(page, timeoutMs, adSkipMs);

    // ── Navegación inicial ────────────────────────────────────────────
    try {
      await page.goto(embedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: Math.min(timeoutMs, 15_000),
      });
    } catch { /* continuar aunque haya timeout de navegación */ }

    // Breve pausa para que el JS del reproductor inicialice el DOM
    await page.waitForTimeout(2_500);

    // ── Interacción con la UI del selector de idioma (fuentes interactivas) ──
    if (isInteractive) {
      console.log(`  🖱️  [${sourceId}] Modo interactivo — buscando control de idioma Latino...`);

      // Recopilar todos los frames disponibles (incluye iframes anidados)
      const allFrames = page.frames().filter(
        (f) => f.url() && f.url() !== 'about:blank' && f.url() !== ''
      );
      const framesToSearch = [page.mainFrame(), ...allFrames];

      let latinoSelected = false;

      for (const frame of framesToSearch) {
        if (latinoSelected) break;
        try {
          latinoSelected = await selectLatinoServer(frame, page, sourceId);
        } catch (frameErr) {
          // Este frame falló, continuar con el siguiente
          console.log(`  ↩️   [${sourceId}] Frame descartado: ${frameErr.message}`);
        }
      }

      if (!latinoSelected) {
        console.log(`  ⚠️   [${sourceId}] No se pudo seleccionar Latino. Intentando clic genérico como fallback...`);
      }
    }

    // ── Clic genérico en el centro para disparar reproducción ─────────
    try { await page.mouse.click(960, 540); } catch { /* ignorar */ }

    // ── Clic en botones de play conocidos ────────────────────────────
    const playSelectors = [
      'button[class*="play"]', '[class*="play-button"]',
      '[class*="playBtn"]', '.play',
      '#play', '.jw-icon-display',
      '.plyr__control--overlaid', '.vjs-big-play-button',
    ];
    const framesForPlay = [
      page.mainFrame(),
      ...page.frames().filter((f) => f.url() && f.url() !== 'about:blank'),
    ];
    for (const frame of framesForPlay) {
      for (const sel of playSelectors) {
        try {
          const btn = await frame.$(sel);
          if (btn) { await btn.click({ timeout: 1_000 }); break; }
        } catch { /* ignorar */ }
      }
    }

    // Espera final para capturar el stream que el reproductor cargue
    await page.waitForTimeout(3_000);
    return await streamPromise;

  } catch (err) {
    console.log(`  ℹ️   [${sourceId}] Sin resultado: ${err.message}`);
    return null;
  } finally {
    if (context) { try { await context.close(); } catch { /* ignorar */ } }
  }
}

// ─── Concurrencia limitada ────────────────────────────────────────────────────

/**
 * Corre un array de funciones async con un límite de concurrencia.
 * @param {Function[]} tasks  Array de () => Promise<T>
 * @param {number}     limit  Máximo de promesas en vuelo simultáneamente
 * @returns {Promise<(T|null)[]>}
 */
async function runConcurrent(tasks, limit) {
  const results = new Array(tasks.length).fill(null);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const current = idx++;
      try {
        results[current] = await tasks[current]();
      } catch {
        results[current] = null;
      }
    }
  }

  // Lanzar `limit` workers en paralelo
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ─── TMDB resolvers ───────────────────────────────────────────────────────────

export async function resolveTmdbMovie(title, year) {
  const params = { query: title, language: 'es-ES' };
  if (year) params.year = year;

  const { data } = await tmdb.get('/search/movie', { params });

  if (!data.results?.length) {
    if (year) {
      const fallback = await tmdb.get('/search/movie', { params: { query: title } });
      if (!fallback.data.results?.length) {
        throw new AppError(`No se encontró "${title}" en TMDB.`, 404);
      }
      return buildMovieInfo(fallback.data.results[0]);
    }
    throw new AppError(`No se encontró "${title}" en TMDB.`, 404);
  }
  return buildMovieInfo(data.results[0]);
}

function buildMovieInfo(movie) {
  return {
    tmdbId: String(movie.id),
    title: movie.title,
    originalTitle: movie.original_title,
    year: movie.release_date?.split('-')[0] ?? 'N/A',
    posterPath: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    overview: movie.overview,
    voteAverage: movie.vote_average,
  };
}

export async function resolveTmdbTv(title) {
  const { data } = await tmdb.get('/search/tv', {
    params: { query: title, language: 'es-ES' },
  });
  if (!data.results?.length) {
    throw new AppError(`No se encontró la serie "${title}" en TMDB.`, 404);
  }
  const show = data.results[0];
  return {
    tmdbId: String(show.id),
    title: show.name,
    originalTitle: show.original_name,
    year: show.first_air_date?.split('-')[0] ?? 'N/A',
    posterPath: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
    overview: show.overview,
    voteAverage: show.vote_average,
  };
}

// ─── FUNCIÓN PRINCIPAL: extrae TODOS los streams disponibles ──────────────────

/**
 * Corre todas las fuentes configuradas en paralelo (máx 3 simultáneas).
 * Timeout total: 35 segundos.
 */
export async function extractAllStreams({ title, year, type = 'movie', season = 1, episode = 1 }) {
  console.log(`\n🎬  [Extractor] Multi-servidor: "${title}" (${year ?? '?'}) [${type}]`);

  // ── Paso 1: Resolver TMDB ID ───────────────────────────────────────────────
  const mediaInfo = type === 'tv'
    ? await resolveTmdbTv(title)
    : await resolveTmdbMovie(title, year);

  console.log(`  ✅  TMDB → ID:${mediaInfo.tmdbId} "${mediaInfo.title}" (${mediaInfo.year})`);

  const PER_SOURCE_TIMEOUT   = 30_000; // 30s por fuente (balance velocidad/éxito)
  const PER_SCRAPER_TIMEOUT  = 60_000; // 60s para Cuevana (con delays anti-bot 2-5s entre intentos)
  const MIN_SCRAPERS         = 1;      // retorno temprano si scrapers dan >= 1 stream (mostrar rápido)

  // Helper: construir un resultado a partir de un rawUrl
  function buildResult({ rawUrl, refEmbedUrl, meta }) {
    const { url, directUrl, type: streamType } = toProxyUrl(rawUrl, refEmbedUrl);
    const quality = detectQualityFromUrl(directUrl || rawUrl);
    return { ...meta, url, directUrl, type: streamType, quality: meta.qualityHint ?? quality };
  }

  // Helper: ejecutar scraper con timeout
  function withTimeout(promise, timeoutMs, scraperName) {
    return Promise.race([
      promise,
      new Promise((resolve) => {
        setTimeout(() => {
          console.log(`  ⏱️  [${scraperName}] Timeout (${timeoutMs}ms) - continuando sin resultados`);
          resolve([]);
        }, timeoutMs);
      })
    ]);
  }

  // ── Paso 2: Cuevana (Latino con delays) + PelisPlus + AnimeFLV en paralelo ────────
  const [cuevanaEmbeds, pelisplusEmbeds, doramasEmbeds, animeEmbeds, jkanimeEmbeds] = await Promise.all([
    // Cuevana: Latino con Playwright + delays aleatorios anti-bot (2-5s entre intentos)
    withTimeout(
      getCuevanaEmbedUrls({
        title:         mediaInfo.title,
        originalTitle: mediaInfo.originalTitle,
        year:          mediaInfo.year,
        type,
        season,
        episode,
      }),
      PER_SCRAPER_TIMEOUT,
      'Cuevana'
    ),
    // PelisPlus: Latino HTTP puro (backup rápido)
    withTimeout(
      (type === 'movie'
        ? getPelisPlusMovieEmbeds({ title: mediaInfo.title, year: mediaInfo.year })
        : getPelisPlusSeriesEmbeds({ title: mediaInfo.title, season, episode })
      ),
      20_000, // PelisPlus más rápido (HTTP puro)
      'PelisPlus'
    ),
    // DoramasFlux: DESACTIVADO - Playwright crashea igual que Cuevana
    Promise.resolve([]), // doramasEmbeds vacío
    withTimeout(
      getAnimeFLVEmbedUrls({
        title:         mediaInfo.title,
        originalTitle: mediaInfo.originalTitle,
        type,
        season,
        episode,
      }),
      20_000,
      'AnimeFLV'
    ),
    withTimeout(
      getJKAnimeEmbedUrls({
        title:         mediaInfo.title,
        originalTitle: mediaInfo.originalTitle,
        type,
        season,
        episode,
      }),
      20_000,
      'JKAnime'
    ),
  ]);

  // Crear tareas de extracción para ambas fuentes
  function makeExtractTask(embed) {
    return async () => {
      try {
        const rawUrl = await trySourceExtraction({
          embedUrl:      embed.embedUrl,
          sourceId:      embed.id,
          timeoutMs:     PER_SOURCE_TIMEOUT,
          isInteractive: false,
        });
        if (!rawUrl) {
          console.log(`  ⚠️  [${embed.id}] Sin URL de stream`);
          return null;
        }
        const result = buildResult({
          rawUrl,
          refEmbedUrl: embed.embedUrl,
          meta: { server: embed.name, language: embed.language, qualityHint: embed.qualityHint, sourceId: embed.id },
        });
        console.log(`  🎉  [${embed.id}] OK → ${result.quality} ${result.language}`);
        return result;
      } catch (err) {
        console.log(`  ❌  [${embed.id}] Error: ${err.message}`);
        return null;
      }
    };
  }

  const allScraperEmbeds = [...cuevanaEmbeds, ...pelisplusEmbeds, ...doramasEmbeds, ...animeEmbeds, ...jkanimeEmbeds];
  const scraperResults   = [];

  if (allScraperEmbeds.length > 0) {
    console.log(`  🔍  [Scrapers] Iniciando extracción de ${allScraperEmbeds.length} embeds...`);
    const settled = allScraperEmbeds.map(makeExtractTask).map((task) =>
      task()
        .then((r) => { if (r) scraperResults.push(r); })
        .catch((err) => { console.log(`  ⚠️  [Scraper] Tarea falló: ${err.message}`); })
    );
    await Promise.race([
      Promise.all(settled),
      new Promise((resolve) =>
        setTimeout(() => { 
          console.log('  ⏱️  [Scrapers] Timeout parcial (55s) - continuando con resultados actuales'); 
          resolve(); 
        }, 55_000)
      ),
    ]);
    console.log(
      `  📺  [Scrapers] ${scraperResults.length}/${allScraperEmbeds.length} streams` +
      ` (Cuevana:${cuevanaEmbeds.length} PelisPlus:${pelisplusEmbeds.length} Anime:${animeEmbeds.length})`
    );
  } else {
    console.log(`  ⚠️  [Scrapers] No se encontraron embeds iniciales (Cuevana/PelisPlus/Anime vacíos)`);
  }

  // ── RETORNO TEMPRANO DESHABILITADO: Siempre ejecutar backup para tener más opciones Latino ──
  // Comentado para asegurar que AutoEmbed (Latino pri 1) siempre se ejecute
  // if (scraperResults.length >= MIN_SCRAPERS) {
  //   console.log(`\n  ✅  Retorno temprano con ${scraperResults.length} streams de scrapers.\n`);
  //   return buildFinalResponse(scraperResults, mediaInfo, type, season, episode);
  // }

  // ── Paso 3: Backup (fuentes TMDB-based) - SIEMPRE SE EJECUTA ──────────────
  console.log(`  🔄  Ejecutando backup (AutoEmbed Latino + otros) - scrapers actuales: ${scraperResults.length}/${MIN_SCRAPERS}`);
  const sources = type === 'tv' ? TV_SOURCES : MOVIE_SOURCES;
  console.log(`  🔄  [Backup] Iniciando extracción de ${sources.length} fuentes TMDB-based...`);

  const backupTasks = sources.map((source) => async () => {
    try {
      const embedUrl = source.buildUrl({ tmdbId: mediaInfo.tmdbId, season, episode });
      const rawUrl = await trySourceExtraction({
        embedUrl,
        sourceId: source.id,
        timeoutMs: PER_SOURCE_TIMEOUT,
        isInteractive: !!source.isInteractive,
      });
      if (!rawUrl) {
        console.log(`  ⚠️  [${source.id}] Sin URL de stream`);
        return null;
      }
      const result = buildResult({
        rawUrl,
        refEmbedUrl: embedUrl,
        meta: { server: source.name, language: source.language ?? 'Inglés', qualityHint: source.qualityHint, sourceId: source.id },
      });
      console.log(`  🎉  [${source.id}] OK → ${result.quality} ${result.language}`);
      return result;
    } catch (err) {
      console.log(`  ❌  [${source.id}] Error: ${err.message}`);
      return null;
    }
  });

  // Mismo patrón que Cuevana: acumular resultados conforme llegan
  // Promise.race(resolve→null) descartaría los resultados ya acumulados
  const backupResults = [];
  const backupSettled = backupTasks.map((task) =>
    task()
      .then((r) => { if (r) backupResults.push(r); })
      .catch((err) => { console.log(`  ⚠️  [Backup] Tarea falló: ${err.message}`); })
  );
  await Promise.race([
    Promise.all(backupSettled),
    new Promise((resolve) => setTimeout(() => { 
      console.log('  ⏱️  [Backup] Timeout (90s) - continuando con resultados actuales'); 
      resolve(); 
    }, 90_000)),
  ]);
  console.log(`  📊  [Backup] ${backupResults.length}/${sources.length} streams backup encontrados`);

  const results = [...scraperResults, ...backupResults];
  console.log(`\n  📊  Streams encontrados: ${results.length}\n`);

  if (results.length === 0) {
    // Mensaje más amigable para el usuario final
    const totalAttempts = allScraperEmbeds.length + sources.length;
    console.log(`  ⚠️  [Extractor] No se encontraron streams para "${title}" después de ${totalAttempts} intentos.`);
    throw new AppError(
      `No se encontraron servidores disponibles para "${title}". ` +
      `Es posible que el contenido no esté disponible en las fuentes consultadas o que los scrapers estén temporalmente inaccesibles. ` +
      `Intenta de nuevo más tarde o busca otro contenido.`,
      404
    );
  }

  return buildFinalResponse(results, mediaInfo, type, season, episode);
}

function buildFinalResponse(results, mediaInfo, type, season, episode) {
  const ORDER = { Latino: 0, Castellano: 1, Subtitulado: 2, Inglés: 3 };
  results.sort((a, b) => {
    const langDiff = (ORDER[a.language] ?? 9) - (ORDER[b.language] ?? 9);
    if (langDiff !== 0) return langDiff;
    return (b.quality === '1080p' ? 1 : 0) - (a.quality === '1080p' ? 1 : 0);
  });
  return {
    success: true,
    streams: results,
    media: {
      ...mediaInfo,
      contentType: type,
      ...(type === 'tv' && { season, episode }),
    },
  };
}

// Mantener backward compat
export async function extractStream(params) {
  const result = await extractAllStreams(params);
  const first = result.streams[0];
  return {
    success: true,
    stream: { url: first.url, type: first.type, source: { id: first.sourceId, name: first.server } },
    streams: result.streams,
    media: result.media,
  };
}
