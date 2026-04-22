/**
 * scrapers/animeflv.js
 *
 * Extrae URLs de embed desde AnimeFLV (animeflv.net).
 * Especializado en anime en español latino y subtitulado.
 *
 * Flujo:
 *  1. Construir candidatos de slug desde el título.
 *  2. Navegar con Playwright a /ver/{slug}-{episode}.
 *  3. Capturar las URLs de embed de los servidores (Fembed, Mega, etc.).
 *  4. Devolver array de { id, name, embedUrl, language, qualityHint }.
 * 
 * NOTA: Los animes son series con episodios, igual que las series de TV normales.
 */

import { createContext } from './browserPool.js';

const BASE         = 'https://www3.animeflv.net';
const PAGE_TIMEOUT = 25_000;
const WAIT_TIME    = 10_000;

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
export async function getAnimeFLVEmbedUrls({ title, originalTitle, type = 'tv', season = 1, episode = 1 }) {
  const slugs = buildSlugCandidates(title, originalTitle);
  
  console.log(`  🎌  [AnimeFLV] → Buscando: "${title}"`);
  console.log(`  🔍  [AnimeFLV] Slugs generados: ${slugs.join(', ')}`);

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
      // AnimeFLV tiene diferentes formatos de URL:
      // Para series: /ver/{slug}-{episode}
      // Para películas: /ver/{slug}-pelicula o simplemente /ver/{slug}
      
      const urls = [];
      if (type === 'tv') {
        urls.push(`${BASE}/ver/${slug}-${episode}`);
        urls.push(`${BASE}/ver/${slug}-episodio-${episode}`);
      } else {
        urls.push(`${BASE}/ver/${slug}-pelicula`);
        urls.push(`${BASE}/ver/${slug}`);
      }
      
      for (const url of urls) {
        console.log(`  🔗  [AnimeFLV] Probando: ${url}`);

        try {
          const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: PAGE_TIMEOUT,
          });

          if (!response || response.status() === 404) {
            console.log(`  ⚠️  [AnimeFLV] 404: ${url}`);
            continue;
          }

          // Esperar a que se carguen los botones de servidores
          await page.waitForTimeout(WAIT_TIME);

          // Intentar hacer scroll para activar lazy loading
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 2);
          });
          await page.waitForTimeout(1000);

          // DEBUG: Ver el HTML de la página para diagnosticar
          const pageTitle = await page.title();
          console.log(`  📄  [AnimeFLV] Título de página: "${pageTitle}"`);
          
          const hasContent = await page.evaluate(() => {
            return {
              hasCapOptions: !!document.querySelector('.CapOptions, .CapOption'),
              hasRTbl: !!document.querySelector('.RTbl'),
              hasDataVideo: !!document.querySelector('[data-video]'),
              bodyText: document.body.textContent.substring(0, 200),
            };
          });
          console.log(`  🔍  [AnimeFLV] Elementos encontrados:`, JSON.stringify(hasContent, null, 2));

          // ── Extraer URLs de servidores ──────────────────────────────────
          const embeds = await page.evaluate(() => {
            const items = [];
            
            // AnimeFLV usa múltiples posibles estructuras:
            // 1. Botones de opciones: .CapOptions, .CapOption, .CapOptns
            // 2. Lista de servidores: .RTbl, .CpCn, .anime__video__option
            // 3. Enlaces directos: [data-video], [data-player]
            // 4. Scripts embebidos con URLs
            
            const selectors = [
              // Selectores clásicos de AnimeFLV
              '.CapOptions li a',
              '.CapOption li a',
              'ul.CapOptns li a',
              '.RTbl .RTbl-buttons li a',
              '.CpCn .anime_video_option a',
              
              // Selectores modernos
              '.anime__video__player .OptContainer ul li a',
              '.anime__video__option a',
              '.player-wrapper [data-player]',
              '.downloads tbody tr td a',
              
              // Data attributes
              '[data-video]',
              '[data-player]',
              'button[data-video]',
              
              // Alternativos genéricos
              '.server-item a',
              '.option-item a',
              '#opt_servers a'
            ];
            
            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              
              elements.forEach((el, index) => {
                const serverName = (
                  el.textContent || 
                  el.getAttribute('title') || 
                  el.getAttribute('data-name') ||
                  el.getAttribute('data-player') ||
                  `Servidor ${items.length + 1}`
                ).trim();
                
                let embedUrl = el.getAttribute('data-video') || 
                              el.getAttribute('data-player') ||
                              el.getAttribute('href') || 
                              el.getAttribute('data-src') ||
                              el.getAttribute('src');
                
                // Validar que la URL sea válida y no un placeholder
                if (embedUrl && embedUrl !== '#' && embedUrl !== 'javascript:void(0)' && serverName) {
                  // Normalizar URL
                  if (embedUrl.startsWith('//')) {
                    embedUrl = `https:${embedUrl}`;
                  } else if (embedUrl.startsWith('/')) {
                    embedUrl = `https://www3.animeflv.net${embedUrl}`;
                  } else if (!embedUrl.startsWith('http')) {
                    embedUrl = `https://${embedUrl}`;
                  }
                  
                  // Evitar duplicados
                  const isDuplicate = items.some(item => item.embedUrl === embedUrl);
                  if (!isDuplicate) {
                    items.push({
                      name: serverName,
                      embedUrl,
                      index: items.length,
                    });
                  }
                }
              });
              
              // Si encontramos resultados, salir del loop
              if (items.length > 0) break;
            }

            return items;
          });

          if (embeds.length > 0) {
            console.log(`  ✅  [AnimeFLV] ${embeds.length} servidores encontrados en: ${url}`);
            
            embeds.forEach((embed) => {
              // Determinar idioma por nombre del servidor
              let language = 'Subtitulado'; // Por defecto en AnimeFLV
              if (/latino|lat/i.test(embed.name)) {
                language = 'Latino';
              }

              results.push({
                id: `animeflv_${embed.name.toLowerCase().replace(/\s+/g, '_')}_${embed.index}`,
                name: `AnimeFLV - ${embed.name}`,
                embedUrl: embed.embedUrl,
                language,
                qualityHint: '1080p',
              });
            });

            // Si encontramos embeds, salir de ambos loops
            break slugLoop;
          } else {
            console.log(`  ⚠️  [AnimeFLV] Sin servidores en: ${url}`);
          }

        } catch (err) {
          console.log(`  ❌  [AnimeFLV] Error navegando: ${err.message}`);
          continue;
        }
      } // fin del loop de urls
    } // fin del loop de slugs

  } catch (err) {
    console.error(`  ❌  [AnimeFLV] Error general:`, err.message);
  } finally {
    if (context) {
      try {
        await context.close();
      } catch { /* ignorar */ }
    }
  }

  if (results.length === 0) {
    console.log(`  ℹ️  [AnimeFLV] Sin resultados para "${title}"`);
  }

  return results;
}
