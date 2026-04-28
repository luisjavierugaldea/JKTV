/**
 * sources/m3u_sources.js
 * Parser automático de listas M3U con filtrado LATAM
 */

import axios from 'axios';
import { isLatamChannel, detectCategory, detectCountry } from '../config/filters.config.js';
import { getEnabledM3USources, getRandomUserAgent } from '../config/sources.config.js';

/**
 * Parsear contenido M3U
 * @param {string} content - Contenido del archivo M3U
 * @returns {Array} - Array de canales parseados
 */
function parseM3U(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  const channels = [];
  
  let currentChannel = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detectar inicio de canal
    if (line.startsWith('#EXTINF:')) {
      // Extraer metadata
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupTitleMatch = line.match(/group-title="([^"]*)"/);
      
      // Extraer nombre del canal (después de la última coma)
      const nameMatch = line.split(',').pop()?.trim();

      currentChannel = {
        tvgId: tvgIdMatch?.[1] || '',
        tvgName: tvgNameMatch?.[1] || nameMatch || '',
        name: nameMatch || tvgNameMatch?.[1] || '',
        logo: tvgLogoMatch?.[1] || '',
        groupTitle: groupTitleMatch?.[1] || '',
        url: null,
      };
    }
    // Detectar URL del stream
    else if (line.startsWith('http') && currentChannel) {
      currentChannel.url = line;
      
      // Validar que sea canal LATAM
      if (isLatamChannel(currentChannel)) {
        channels.push({
          id: `m3u_${currentChannel.tvgId || currentChannel.name.toLowerCase().replace(/\s+/g, '_')}`,
          name: currentChannel.name,
          logo: currentChannel.logo,
          url: currentChannel.url,
          group: currentChannel.groupTitle,
          category: detectCategory(currentChannel),
          country: detectCountry(currentChannel),
          source: 'm3u',
          quality: detectQuality(currentChannel),
          language: 'es',
        });
      }

      currentChannel = null;
    }
  }

  return channels;
}

/**
 * Detectar calidad del stream
 */
function detectQuality(channel) {
  const combined = `${channel.name} ${channel.groupTitle}`.toLowerCase();
  
  if (combined.includes('4k') || combined.includes('uhd')) return '4K';
  if (combined.includes('fhd') || combined.includes('1080p')) return 'FHD';
  if (combined.includes('hd') || combined.includes('720p')) return 'HD';
  if (combined.includes('sd') || combined.includes('480p')) return 'SD';
  
  return 'HD'; // Por defecto asumimos HD
}

/**
 * Descargar y parsear una fuente M3U
 * @param {Object} source - Objeto de configuración de fuente
 * @returns {Promise<Array>}
 */
async function fetchM3USource(source) {
  try {
    console.log(`[M3U] 🔍 Descargando: ${source.name}...`);
    
    const response = await axios.get(source.url, {
      timeout: 30000,
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': '*/*',
      },
    });

    const channels = parseM3U(response.data);
    console.log(`[M3U] ✅ ${source.name}: ${channels.length} canales LATAM encontrados`);
    
    return channels;
  } catch (error) {
    console.error(`[M3U] ❌ Error en ${source.name}:`, error.message);
    return [];
  }
}

/**
 * Obtener todos los canales de todas las fuentes M3U
 * @returns {Promise<Array>}
 */
export async function getAllM3UChannels() {
  const sources = getEnabledM3USources();
  
  console.log(`[M3U] 🚀 Iniciando descarga de ${sources.length} fuentes M3U...`);

  // Descargar todas las fuentes en paralelo
  const results = await Promise.allSettled(
    sources.map(source => fetchM3USource(source))
  );

  // Combinar resultados exitosos
  const allChannels = results
    .filter(result => result.status === 'fulfilled')
    .flatMap(result => result.value);

  // Eliminar duplicados por URL
  const uniqueChannels = Array.from(
    new Map(allChannels.map(ch => [ch.url, ch])).values()
  );

  console.log(`[M3U] 📊 Total: ${uniqueChannels.length} canales únicos (${allChannels.length - uniqueChannels.length} duplicados eliminados)`);

  return uniqueChannels;
}

/**
 * Obtener canales M3U por categoría
 * @param {string} category - 'sports' | 'entertainment' | 'news' | 'other'
 * @returns {Promise<Array>}
 */
export async function getM3UChannelsByCategory(category) {
  const channels = await getAllM3UChannels();
  return channels.filter(ch => ch.category === category);
}

/**
 * Obtener canales M3U por país
 * @param {string} country
 * @returns {Promise<Array>}
 */
export async function getM3UChannelsByCountry(country) {
  const channels = await getAllM3UChannels();
  return channels.filter(ch => ch.country === country);
}

/**
 * Buscar canal específico en M3U
 * @param {string} channelName
 * @returns {Promise<Object|null>}
 */
export async function findM3UChannel(channelName) {
  const channels = await getAllM3UChannels();
  const nameLower = channelName.toLowerCase();
  
  return channels.find(ch => 
    ch.name.toLowerCase().includes(nameLower) ||
    nameLower.includes(ch.name.toLowerCase())
  ) || null;
}
