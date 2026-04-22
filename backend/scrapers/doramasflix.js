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

function buildSlugCandidates(title, originalTitle) {
  const seen = new Set();
  const add  = (s) => { if (s) seen.add(s); };

  for (const t of [title, originalTitle].filter(Boolean)) {
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

    // Esperar a que React popule los inputs con URLs de embed
    await page.waitForFunction(
      () => {
        const inputs = document.querySelectorAll('input[type="text"]');
        return [...inputs].some((i) => i.value && i.value.startsWith('http'));
      },
      { timeout: INPUT_WAIT }
    ).catch(() => {/* continuar aunque no haya inputs */});

    // Pausa extra para que todos los inputs se llenen
    await page.waitForTimeout(1_500);

    // Verificar que no es 404 (página vacía / no encontrada)
    const notFound = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return !h1 || h1.textContent.trim() === '' || document.title.includes('404');
    });
    if (notFound) return [];

    // Leer las URLs de embed de los <input type="text">
    const servers = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('input[type="text"]').forEach((input) => {
        const url = input.value?.trim();
        if (!url || !url.startsWith('http')) return;

        // Nombre del servidor desde el figcaption adyacente
        const container = input.closest('div');
        const nameEl = container?.querySelector('figcaption span:last-child')
                    ?? container?.querySelector('figcaption span');
        const name = nameEl?.textContent?.trim() || 'Servidor';

        results.push({ url, name });
      });
      return results;
    });

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
export async function getDoramasFlixEmbedUrls({ title, originalTitle, type = 'movie' }) {
  const section = type === 'tv' ? 'doramas' : 'peliculas';
  const slugs   = buildSlugCandidates(title, originalTitle);

  for (const slug of slugs) {
    const url = `${BASE}/${section}/${slug}`;
    console.log(`  🐉  [DoramasFlux] → ${url}`);

    const servers = await fetchEmbeds(url);
    if (servers.length > 0) {
      return servers.map((s, i) => ({
        id:          `doramasflix_${i + 1}`,
        name:        `DoramasFlux (${s.name})`,
        embedUrl:    s.url,
        language:    'Subtitulado',
        qualityHint: '1080p',
      }));
    }
  }

  console.log(`  ℹ️  [DoramasFlux] Sin resultados para "${title}"`);
  return [];
}
