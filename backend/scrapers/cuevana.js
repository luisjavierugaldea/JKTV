/**
 * scrapers/cuevana.js
 *
 * Arquitectura REAL de cue.cuevana3.nu (descubierta analizando el HTML):
 *
 *  El iframe del reproductor tiene la forma:
 *    <iframe src="https://cue.cuevana3.nu/embed-page?showEmbed=BASE64">
 *
 *  donde BASE64 decodifica a la URL DIRECTA del video, ej:
 *    https://vimeos.net/embed-0a5sm8h3422y.html
 *    https://streamwish.com/e/XXXX
 *    etc.
 *
 *  Estrategia:
 *  1. Buscar la película en cue.cuevana3.nu/?s=TITULO → obtener URL real
 *  2. Navegar a esa URL y extraer TODOS los showEmbed del DOM interactuando con los botones
 *  3. Devolver los embeds directos de los servidores Latino/Latin_Spanish
 *
 *  FALLBACK: Si todo falla, intentar slug guess en cuevana.gs con player.php?t=TOKEN
 */

import { createContext } from './browserPool.js';
import axios from 'axios';

// Hosts de los sitios
const BASE_GS = 'https://cuevana.gs';

// Servidores preferidos en orden (para fallback slug)
export const LATINO_SERVERS = ['vimeos', 'goodstream', 'hlswish', 'voe', 'netu'];

// Regex token (para fallback cuevana.gs)
const TOKEN_RE = /player\.php[^"' ]*[?&]t=([A-Za-z0-9_\-]{20,})/;

// Delay anti-bot
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => sleep(1500 + Math.random() * 2000);

export function slugify(title, year) {
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove accents
    .replace(/[^a-z0-9\s\-]/g, ' ')   // keep hyphens (Spider-Man stays spider-man)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return year ? `${base}-${year}` : base;
}

// Build all slug variations for a given title
export function buildSlugCandidates(title, originalTitle, englishTitle, year) {
  const seen = new Set();
  const add = (t, y) => {
    if (!t) return;
    seen.add(slugify(t, y));
    seen.add(slugify(t));
    // title before ':' ("Spider-Man: Far From Home" → "spider-man")
    const colonIdx = t.indexOf(':');
    if (colonIdx > 0) {
      seen.add(slugify(t.slice(0, colonIdx).trim(), y));
      seen.add(slugify(t.slice(0, colonIdx).trim()));
    }
    // title without leading/trailing year in parens
    const stripped = t.replace(/\s*\(?\d{4}\)?\s*$/, '').trim();
    if (stripped !== t) seen.add(slugify(stripped, y));
  };
  add(englishTitle, year);
  add(title, year);
  add(originalTitle, year);
  return [...seen].filter(Boolean);
}

// In-memory sitemap cache (valid for 60 mins)
const sitemapCache = { movie: null, tv: null, expiresAt: 0 };

async function loadSitemapUrls(type) {
  const now = Date.now();
  const key = type === 'movie' ? 'movie' : 'tv';
  if (sitemapCache[key] && now < sitemapCache.expiresAt) return sitemapCache[key];

  const prefix = type === 'movie' ? 'movies' : 'tvshows';
  const numSitemaps = type === 'movie' ? 8 : 3;

  // ⚡ Cargar todos los sitemaps EN PARALELO (antes era secuencial)
  const sitemapNums = Array.from({ length: numSitemaps }, (_, i) => i + 1);
  const results = await Promise.allSettled(
    sitemapNums.map(i => {
      const suffix = i === 1 ? '' : String(i);
      const sitemapUrl = `${BASE_GS}/${prefix}-sitemap${suffix}.xml`;
      return axios.get(sitemapUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
        timeout: 12_000,
      });
    })
  );

  const urls = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const matches = r.value.data.match(/<loc>([^<]+)<\/loc>/g) ?? [];
    for (const m of matches) {
      const url = m.replace(/<\/?loc>/g, '').trim().replace(/\/$/, '');
      if (url.includes('/peliculas/') || url.includes('/series/')) urls.push(url);
    }
  }

  sitemapCache[key] = urls;
  sitemapCache.expiresAt = now + 60 * 60 * 1000; // 60 minutes
  console.log(`  📋  [Cuevana] Sitemap cargado: ${urls.length} entradas (${type})`);
  return urls;
}

// Score a sitemap URL against search keyword slugs
function scoreSitemapUrl(url, keywordSlugs) {
  const slug = url.split('/').pop() ?? '';
  let score = 0;
  for (const kw of keywordSlugs) {
    if (slug === kw) { score += 100; break; }
    if (slug.startsWith(kw + '-')) score += 60;
    if (slug.includes(kw)) score += 20;
    // Word-level: all words of kw appear in slug
    const kwWords = kw.split('-').filter(w => w.length > 2);
    if (kwWords.length > 0 && kwWords.every(w => slug.includes(w))) score += 40;
  }
  return score;
}

// Cuevana renders search results client-side — sitemap-based lookup is the most reliable approach
export async function findMovieUrl(title, type, extraTitles = []) {
  const allTitles = [title, ...extraTitles].filter(Boolean);
  console.log(`  🔍  [Cuevana] Buscando en sitemap: ${allTitles.map(t => `"${t}"`).join(', ')}`);

  try {
    const urls = await loadSitemapUrls(type);
    if (!urls.length) return null;

    // Build keyword slugs from all title variants
    const keywordSlugs = allTitles.flatMap(t => {
      const s = slugify(t);
      const colonIdx = t.indexOf(':');
      const results = [s];
      if (colonIdx > 0) results.push(slugify(t.slice(0, colonIdx).trim()));
      return results;
    }).filter(Boolean);

    let bestUrl = null;
    let maxScore = 0;
    for (const url of urls) {
      const score = scoreSitemapUrl(url, keywordSlugs);
      if (score > maxScore) { maxScore = score; bestUrl = url; }
    }

    if (maxScore >= 20) {
      console.log(`  ✅  [Cuevana] Encontrado (score ${maxScore}): ${bestUrl}`);
      return bestUrl;
    }

    console.log(`  ⚠️  [Cuevana] Sin resultados para: "${title}"`);
    return null;
  } catch (err) {
    console.log(`  ⚠️  [Cuevana] findMovieUrl error: ${err.message}`);
    return null;
  }
}

export async function extractEmbeds(pageUrl, timeoutMs = 35_000) {
  let context = null;
  try {
    context = await createContext();
    const page = await context.newPage();

    await page.route('**/*', (route) => {
      if (route.request().resourceType() === 'media') return route.abort();
      return route.continue();
    });

    let gsToken = null;
    page.on('response', async (resp) => {
      if (gsToken) return;
      try {
        const ct = resp.headers()['content-type'] ?? '';
        if (!ct.includes('json') && !ct.includes('javascript') && !ct.includes('text/plain')) return;
        const body = await resp.text().catch(() => '');
        if (!body || body.length > 1_500_000) return;
        const m = TOKEN_RE.exec(body);
        if (m) { gsToken = m[1]; }
      } catch {}
    });

    try {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: Math.min(timeoutMs, 20_000) });
    } catch {}

    // ⚡ Esperar a que React cargue — intervalo reducido a 400ms (antes 1000ms ×15)
    let loaded = false;
    for (let i = 0; i < 12; i++) {
      const is404 = await page.evaluate(() => {
        const t = document.title || '';
        const h1 = document.querySelector('h1')?.innerText || '';
        return t.includes('404') || t.includes('no encontrada') || h1.includes('no encontrada');
      }).catch(() => false);

      if (is404) {
        console.log(`  ⚠️  [Cuevana] Página no encontrada (404): ${pageUrl.substring(0, 80)}`);
        return { type: 'embeds', embeds: [] };
      }

      const hasTabs = await page.$('.tab_language_movie, iframe[src*="showEmbed"]');
      if (hasTabs) { loaded = true; break; }
      await page.waitForTimeout(400); // Reducido de 1000ms a 400ms
    }

    if (!loaded) console.log(`  ⚠️  [Cuevana] La interfaz del player no cargó por completo.`);

    // ── MÉTODO A: Extraer showEmbed interactuando con los botones ───────────────────────────────────
    const embedsSet = new Set();
    
    // Primero, capturamos cualquier showEmbed que ya esté en el HTML
    const initialEmbeds = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('iframe[src*="showEmbed"]').forEach(ifr => {
        const match = (ifr.getAttribute('src') || '').match(/showEmbed=([A-Za-z0-9+/=]+)/);
        if (match) results.push(atob(match[1]));
      });
      return results;
    }).catch(() => []);
    initialEmbeds.forEach(e => embedsSet.add(e));

    // Luego, hacemos click en cada botón de servidor latino para forzar que Cuevana genere el embed
    try {
      // Cuevana estructura las opciones como: <ul class="sub-tab-lang..."><li data-tplayernv="...">...</li></ul>
      // Y los de latino suelen estar dentro del primer <li> open_submenu que contiene la imagen de la bandera latina
      const serverButtons = await page.$$('li[data-tplayernv]');
      if (serverButtons.length > 0) {
        console.log(`  🖱️  [Cuevana] Extrayendo ${serverButtons.length} opciones de servidor...`);
        for (const btn of serverButtons) {
          try {
            await btn.click();
            await page.waitForTimeout(200); // ⚡ Reducido de 500ms a 200ms
            const curr = await page.evaluate(() => {
              const ifr = document.querySelector('iframe[src*="showEmbed"]');
              if (ifr) {
                const match = (ifr.getAttribute('src') || '').match(/showEmbed=([A-Za-z0-9+/=]+)/);
                if (match) return atob(match[1]);
              }
              return null;
            });
            if (curr && curr.startsWith('http')) embedsSet.add(curr);
          } catch {}
        }
      }
    } catch {}

    const embedsList = Array.from(embedsSet).map(url => ({ directUrl: url, source: 'iframe' }));

    if (embedsList.length > 0) {
      console.log(`  🎯  [Cuevana] ${embedsList.length} embed(s) encontrados en DOM.`);
      return { type: 'embeds', embeds: embedsList };
    }

    // ── MÉTODO B: Fallback - token de cuevana.gs interceptado ────────────────
    if (embedsList.length === 0 && gsToken) {
      console.log(`  🔑  [Cuevana] Usando token interceptado de red.`);
      return { type: 'token', token: gsToken, base: BASE_GS };
    }

    // ── MÉTODO C: Extraer token de iframe player.php (cuevana.gs legacy) ─────
    if (embedsList.length === 0) {
      const iframeSrc = await page.evaluate(() => {
        const el = document.querySelector('iframe[src*="player.php"]');
        return el?.getAttribute('src') ?? null;
      }).catch(() => null);

      if (iframeSrc) {
        const m = iframeSrc.match(/[?&]t=([A-Za-z0-9_\-]{20,})/);
        if (m) {
          console.log(`  🖼️  [Cuevana] Token extraído del iframe player.php.`);
          return { type: 'token', token: m[1], base: BASE_GS };
        }
      }
    }

    return { type: 'embeds', embeds: [] };

  } catch (err) {
    console.log(`  ⚠️  [Cuevana] extractEmbeds error: ${err.message}`);
    return { type: 'embeds', embeds: [] };
  } finally {
    if (context) { try { await context.close(); } catch {} }
  }
}

/**
 * Dado un token y base URL de cuevana.gs, fetcha player.php y extrae la URL real del iframe interno.
 * player.php devuelve exactamente un <iframe src="URL"> con la URL real del server de video.
 */
async function resolveTokenToEmbed(token, base = BASE_GS, episodeParams = '') {
  try {
    const playerUrl = `${base}/player.php?t=${token}${episodeParams}`;
    console.log(`  🔗  [Cuevana] Resolviendo token → ${playerUrl.substring(0, 80)}...`);
    const resp = await axios.get(playerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': base,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 10_000,
    });
    const html = resp.data;
    // Buscar src en el iframe — puede tener saltos de línea entre atributos
    const match = html.match(/src=["'](https?:\/\/[^"'\s]+)["']/i);
    if (match) {
      console.log(`  ✅  [Cuevana] Embed real encontrado: ${match[1].substring(0, 80)}`);
      return match[1];
    }
    console.log(`  ⚠️  [Cuevana] No se encontró src en player.php`);
  } catch (e) {
    console.log(`  ⚠️  [Cuevana] resolveTokenToEmbed error: ${e.message}`);
  }
  return null;
}

function detectServerFromUrl(url) {
  if (!url) return 'unknown';
  const u = url.toLowerCase();
  if (u.includes('vimeos.net') || u.includes('vimeos'))      return 'vimeos';
  if (u.includes('streamwish'))      return 'streamwish';
  if (u.includes('filemoon'))        return 'filemoon';
  if (u.includes('vidhide'))         return 'vidhide';
  if (u.includes('doodstream') || u.includes('dood.')) return 'doodstream';
  if (u.includes('netu.ac') || u.includes('netu.'))    return 'netu';
  if (u.includes('voe.sx') || u.includes('voe.'))      return 'voe';
  if (u.includes('goodstream'))      return 'goodstream';
  if (u.includes('hlswish'))         return 'hlswish';
  if (u.includes('upstream'))        return 'upstream';
  if (u.includes('wolfstream'))      return 'wolfstream';
  if (u.includes('supervideo'))      return 'supervideo';
  if (u.includes('okru') || u.includes('ok.ru')) return 'okru';
  try { return new URL(url).hostname.replace('www.', '').split('.')[0]; } catch {}
  return 'embed';
}

export async function getCuevanaEmbedUrls({
  title,
  originalTitle,
  englishTitle,
  userQuery,
  alternativeTitles = [],
  year,
  type    = 'movie',
  season  = 1,
  episode = 1,
}) {
  // Pass all title variants at once — sitemap search handles them together
  const extraTitles = [englishTitle, originalTitle, userQuery, ...alternativeTitles].filter(t => t && t !== title);
  const realUrl = await findMovieUrl(title, type, extraTitles);

  if (realUrl) {
    let result = { type: 'embeds', embeds: [] };

    if (type === 'tv' && realUrl.includes('/series/')) {
      const baseEpisode = realUrl.replace('/series/', '/episodio/');
      // Nuevo formato Cuevana: nombre-serie-temporada-1-episodio-1
      const urlNew = `${baseEpisode}-temporada-${season}-episodio-${episode}`;
      // Formato antiguo: nombre-serie-1x1
      const urlOld = `${baseEpisode}-${season}x${episode}`;

      console.log(`  🔄  [Cuevana] Probando formato nuevo: ${urlNew}`);
      result = await extractEmbeds(urlNew, 35_000);

      if (!result || (result.type !== 'token' && (!result.embeds || result.embeds.length === 0))) {
        console.log(`  🔄  [Cuevana] Falló formato nuevo, probando antiguo: ${urlOld}`);
        result = await extractEmbeds(urlOld, 35_000);
      }
    } else {
      result = await extractEmbeds(realUrl, 35_000);
    }

    if (result.type === 'embeds' && result.embeds.length > 0) {
      console.log(`  ✅  [Cuevana] ${result.embeds.length} embeds directos encontrados.`);
      return result.embeds.map((e, idx) => {
        const server = detectServerFromUrl(e.directUrl);
        return {
          id:          `cuevana_${server}_${idx}`,
          name:        `Cuevana ${server.charAt(0).toUpperCase() + server.slice(1)}`,
          language:    'Latino',
          qualityHint: 'Full HD',
          priority:    idx + 1,
          isInteractive: false,
          embedUrl:    e.directUrl,  // URL DIRECTA del video
        };
      });
    }

    if (result.type === 'token' && result.token) {
      const episodeParams = type === 'tv' ? `&s=${season}&e=${episode}` : '';
      // Resolvemos el token a la URL real del embed
      const directEmbed = await resolveTokenToEmbed(result.token, result.base, episodeParams);
      if (directEmbed) {
        const server = detectServerFromUrl(directEmbed);
        console.log(`  ✅  [Cuevana] Token → embed directo: ${server}`);
        return [{
          id: `cuevana_${server}_0`,
          name: `Cuevana ${server.charAt(0).toUpperCase() + server.slice(1)}`,
          language: 'Latino',
          qualityHint: 'Full HD',
          priority: 1,
          isInteractive: false,
          embedUrl: directEmbed,
        }];
      }
      // Si no se pudo resolver, usar player.php directamente como fallback
      console.log(`  ⚠️  [Cuevana] Token no resolvió a embed. Usando player.php directo.`);
      return [{
        id: 'cuevana_player',
        name: 'Cuevana Player',
        language: 'Latino',
        qualityHint: 'Full HD',
        priority: 1,
        isInteractive: false,
        embedUrl: `${result.base}/player.php?t=${result.token}${episodeParams}`,
      }];
    }
  }

  console.log(`  🔄  [Cuevana] Probando slug fallback en ${BASE_GS}...`);
  const candidates = buildSlugCandidates(title, originalTitle, englishTitle, year);

  const path = type === 'movie' ? 'peliculas' : 'series';

  for (const slug of candidates) {
    let pageUrl = `${BASE_GS}/${path}/${slug}`;
    let result = { type: 'embeds', embeds: [] };

    if (type === 'tv') {
      const baseEpisode = `${BASE_GS}/episodio/${slug}`;
      const urlNew = `${baseEpisode}-temporada-${season}-episodio-${episode}`;
      const urlOld = `${baseEpisode}-${season}x${episode}`;

      console.log(`  🌮  [Cuevana] Slug Fallback (TV Nuevo): ${urlNew}`);
      result = await extractEmbeds(urlNew, 25_000);

      if (!result || (result.type !== 'token' && (!result.embeds || result.embeds.length === 0))) {
        console.log(`  🌮  [Cuevana] Slug Fallback (TV Antiguo): ${urlOld}`);
        result = await extractEmbeds(urlOld, 25_000);
      }
    } else {
      console.log(`  🌮  [Cuevana] Slug Fallback (Movie): ${pageUrl}`);
      result = await extractEmbeds(pageUrl, 25_000);
    }

    if (result.type === 'embeds' && result.embeds.length > 0) {
      return result.embeds.map((e, idx) => ({
        id:          `cuevana_${detectServerFromUrl(e.directUrl)}_${idx}`,
        name:        `Cuevana ${detectServerFromUrl(e.directUrl)}`,
        language:    'Latino',
        qualityHint: 'Full HD',
        priority:    idx + 1,
        isInteractive: false,
        embedUrl:    e.directUrl,
      }));
    }

    if (result.type === 'token' && result.token) {
      const episodeParams = type === 'tv' ? `&s=${season}&e=${episode}` : '';
      const directEmbed = await resolveTokenToEmbed(result.token, BASE_GS, episodeParams);
      if (directEmbed) {
        const server = detectServerFromUrl(directEmbed);
        return [{
          id: `cuevana_${server}_0`,
          name: `Cuevana ${server.charAt(0).toUpperCase() + server.slice(1)}`,
          language: 'Latino',
          qualityHint: 'Full HD',
          priority: 1,
          isInteractive: false,
          embedUrl: directEmbed,
        }];
      }
      return [{
        id: 'cuevana_player',
        name: 'Cuevana Player',
        language: 'Latino',
        qualityHint: 'Full HD',
        priority: 1,
        isInteractive: false,
        embedUrl: `${BASE_GS}/player.php?t=${result.token}${episodeParams}`,
      }];
    }

    // ⚡ randomDelay eliminado en fallback (era 1.5-3.5s innecesarios por slug)
  }

  console.log(`  ❌  [Cuevana] Sin embeds — película no disponible.`);
  return [];
}
