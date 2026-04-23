/**
 * scrapers/pelisplus.js
 * 
 * Scraper HTTP puro para pelisplus.lat (sin Playwright)
 * Extrae embedUrls de películas/series en Latino
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// PelisPlus dominios alternativos
const BASE_URLS = [
  'https://www.pelisplushd.la',    // Dominio principal
  'https://ww3.pelisplushd.nu',    // Dominio secundario
];
const TIMEOUT = 15000;

  const axiosInstance = axios.create({
  timeout: TIMEOUT,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
  },
});

/**
 * Genera slugs de búsqueda para pelisplus
 */
function generateSlugs(title, year) {
  const clean = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  const slugs = [
    year ? `${clean}-${year}` : clean,
    clean,
  ];

  // Variantes sin año, sin sufijos comunes
  const noSuffix = clean
    .replace(/-pelicula$/i, '')
    .replace(/-hd$/i, '')
    .replace(/-online$/i, '');
  
  if (noSuffix !== clean) {
    slugs.push(noSuffix);
    if (year) slugs.push(`${noSuffix}-${year}`);
  }

  return [...new Set(slugs)];
}

/**
 * Extrae URLs de embed desde la página de pelisplus
 */
async function extractEmbedsFromPage(url) {
  try {
    console.log(`  🔗  [PelisPlus] Probando: ${url}`);
    const { data } = await axiosInstance.get(url);
    const $ = cheerio.load(data);

    const embeds = [];

    // Buscar iframes de video
    $('iframe[src*="embed"], iframe[data-src*="embed"]').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('google') && !src.includes('facebook')) {
        embeds.push({
          id: `pelisplus_latino_${i}`,
          name: 'PelisPlus Latino',
          embedUrl: src.startsWith('http') ? src : `https:${src}`,
          language: 'Latino',
          qualityHint: '1080p',
        });
      }
    });

    // Buscar opciones de servidor (buttons/links)
    $('.player-option, .play-option, [data-player], [data-option]').each((i, el) => {
      const dataPlayer = $(el).attr('data-player') || $(el).attr('data-option');
      if (dataPlayer && dataPlayer.startsWith('http')) {
        embeds.push({
          id: `pelisplus_latino_opt_${i}`,
          name: 'PelisPlus Latino',
          embedUrl: dataPlayer,
          language: 'Latino',
          qualityHint: '1080p',
        });
      }
    });

    if (embeds.length > 0) {
      console.log(`  ✅  [PelisPlus] ${embeds.length} embeds encontrados`);
      return embeds;
    }

    console.log(`  ⚠️  [PelisPlus] No se encontraron embeds en: ${url}`);
    return [];
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`  ⚠️  [PelisPlus] 404: ${url}`);
    } else {
      console.log(`  ❌  [PelisPlus] Error: ${error.message}`);
    }
    return [];
  }
}

/**
 * Obtiene embeds de pelisplus para películas
 */
export async function getPelisPlusMovieEmbeds({ title, year }) {
  console.log(`  🎬  [PelisPlus] → Buscando: "${title}" (${year})`);

  const slugs = generateSlugs(title, year);
  console.log(`  🔍  [PelisPlus] Slugs generados: ${slugs.join(', ')}`);

  // Probar cada dominio con cada slug hasta encontrar uno que funcione
  for (const baseUrl of BASE_URLS) {
    for (const slug of slugs) {
      const url = `${baseUrl}/pelicula/${slug}`;
      const embeds = await extractEmbedsFromPage(url);
      if (embeds.length > 0) {
        return embeds;
      }
    }
  }

  console.log(`  ℹ️  [PelisPlus] Sin resultados para "${title}"`);
  return [];
}

/**
 * Obtiene embeds de pelisplus para series
 */
export async function getPelisPlusSeriesEmbeds({ title, season, episode }) {
  console.log(`  📺  [PelisPlus] → Buscando: "${title}" S${season}E${episode}`);

  const slugs = generateSlugs(title);
  console.log(`  🔍  [PelisPlus] Slugs generados: ${slugs.join(', ')}`);

  // Probar cada dominio con cada slug y formato
  for (const baseUrl of BASE_URLS) {
    for (const slug of slugs) {
      // pelisplus usa diferentes formatos
      const urls = [
        `${baseUrl}/serie/${slug}/temporada/${season}/capitulo/${episode}`,
        `${baseUrl}/serie/${slug}/temporada-${season}/capitulo-${episode}`,
        `${baseUrl}/serie/${slug}/${season}/${episode}`,
      ];

      for (const url of urls) {
        const embeds = await extractEmbedsFromPage(url);
        if (embeds.length > 0) {
          return embeds;
        }
      }
    }
  }

  console.log(`  ℹ️  [PelisPlus] Sin resultados para "${title}" S${season}E${episode}`);
  return [];
}

/**
 * Obtiene embeds de pelisplus para anime
 */
export async function getPelisPlusAnimeEmbeds({ title, season, episode }) {
  console.log(`  🎌  [PelisPlus Anime] → Buscando: "${title}" S${season}E${episode}`);

  const slugs = generateSlugs(title);
  console.log(`  🔍  [PelisPlus Anime] Slugs generados: ${slugs.join(', ')}`);

  // Probar cada dominio con cada slug y formato
  for (const baseUrl of BASE_URLS) {
    for (const slug of slugs) {
      const urls = [
        `${baseUrl}/anime/${slug}/temporada/${season}/capitulo/${episode}`,
        `${baseUrl}/anime/${slug}/temporada-${season}/capitulo-${episode}`,
      ];

      for (const url of urls) {
        const embeds = await extractEmbedsFromPage(url);
        if (embeds.length > 0) {
          return embeds;
        }
      }
    }
  }

  console.log(`  ℹ️  [PelisPlus Anime] Sin resultados para "${title}" S${season}E${episode}`);
  return [];
}
