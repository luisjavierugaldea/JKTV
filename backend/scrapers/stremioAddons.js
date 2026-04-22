/**
 * scrapers/stremioAddons.js
 * 
 * Integración con addons de Stremio para obtener streams adicionales.
 * Los addons de Stremio exponen una API HTTP simple que devuelve streams.
 * 
 * API Stremio: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/README.md
 * 
 * Addons populares:
 *  - Torrentio: https://torrentio.strem.fun (Torrents con subtítulos Latino/Español)
 *  - Comet: https://comet.fast (Debrid links)
 *  - ThePirateBay+: https://tpb.strem.fun (Torrents directos)
 */

import axios from 'axios';

// Addons de Stremio a consultar (en orden de prioridad)
const STREMIO_ADDONS = [
  {
    name: 'Torrentio',
    baseUrl: 'https://torrentio.strem.fun',
    // Configuración: sort=qualitysize (mejor calidad primero), lang=spanish (subtítulos español)
    manifestUrl: 'https://torrentio.strem.fun/sort=qualitysize|qualityfilter=480p,scr,cam/manifest.json',
    priority: 1,
    supportsSubtitles: true,
  },
  {
    name: 'Comet',
    baseUrl: 'https://comet.elfhosted.com',
    manifestUrl: 'https://comet.elfhosted.com/manifest.json',
    priority: 2,
    supportsSubtitles: true,
  },
];

const REQUEST_TIMEOUT = 15000; // 15s timeout por addon

/**
 * Detecta el idioma del stream desde el título/descripción
 */
function detectLanguage(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  
  if (text.match(/\b(latino|lat|spanish|español|castellano|latinoamerica|latam)\b/i)) {
    return 'Latino';
  }
  if (text.match(/\b(korean|coreano|hangul|한국어)\b/i)) {
    return 'Coreano';
  }
  if (text.match(/\b(japanese|japones|日本語)\b/i)) {
    return 'Japones';
  }
  if (text.match(/\b(chinese|chino|mandarin|中文)\b/i)) {
    return 'Chino';
  }
  if (text.match(/\b(subtitles|subs|subtitulado|sub)\b/i)) {
    return 'Subtitulado';
  }
  
  return 'Multi';
}

/**
 * Extrae calidad del título del stream (1080p, 720p, etc)
 */
function detectQuality(title) {
  const match = title.match(/\b(2160p|4K|1080p|720p|480p|360p)\b/i);
  if (match) {
    const quality = match[1].toLowerCase();
    if (quality === '4k') return '2160p';
    return quality;
  }
  
  // Por defecto, torrents suelen ser HD
  return '1080p';
}

/**
 * Detecta tipo de stream (Torrent, HTTP, etc)
 */
function detectStreamType(url, infoHash) {
  if (infoHash || url.includes('magnet:') || url.includes('infohash')) {
    return 'torrent';
  }
  if (url.includes('.m3u8')) {
    return 'hls';
  }
  if (url.includes('.mp4') || url.includes('.mkv') || url.includes('.avi')) {
    return 'http';
  }
  return 'http';
}

/**
 * Convierte un stream de Stremio a nuestro formato
 */
function parseStremioStream(stream, addonName, addonPriority) {
  const title = stream.title || stream.name || '';
  const description = stream.description || '';
  
  // Stremio puede devolver:
  // - url: enlace directo (HTTP/HLS)
  // - infoHash + fileIdx: torrent magnet link
  // - externalUrl: enlace externo que requiere resolver
  
  let streamUrl = null;
  let streamType = 'http';
  
  if (stream.url) {
    streamUrl = stream.url;
    streamType = detectStreamType(stream.url);
  } else if (stream.infoHash) {
    // Torrent magnet link
    streamUrl = `magnet:?xt=urn:btih:${stream.infoHash}`;
    if (stream.fileIdx !== undefined) {
      streamUrl += `&so=${stream.fileIdx}`;
    }
    streamType = 'torrent';
  } else if (stream.externalUrl) {
    streamUrl = stream.externalUrl;
    streamType = 'external';
  }
  
  if (!streamUrl) {
    return null;
  }
  
  const language = detectLanguage(title, description);
  const quality = detectQuality(title);
  
  return {
    id: `stremio_${addonName.toLowerCase()}_${stream.infoHash || Date.now()}`,
    name: `${addonName} ${streamType === 'torrent' ? '🧲' : '📡'}`,
    embedUrl: streamUrl,
    language,
    qualityHint: quality,
    priority: addonPriority,
    streamType, // 'torrent', 'hls', 'http', 'external'
    title: title.trim(),
    seeders: stream.seeders || 0, // Para torrents
    sources: stream.sources || [], // Lista de trackers para torrents
  };
}

/**
 * Consulta un addon de Stremio para obtener streams
 * 
 * @param {string} addonBaseUrl - URL base del addon (ej: https://torrentio.strem.fun)
 * @param {string} type - 'movie' o 'series'
 * @param {string} imdbId - ID de IMDB (ej: 'tt0816692')
 * @param {number} season - Temporada (solo para series)
 * @param {number} episode - Episodio (solo para series)
 */
async function fetchAddonStreams(addon, type, imdbId, season, episode) {
  try {
    // Construir el ID según el tipo
    // Movies: "tt0816692"
    // Series: "tt0816692:1:1" (imdbId:season:episode)
    let resourceId = imdbId;
    if (type === 'series' && season && episode) {
      resourceId = `${imdbId}:${season}:${episode}`;
    }
    
    // URL del addon: {baseUrl}/stream/{type}/{resourceId}.json
    const streamUrl = `${addon.baseUrl}/stream/${type}/${resourceId}.json`;
    
    console.log(`  🎯  [Stremio/${addon.name}] → ${streamUrl}`);
    
    const { data } = await axios.get(streamUrl, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'Stremio/4.4.168',
        'Accept': 'application/json',
      },
    });
    
    if (!data || !data.streams || data.streams.length === 0) {
      console.log(`  ℹ️  [Stremio/${addon.name}] Sin streams disponibles`);
      return [];
    }
    
    console.log(`  ✅  [Stremio/${addon.name}] ${data.streams.length} streams encontrados`);
    
    // Convertir streams de Stremio a nuestro formato
    const parsedStreams = data.streams
      .map(s => parseStremioStream(s, addon.name, addon.priority))
      .filter(Boolean);
    
    // Filtrar solo HTTP/HLS (ignorar torrents por ahora, requieren cliente especial)
    const httpStreams = parsedStreams.filter(s => 
      s.streamType === 'http' || s.streamType === 'hls'
    );
    
    if (httpStreams.length > 0) {
      console.log(`  📡  [Stremio/${addon.name}] ${httpStreams.length} streams HTTP/HLS disponibles`);
    }
    
    return httpStreams;
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log(`  ⏱️  [Stremio/${addon.name}] Timeout (${REQUEST_TIMEOUT}ms)`);
    } else if (error.response?.status === 404) {
      console.log(`  ℹ️  [Stremio/${addon.name}] No encontrado (404)`);
    } else {
      console.log(`  ⚠️  [Stremio/${addon.name}] Error: ${error.message}`);
    }
    return [];
  }
}

/**
 * Consulta todos los addons de Stremio en paralelo
 * 
 * @param {Object} params
 * @param {string} params.type - 'movie' o 'series'
 * @param {string} params.imdbId - ID de IMDB
 * @param {number} params.season - Temporada (solo series)
 * @param {number} params.episode - Episodio (solo series)
 * @returns {Promise<Array>} Array de streams en formato estándar
 */
export async function getStremioAddonStreams({ type, imdbId, season, episode }) {
  if (!imdbId) {
    console.log(`  ⚠️  [Stremio] Sin IMDB ID, no se puede consultar addons`);
    return [];
  }
  
  console.log(`  🎬  [Stremio] Consultando ${STREMIO_ADDONS.length} addons para ${type} ${imdbId}...`);
  
  // Consultar todos los addons en paralelo
  const results = await Promise.all(
    STREMIO_ADDONS.map(addon => 
      fetchAddonStreams(addon, type, imdbId, season, episode)
    )
  );
  
  // Aplanar resultados
  const allStreams = results.flat();
  
  if (allStreams.length > 0) {
    console.log(`  🎉  [Stremio] Total: ${allStreams.length} streams de addons`);
  } else {
    console.log(`  ℹ️  [Stremio] Sin streams de addons`);
  }
  
  return allStreams;
}

/**
 * Obtiene el IMDB ID desde TMDB
 * (Stremio usa IMDB IDs, nosotros usamos TMDB IDs)
 */
export async function getImdbIdFromTmdb(tmdbId, type, tmdbApiKey) {
  try {
    const url = `https://api.themoviedb.org/3/${type === 'series' ? 'tv' : 'movie'}/${tmdbId}/external_ids`;
    const { data } = await axios.get(url, {
      params: { api_key: tmdbApiKey },
      timeout: 5000,
    });
    
    const imdbId = data.imdb_id;
    if (imdbId) {
      console.log(`  🔗  [TMDB→IMDB] ${tmdbId} → ${imdbId}`);
      return imdbId;
    }
    
    console.log(`  ⚠️  [TMDB→IMDB] Sin IMDB ID para TMDB:${tmdbId}`);
    return null;
    
  } catch (error) {
    console.log(`  ⚠️  [TMDB→IMDB] Error: ${error.message}`);
    return null;
  }
}
