/**
 * scrapers/cuevana.js
 *
 * Estrategia de extracción para cuevana.gs:
 *
 *  1. Construir el slug desde title + year.
 *  2. Cargar la página con Playwright.
 *  3. Interceptar las respuestas de red (API del SPA React + JS bundles)
 *     buscando el patrón del token: `player.php?t=TOKEN`.
 *  4. Con el token, construir una URL por cada servidor Latino.
 */

import { createContext } from './browserPool.js';

// Mirrors en orden de preferencia — el primero que responda con token gana
const BASES = [
  'https://cuevana.gs',
  'https://cuevana3.me',
  'https://cuevana3.io',
];

// Servidores en orden de preferencia (más rápidos / sin captchas primero)
export const LATINO_SERVERS = ['vimeos', 'goodstream', 'hlswish', 'voe', 'netu'];

// Regex que encuentra el token en cualquier cuerpo de respuesta
const TOKEN_RE = /player\.php[^"' ]*[?&]t=([A-Za-z0-9_\-]{20,})/;

/**
 * Convierte título + año al slug de cuevana.gs.
 * "Super Mario Galaxy la película", 2026  →  "super-mario-galaxy-la-pelicula-2026"
 */
export function slugify(title, year) {
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quitar tildes
    .replace(/[^a-z0-9\s]/g, '')       // quitar símbolos
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return `${base}-${year}`;
}

/**
 * Carga la página de la película y extrae el token del reproductor.
 *
 * Estrategia dual:
 *   A) Interceptar respuestas de red (API / JS bundles) buscando el token.
 *   B) Leer el atributo src del <iframe> si ya fue insertado por React.
 *
 * @param {string} pageUrl    - URL de la página en Cuevana
 * @param {number} timeoutMs  - Tiempo máximo de espera (default 25s)
 */
async function extractToken(pageUrl, timeoutMs = 25_000) {
  let context = null;
  try {
    context = await createContext();
    const page = await context.newPage();

    // Bloquear recursos pesados que no aportan al token
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      const url  = route.request().url();
      if (['image', 'font', 'media', 'stylesheet'].includes(type)) return route.abort();
      if (/google-analytics|doubleclick|clarity\.ms|ads\./i.test(url)) return route.abort();
      return route.continue();
    });

    let token = null;

    // ── MÉTODO A: Interceptar respuestas de red ─────────────────────────────
    page.on('response', async (response) => {
      if (token) return;
      try {
        const contentType = response.headers()['content-type'] ?? '';
        if (
          !contentType.includes('json') &&
          !contentType.includes('javascript') &&
          !contentType.includes('text/plain')
        ) return;

        const body = await response.text().catch(() => '');
        if (!body || body.length > 2_000_000) return;

        const m = TOKEN_RE.exec(body);
        if (m) {
          token = m[1];
          console.log(`  📡  [Cuevana] Token encontrado en respuesta de red.`);
        }
      } catch { /* ignorar */ }
    });

    // Navegar — waitUntil:'load' espera que el JS inicial se ejecute
    try {
      await page.goto(pageUrl, { waitUntil: 'load', timeout: Math.min(timeoutMs, 15_000) });
    } catch {
      // Continuar aunque haya timeout de navegación (SPA puede seguir cargando)
    }

    // ── MÉTODO B: Polling del DOM (reducido para ser más rápido) ────────────
    // Máximo 5 iteraciones de 1s = 5s de polling
    const maxPolls = Math.min(5, Math.floor(timeoutMs / 1_000));
    for (let i = 0; i < maxPolls; i++) {
      await page.waitForTimeout(1_000);
      if (token) break;

      const iframeSrc = await page.evaluate(() => {
        const el = document.querySelector('iframe[src*="player.php"]');
        return el?.getAttribute('src') ?? null;
      }).catch(() => null);

      if (iframeSrc) {
        const m = iframeSrc.match(/[?&]t=([A-Za-z0-9_\-]{20,})/);
        if (m) {
          token = m[1];
          console.log(`  🖼️  [Cuevana] Token extraído del iframe.`);
          break;
        }
      }
    }

    if (!token) {
      console.log(`  ⚠️  [Cuevana] Token no encontrado en: ${pageUrl}`);
    }
    return token;

  } catch (err) {
    console.log(`  ⚠️  [Cuevana] Error: ${err.message}`);
    return null;
  } finally {
    if (context) { try { await context.close(); } catch { /* ignorar */ } }
  }
}

/**
 * Genera slugs candidatos para buscar en Cuevana:
 *  1. Título completo con año
 *  2. Sin subtítulo (texto después de ':')
 *  3. Título original (inglés) completo
 *  4. Título original sin subtítulo
 */
function buildSlugCandidates(title, year, originalTitle) {
  const seen = new Set();
  const add = (t) => {
    if (!t) return;
    const s = slugify(t.trim(), year);
    seen.add(s);
  };

  add(title);
  add(title.split(':')[0]);          // sin subtítulo
  if (originalTitle && originalTitle !== title) {
    add(originalTitle);
    add(originalTitle.split(':')[0]); // sin subtítulo en inglés
  }
  return [...seen];
}

/**
 * Función principal. Devuelve array de { id, name, language, qualityHint, embedUrl }
 * listos para pasarlos a trySourceExtraction().
 */
export async function getCuevanaEmbedUrls({
  title,
  originalTitle,
  year,
  type    = 'movie',
  season  = 1,
  episode = 1,
}) {
  const path       = type === 'movie' ? 'peliculas' : 'series';
  const candidates = buildSlugCandidates(title, year, originalTitle);

  let token   = null;
  let foundBase = BASES[0];

  // Limitar intentos para no exceder timeout
  // Estrategia: probar primer slug en todos los bases, luego siguiente slug
  // Máximo: 2 slugs × 3 bases = 6 intentos (2-10s cada uno = 12-60s max)
  const maxSlugs = 2; // Solo probar los 2 slugs más probables
  
  outer:
  for (let s = 0; s < Math.min(candidates.length, maxSlugs); s++) {
    for (let b = 0; b < BASES.length; b++) {
      const pageUrl  = `${BASES[b]}/${path}/${candidates[s]}`;
      console.log(`  🌮  [Cuevana] (${b + 1}/${BASES.length}) → ${pageUrl}`);
      
      // Timeouts agresivos: primer intento 15s, resto 8s
      const timeoutMs = (s === 0 && b === 0) ? 15_000 : 8_000;
      const t = await extractToken(pageUrl, timeoutMs);
      
      if (t) { 
        token = t; 
        foundBase = BASES[b]; 
        break outer; 
      }
    }
  }

  if (!token) {
    console.log(`  ❌  [Cuevana] Sin token — película no disponible en ningún mirror.`);
    return [];
  }

  console.log(`  ✅  [Cuevana] Token OK en ${foundBase} → ${LATINO_SERVERS.length} servidores.`);

  // Para series, agregar parámetros de temporada y episodio
  const episodeParams = type === 'tv' ? `&s=${season}&e=${episode}` : '';

  return LATINO_SERVERS.map((server, idx) => ({
    id:          `cuevana_${server}`,
    name:        `Cuevana ${server}`,
    language:    'Latino',
    qualityHint: 'Full HD',
    priority:    idx + 1,
    isInteractive: false,
    embedUrl:    `${foundBase}/player.php?t=${token}&server=${server}${episodeParams}`,
  }));
}
