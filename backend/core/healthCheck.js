/**
 * core/healthCheck.js
 * Sistema de validación de streams (health check)
 */

import axios from 'axios';
import { STREAM_VALIDATION, getRandomUserAgent } from '../config/sources.config.js';

/**
 * Verificar si un stream está activo
 * @param {string} url - URL del stream
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} - { alive: boolean, status: number, latency: number }
 */
export async function checkStreamHealth(url, options = {}) {
  const {
    timeout = STREAM_VALIDATION.TIMEOUT,
    method = 'HEAD', // HEAD es más rápido que GET
  } = options;

  const startTime = Date.now();

  try {
    // Detectar tipo de stream
    const isM3U8 = url.includes('.m3u8') || url.includes('m3u8');
    const isEmbed = url.includes('embed') || url.includes('player');

    // Para embeds, solo verificamos que la página responda
    if (isEmbed) {
      const response = await axios.head(url, {
        timeout,
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': '*/*',
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 500, // Aceptar 2xx, 3xx, 4xx
      });

      return {
        alive: response.status < 400,
        status: response.status,
        latency: Date.now() - startTime,
        type: 'embed',
      };
    }

    // Para streams M3U8, verificamos con HEAD
    if (isM3U8) {
      const response = await axios({
        method,
        url,
        timeout,
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': '*/*',
          'Referer': new URL(url).origin,
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
      });

      return {
        alive: response.status === 200,
        status: response.status,
        latency: Date.now() - startTime,
        type: 'm3u8',
      };
    }

    // Otros tipos de streams
    const response = await axios.head(url, {
      timeout,
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': '*/*',
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });

    return {
      alive: response.status === 200,
      status: response.status,
      latency: Date.now() - startTime,
      type: 'unknown',
    };

  } catch (error) {
    return {
      alive: false,
      status: error.response?.status || 0,
      latency: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Verificar múltiples streams en paralelo
 * @param {Array} streams - Array de objetos { id, url }
 * @returns {Promise<Map>} - Map de resultados por ID
 */
export async function checkMultipleStreams(streams) {
  const results = new Map();

  // Procesar en lotes para no saturar
  const batchSize = STREAM_VALIDATION.PARALLEL_CHECKS;
  
  for (let i = 0; i < streams.length; i += batchSize) {
    const batch = streams.slice(i, i + batchSize);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (stream) => {
        const health = await checkStreamHealth(stream.url);
        return { id: stream.id, ...health };
      })
    );

    batchResults.forEach((result, index) => {
      const stream = batch[index];
      if (result.status === 'fulfilled') {
        results.set(stream.id, result.value);
      } else {
        results.set(stream.id, { alive: false, error: result.reason?.message });
      }
    });

    // Pequeña pausa entre lotes
    if (i + batchSize < streams.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

/**
 * Filtrar canales vivos de una lista
 * @param {Array} channels - Array de canales con URL
 * @returns {Promise<Array>} - Solo canales vivos
 */
export async function filterLiveChannels(channels) {
  console.log(`[HealthCheck] 🔍 Validando ${channels.length} canales...`);

  const streams = channels.map(ch => ({ id: ch.id, url: ch.url }));
  const healthResults = await checkMultipleStreams(streams);

  const liveChannels = channels.filter(ch => {
    const health = healthResults.get(ch.id);
    return health?.alive === true;
  });

  const deadCount = channels.length - liveChannels.length;
  console.log(`[HealthCheck] ✅ ${liveChannels.length} vivos | ❌ ${deadCount} muertos`);

  return liveChannels;
}

/**
 * Obtener estadísticas de salud de canales
 * @param {Array} channels
 * @returns {Promise<Object>}
 */
export async function getHealthStats(channels) {
  const streams = channels.map(ch => ({ id: ch.id, url: ch.url }));
  const healthResults = await checkMultipleStreams(streams);

  let alive = 0;
  let dead = 0;
  let totalLatency = 0;
  const byType = { m3u8: 0, embed: 0, unknown: 0 };

  for (const health of healthResults.values()) {
    if (health.alive) {
      alive++;
      totalLatency += health.latency || 0;
      if (health.type) byType[health.type]++;
    } else {
      dead++;
    }
  }

  return {
    total: channels.length,
    alive,
    dead,
    uptime: ((alive / channels.length) * 100).toFixed(2) + '%',
    avgLatency: alive > 0 ? Math.round(totalLatency / alive) : 0,
    byType,
  };
}
