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
      
      // Validar que sea canal LATAM (o deportes globales)
      const category = detectCategory(currentChannel);
      const isValidChannel = isLatamChannel(currentChannel) || category === 'sports';
      
      if (isValidChannel) {
        const qualityInfo = detectQuality(currentChannel);
        const score = calculateScore(currentChannel, qualityInfo, category);
        
        channels.push({
          id: `m3u_${currentChannel.tvgId || currentChannel.name.toLowerCase().replace(/\s+/g, '_')}`,
          name: currentChannel.name,
          logo: currentChannel.logo,
          url: currentChannel.url,
          group: currentChannel.groupTitle,
          category,
          country: detectCountry(currentChannel),
          source: 'm3u',
          quality: qualityInfo.label,
          language: detectLanguage(currentChannel),
          score,
          isAlive: null, // Se actualiza con healthCheck
        });
      }

      currentChannel = null;
    }
  }

  return channels;
}

/**
 * Detectar calidad del stream con scoring
 */
function detectQuality(channel) {
  const combined = `${channel.name} ${channel.groupTitle} ${channel.url || ''}`.toLowerCase();
  
  // 4K/UHD
  if (combined.includes('4k') || combined.includes('uhd') || combined.includes('2160p')) {
    return { label: '4K', score: 40 };
  }
  // 1080p/FHD
  if (combined.includes('fhd') || combined.includes('1080p') || combined.includes('full hd')) {
    return { label: '1080p', score: 30 };
  }
  // 720p/HD
  if (combined.includes('hd') || combined.includes('720p')) {
    return { label: 'HD', score: 20 };
  }
  // SD
  if (combined.includes('sd') || combined.includes('480p') || combined.includes('360p')) {
    return { label: 'SD', score: 5 };
  }
  
  // Por defecto HD
  return { label: 'HD', score: 15 };
}

/**
 * Calcular score total del canal
 */
function calculateScore(channel, qualityInfo, category) {
  let score = 0;
  
  // Calidad (base score)
  score += qualityInfo.score;
  
  // Tipo de contenido (prioridad)
  if (category === 'sports') score += 30;
  else if (category === 'movies') score += 25; // Películas 24/7
  else if (category === 'entertainment') score += 20;
  else if (category === 'news') score += 10;
  else score += 5;
  
  // Bonus por palabras clave premium
  const combined = `${channel.name} ${channel.groupTitle}`.toLowerCase();
  if (combined.includes('premium') || combined.includes('plus') || combined.includes('vip')) score += 10;
  if (combined.includes('24/7') || combined.includes('247')) score += 15;
  if (combined.includes('hd') && !combined.includes('4k')) score += 5;
  if (combined.includes('oficial') || combined.includes('official')) score += 8;
  
  return score;
}

/**
 * Detectar idioma del canal
 */
function detectLanguage(channel) {
  const combined = `${channel.name} ${channel.groupTitle}`.toLowerCase();
  
  // Español es el idioma por defecto LATAM
  if (combined.includes('español') || combined.includes('spanish') || 
      combined.includes('latino') || combined.includes('latam')) {
    return 'es';
  }
  
  // Para deportes, puede ser cualquier idioma
  const category = detectCategory(channel);
  if (category === 'sports') {
    if (combined.includes('english') || combined.includes('uk')) return 'en';
    if (combined.includes('portuguese') || combined.includes('brasil')) return 'pt';
  }
  
  return 'es'; // Por defecto español
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
