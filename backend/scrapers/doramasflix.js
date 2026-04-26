/**
 * scrapers/doramasflix.js
 *
 * Extrae URLs de embed desde DoramasFlux (doramasflix.io).
 * Especializado en contenido asiático (coreano, chino, japonés).
 *
 * Flujo:
 *  1. Construir candidatos de slug desde el título.
 *  2. Navegar con Playwright a /peliculas/{slug} o /doramas/{slug}.
 *  3. Leer los <input type="text"> que React pobla con las URLs de embed.
 *  4. Devolver array de { id, name, embedUrl, language, qualityHint }.
 */

import { createContext } from './browserPool.js';

const BASE         = 'https://doramasflix.io';
const PAGE_TIMEOUT = 20_000;
const INPUT_WAIT   = 8_000;

// ─── Generación de slugs ──────────────────────────────────────────────────────

function toSlug(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/\s*\|\s*/g, '-or-')                      // "A | B" → "a-or-b"
    .replace(/[^a-z0-9]+/g, '-')                       // todo lo demás → guión
    .replace(/-{2,}/g, '-')                             // colapsar dobles
    .replace(/^-+|-+$/g, '');                           // recortar bordes
}

function buildSlugCandidates(title, originalTitle, englishTitle) {
  const seen = new Set();
  const add  = (s) => { if (s) seen.add(s); };

  for (const t of [englishTitle, title, originalTitle].filter(Boolean)) {
    add(toSlug(t));
    // Sin año final "(2026)" o "2026"
    add(toSlug(t.replace(/\s*\(?\d{4}\)?\s*$/, '').trim()));
    // Solo la parte antes de ":"
    const colonIdx = t.indexOf(':');
    if (colonIdx > 0) add(toSlug(t.slice(0, colonIdx).trim()));
    // Solo la parte antes de "|"
    const pipeIdx = t.indexOf('|');
    if (pipeIdx > 0) add(toSlug(t.slice(0, pipeIdx).trim()));
  }

  return [...seen].filter(Boolean);
}

// ─── Extracción de embeds via Playwright ─────────────────────────────────────

async function fetchEmbeds(pageUrl) {
  let context = null;
  try {
    context = await createContext();
    const page = await context.newPage();

    // Bloquear recursos pesados (imágenes, fuentes, CSS, media)
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['font', 'image', 'stylesheet', 'media'].includes(type)) return route.abort();
      return route.continue();
    });

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });

    // Verificar si es 404 antes de esperar
    const is404 = await page.evaluate(() => {
      const h1 = document.querySelector('h1')?.innerText || '';
      const title = document.title || '';
      return !h1 || h1 === '' || title.includes('404') || title.includes('Not Found');
    }).catch(() => false);

    if (is404) return [];

    // Esperar a que carguen los iframes de los reproductores
    await page.waitForFunction(
      () => {
        const iframes = document.querySelectorAll('iframe');
        return [...iframes].some((i) => {
          const src = i.src || '';
          return src.startsWith('http') && !src.includes('google') && !src.includes('facebook');
        });
      },
      { timeout: INPUT_WAIT }
    ).catch(() => {/* continuar aunque no haya iframes */});

    // Pausa extra para que todos los inputs se llenen
    await page.waitForTimeout(1_500);

    // Extraer todas las opciones haciendo click en cada botón
    const servers = [];
    const locators = await page.locator('figcaption').all();
    for (let loc of locators) {
      try {
        await loc.click({ force: true, timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(800); // Dar tiempo a que React actualice el iframe
        
        const data = await page.evaluate(() => {
          const iframe = document.querySelector('iframe');
          return iframe ? iframe.src : null;
        });

        if (data && data.includes('fkplayer.xyz/e/')) {
          const token = data.split('/e/')[1];
          const parts = token.split('.');
          if (parts.length >= 2) {
            const payloadStr = Buffer.from(parts[1], 'base64').toString('utf-8');
            const payload = JSON.parse(payloadStr);
            if (payload.link) {
              const realUrl = Buffer.from(payload.link, 'base64').toString('utf-8');
              const text = await loc.innerText();
              const name = text.replace(/\n/g, ' ').split('|')[0].trim() || 'DoramasFlix Server';
              servers.push({ url: realUrl, name: name });
            }
          }
        } else if (data && data.startsWith('http') && !data.includes('google') && !data.includes('facebook')) {
          const text = await loc.innerText();
          const name = text.replace(/\n/g, ' ').split('|')[0].trim() || 'DoramasFlix Server';
          servers.push({ url: data, name: name });
        }
      } catch (e) {
        // Ignorar si un botón falla
      }
    }

    if (servers.length > 0) {
      console.log(`  ✅  [DoramasFlux] ${servers.length} servidores en: ${pageUrl}`);
    }

    return servers;
  } catch (err) {
    console.log(`  ⚠️  [DoramasFlux] Error: ${err.message?.slice(0, 80)}`);
    return [];
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Busca y devuelve embed URLs de DoramasFlux para el título indicado.
 *
 * @returns {Promise<Array<{ id, name, embedUrl, language, qualityHint }>>}
 */
export async function getDoramasFlixEmbedUrls({ title, originalTitle, englishTitle, type = 'movie' }) {
  const section = type === 'tv' ? 'doramas' : 'peliculas';
  const slugs   = buildSlugCandidates(title, originalTitle, englishTitle);

  for (const slug of slugs) {
    const url = `${BASE}/${section}/${slug}`;
    console.log(`  🐉  [DoramasFlix] → ${url}`);

    const servers = await fetchEmbeds(url);
    if (servers.length > 0) {
      return servers.map((s, i) => ({
        id:          `doramasflix_${i + 1}`,
        name:        `DoramasFlix (${s.name})`,
        embedUrl:    s.url,
        language:    'Subtitulado',
        qualityHint: '1080p',
      }));
    }
  }

  console.log(`  ℹ️  [DoramasFlix] Sin resultados para "${title}"`);
  return [];
}

/**
 * Busca y devuelve embed URLs de DoramasFlix para episodios de series/Kdramas.
 * Formato esperado: /capitulos/{slug}-{season}x{episode}
 */
export async function getDoramasFlixEpisodeEmbeds({ title, originalTitle, englishTitle, season, episode }) {
  const slugs = buildSlugCandidates(title, originalTitle, englishTitle);

  for (const slug of slugs) {
    const url = `${BASE}/capitulos/${slug}-${season}x${episode}`;
    console.log(`  🐉  [DoramasFlix Kdrama] → ${url}`);

    const servers = await fetchEmbeds(url);
    if (servers.length > 0) {
      return servers.map((s, i) => ({
        id:          `doramasflix_${i + 1}`,
        name:        `DoramasFlix (${s.name})`,
        embedUrl:    s.url,
        language:    'Subtitulado',
        qualityHint: '1080p',
      }));
    }
  }

  console.log(`  ℹ️  [DoramasFlix Kdrama] Sin resultados para "${title}" S${season}E${episode}`);
  return [];
}

/**
 * Busca y devuelve embed URLs de DoramasFlix para películas asiáticas.
 * Formato esperado: /peliculas/{slug}
 */
export async function getDoramasFlixMovieEmbeds({ title, originalTitle, englishTitle }) {
  const slugs = buildSlugCandidates(title, originalTitle, englishTitle);

  for (const slug of slugs) {
    const url = `${BASE}/peliculas/${slug}`;
    console.log(`  🐉  [DoramasFlix Película] → ${url}`);

    const servers = await fetchEmbeds(url);
    if (servers.length > 0) {
      return servers.map((s, i) => ({
        id:          `doramasflix_movie_${i + 1}`,
        name:        `DoramasFlix (${s.name})`,
        embedUrl:    s.url,
        language:    'Subtitulado',
        qualityHint: '1080p',
      }));
    }
  }

  console.log(`  ℹ️  [DoramasFlix Película] Sin resultados para "${title}"`);
  return [];
}
