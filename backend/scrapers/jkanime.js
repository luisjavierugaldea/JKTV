/**
 * scrapers/jkanime.js
 *
 * Extrae URLs de embed desde JKAnime (jkanime.net).
 * Especializado en anime en español latino y subtitulado.
 *
 * Flujo:
 *  1. Construir candidatos de slug desde el título.
 *  2. Navegar con Playwright a /{slug}/{episode}/.
 *  3. Capturar las URLs de embed de los servidores.
 *  4. Devolver array de { id, name, embedUrl, language, qualityHint }.
 * 
 * NOTA: Los animes son series con episodios, igual que las series de TV normales.
 */

import { createContext } from './browserPool.js';

const BASE         = 'https://jkanime.net';
const PAGE_TIMEOUT = 25_000;
const WAIT_TIME    = 8_000;

// ─── Generación de slugs ──────────────────────────────────────────────────────

function toSlug(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/\s*:\s*/g, '-')                          // "Title: Subtitle" → "title-subtitle"
    .replace(/[^a-z0-9]+/g, '-')                       // todo lo demás → guión
    .replace(/-{2,}/g, '-')                            // colapsar dobles
    .replace(/^-+|-+$/g, '');                          // recortar bordes
}

function buildSlugCandidates(title, originalTitle) {
  const seen = new Set();
  const add  = (s) => { if (s) seen.add(s); };

  for (const t of [title, originalTitle].filter(Boolean)) {
    add(toSlug(t));
    // Sin año final "(2020)" o "2020"
    add(toSlug(t.replace(/\s*\(?\d{4}\)?\s*$/, '').trim()));
    // Sin temporada "Season 1", "S2", "2nd Season"
    add(toSlug(t.replace(/\s+season\s+\d+/gi, '').replace(/\s+s\d+/gi, '').trim()));
    // Solo la parte antes de ":"
    const colonIdx = t.indexOf(':');
    if (colonIdx > 0) add(toSlug(t.slice(0, colonIdx).trim()));
    // Sin Z, GT, Super, Kai (variaciones de Dragon Ball)
    add(toSlug(t.replace(/\s+(Z|GT|Super|Kai|Clasico)$/i, '').trim()));
    // Sin "The", "A", "An" al inicio
    add(toSlug(t.replace(/^(the|a|an)\s+/i, '').trim()));
  }

  return [...seen].filter(Boolean);
}

// ─── Extracción de embeds ─────────────────────────────────────────────────────

/**
 * Intenta localizar la página del anime y extraer las URLs de embed.
 * 
 * @param {Object} params
 * @param {string} params.title         - Título en español o inglés
 * @param {string} params.originalTitle - Título original (japonés romanizado)
 * @param {string} params.type          - 'movie' o 'tv'
 * @param {number} params.season        - Temporada (para series)
 * @param {number} params.episode       - Episodio (para series)
 * @returns {Promise<Array>} Array de { id, name, embedUrl, language, qualityHint }
 */
export async function getJKAnimeEmbedUrls({ title, originalTitle, type = 'tv', season = 1, episode = 1 }) {
  const slugs = buildSlugCandidates(title, originalTitle);
  
  console.log(`  🎯  [JKAnime] → Buscando: "${title}"`);
  console.log(`  🔍  [JKAnime] Slugs generados: ${slugs.join(', ')}`);

  let context = null;
  const results = [];

  try {
    context = await createContext();
    const page = await context.newPage();

    // Bloquear recursos innecesarios
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['font', 'image', 'stylesheet'].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    // ── Intentar cada slug candidato ────────────────────────────────────
    slugLoop: for (const slug of slugs) {
      // JKAnime formato:
      // Para series: /{slug}/{episode}/
      // Para películas: /{slug}/ (sin episodio)
      
      const urls = [];
      if (type === 'tv') {
        urls.push(`${BASE}/${slug}/${episode}/`);
      } else {
        urls.push(`${BASE}/${slug}/`);
      }
      
      for (const url of urls) {
        console.log(`  🔗  [JKAnime] Probando: ${url}`);

        try {
          const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: PAGE_TIMEOUT,
          });

          if (!response || response.status() === 404) {
            console.log(`  ⚠️  [JKAnime] 404: ${url}`);
            continue;
          }

          // Esperar a que se carguen los botones de servidores
          await page.waitForTimeout(WAIT_TIME);

          // Intentar hacer scroll para activar lazy loading
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 2);
          });
          await page.waitForTimeout(1000);

          // ── Extraer URLs de servidores ──────────────────────────────────
          const embeds = await page.evaluate(() => {
            const items = [];
            
            // JKAnime usa varias estructuras:
            // 1. Divs con data-video: div[data-video]
            // 2. Botones de servidores: .bg_servers a, .anime__video__option a
            // 3. Lista de reproductores: .player-wrapper [data-player]
            
            const selectors = [
              'div[data-video]',
              '.bg_servers a[data-video]',
              '.anime__video__option a',
              '.player-wrapper [data-player]',
              '.player_conte [data-video]',
              '.caps_serv a'
            ];
            
            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              
              elements.forEach((el, index) => {
                const serverName = (
                  el.textContent || 
                  el.getAttribute('title') || 
                  el.getAttribute('data-player') ||
                  el.getAttribute('data-name') ||
                  `Servidor ${index + 1}`
                ).trim();
                
                let embedUrl = el.getAttribute('data-video') || 
                              el.getAttribute('data-player') ||
                              el.getAttribute('href') || 
                              el.getAttribute('data-src');
                
                if (embedUrl && embedUrl !== '#') {
                  // Normalizar URL
                  if (embedUrl.startsWith('//')) {
                    embedUrl = `https:${embedUrl}`;
                  } else if (embedUrl.startsWith('/')) {
                    // Algunas veces JKAnime usa rutas relativas a su propio reproductor
                    embedUrl = `https://jkanime.net${embedUrl}`;
                  } else if (!embedUrl.startsWith('http')) {
                    embedUrl = `https://${embedUrl}`;
                  }
                  
                  items.push({
                    name: serverName,
                    embedUrl,
                    index: items.length,
                  });
                }
              });
              
              // Si encontramos resultados, salir del loop
              if (items.length > 0) break;
            }

            return items;
          });

          if (embeds.length > 0) {
            console.log(`  ✅  [JKAnime] ${embeds.length} servidores encontrados en: ${url}`);
            
            embeds.forEach((embed) => {
              // Determinar idioma por nombre del servidor
              let language = 'Subtitulado'; // Por defecto
              if (/latino|lat/i.test(embed.name)) {
                language = 'Latino';
              }

              results.push({
                id: `jkanime_${embed.name.toLowerCase().replace(/\s+/g, '_')}_${embed.index}`,
                name: `JKAnime - ${embed.name}`,
                embedUrl: embed.embedUrl,
                language,
                qualityHint: '1080p',
              });
            });

            // Si encontramos embeds, salir de ambos loops
            break slugLoop;
          } else {
            console.log(`  ⚠️  [JKAnime] Sin servidores en: ${url}`);
          }

        } catch (err) {
          console.log(`  ❌  [JKAnime] Error navegando: ${err.message}`);
          continue;
        }
      } // fin del loop de urls
    } // fin del loop de slugs

  } catch (err) {
    console.error(`  ❌  [JKAnime] Error general:`, err.message);
  } finally {
    if (context) {
      try {
        await context.close();
      } catch { /* ignorar */ }
    }
  }

  if (results.length === 0) {
    console.log(`  ℹ️  [JKAnime] Sin resultados para "${title}"`);
  }

  return results;
}
