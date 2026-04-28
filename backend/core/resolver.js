/**
 * core/resolver.js
 * Sistema de resolución de streams multi-fuente
 * Encuentra streams reales (.m3u8 o embed) para un canal dado
 */

import { getAllM3UChannels, findM3UChannel } from '../sources/m3u_sources.js';
import { getChannelsByCountry } from '../sources/tvtvhd.js';
import { checkStreamHealth } from './healthCheck.js';
import cacheManager from './cache.js';

/**
 * Normalizar nombre de canal para búsqueda
 */
function normalizeChannelName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Calcular similitud entre dos strings (simple)
 */
function similarity(str1, str2) {
  const s1 = normalizeChannelName(str1);
  const s2 = normalizeChannelName(str2);
  
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Palabras en común
  const words1 = s1.split(' ');
  const words2 = s2.split(' ');
  const commonWords = words1.filter(w => words2.includes(w));
  
  if (commonWords.length > 0) {
    return commonWords.length / Math.max(words1.length, words2.length);
  }
  
  return 0;
}

/**
 * Buscar canal en múltiples fuentes
 * @param {string} channelName - Nombre del canal a buscar
 * @returns {Promise<Array>} - Array de streams encontrados con score
 */
export async function resolveChannel(channelName) {
  const cacheKey = `resolver:${normalizeChannelName(channelName)}`;
  
  // Verificar caché
  const cached = cacheManager.get(cacheKey);
  if (cached) {
    return cached;
  }

  console.log(`[Resolver] 🔍 Buscando streams para: "${channelName}"`);

  const results = [];

  // 1. Buscar en M3U
  try {
    const m3uChannels = await getAllM3UChannels();
    const matches = m3uChannels
      .map(ch => ({
        ...ch,
        score: similarity(channelName, ch.name),
      }))
      .filter(ch => ch.score > 0.5) // Solo coincidencias > 50%
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5

    results.push(...matches.map(ch => ({
      source: 'm3u',
      name: ch.name,
      url: ch.url,
      logo: ch.logo,
      quality: ch.quality,
      score: ch.score,
      type: 'm3u8',
    })));

    console.log(`[Resolver] 📺 M3U: ${matches.length} coincidencias`);
  } catch (error) {
    console.error('[Resolver] Error en M3U:', error.message);
  }

  // 2. Buscar en TVTVHD
  try {
    const tvtvChannels = await getChannelsByCountry();
    const allChannels = tvtvChannels.flatMap(country => country.canales || []);
    
    const matches = allChannels
      .map(ch => ({
        ...ch,
        score: similarity(channelName, ch.nombre),
      }))
      .filter(ch => ch.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    results.push(...matches.map(ch => ({
      source: 'tvtvhd',
      name: ch.nombre,
      url: ch.url,
      logo: ch.logo || '',
      quality: 'HD',
      score: ch.score,
      type: 'embed',
    })));

    console.log(`[Resolver] 🌐 TVTVHD: ${matches.length} coincidencias`);
  } catch (error) {
    console.error('[Resolver] Error en TVTVHD:', error.message);
  }

  // Ordenar por score
  results.sort((a, b) => b.score - a.score);

  console.log(`[Resolver] ✅ Total: ${results.length} streams encontrados`);

  // Cachear resultados
  cacheManager.set(cacheKey, results, 30 * 60 * 1000); // 30 min

  return results;
}

/**
 * Obtener el mejor stream para un canal (validado)
 * @param {string} channelName
 * @returns {Promise<Object|null>}
 */
export async function getBestStream(channelName) {
  const streams = await resolveChannel(channelName);
  
  if (streams.length === 0) {
    console.log(`[Resolver] ❌ No se encontraron streams para: "${channelName}"`);
    return null;
  }

  // Validar el mejor stream
  for (const stream of streams) {
    const health = await checkStreamHealth(stream.url);
    
    if (health.alive) {
      console.log(`[Resolver] ✅ Stream válido encontrado: ${stream.name} (${stream.source})`);
      return {
        ...stream,
        latency: health.latency,
        validated: true,
      };
    }
  }

  // Si ninguno está vivo, devolver el mejor por score
  console.log(`[Resolver] ⚠️ Ningún stream validado, devolviendo mejor match`);
  return {
    ...streams[0],
    validated: false,
  };
}

/**
 * Resolver múltiples canales en paralelo
 * @param {Array<string>} channelNames
 * @returns {Promise<Map>} - Map de resultados por nombre
 */
export async function resolveMultipleChannels(channelNames) {
  const results = new Map();

  const promises = channelNames.map(async (name) => {
    const stream = await getBestStream(name);
    return { name, stream };
  });

  const settled = await Promise.allSettled(promises);

  settled.forEach((result, index) => {
    const channelName = channelNames[index];
    if (result.status === 'fulfilled') {
      results.set(channelName, result.value.stream);
    } else {
      results.set(channelName, null);
    }
  });

  return results;
}
