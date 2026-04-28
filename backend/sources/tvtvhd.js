/**
 * sources/tvtvhd.js
 * Wrapper para los scrapers existentes de TVTVHD
 */

import { getEvents } from '../scrapers/eventsManager.js';
import { getChannelsByCountry as getChannelsRaw } from '../scrapers/tvtvChannels.js';
import { detectCategory, detectCountry } from '../config/filters.config.js';

/**
 * Obtener eventos deportivos de TVTVHD
 * @returns {Promise<Array>}
 */
export async function getSportsEvents() {
  try {
    const events = await getEvents();
    
    // Normalizar formato
    return events.map(event => ({
      id: event.id || `event_${Date.now()}_${Math.random()}`,
      title: event.titulo || event.title,
      time: event.hora || event.time,
      sport: event.liga || event.sport,
      logo: event.logo || '🏆',
      channels: (event.canales || event.channels || []).map(ch => ({
        name: ch.nombre || ch.name,
        url: ch.url,
        quality: 'HD',
        language: 'es',
        source: 'tvtvhd',
      })),
      source: 'tvtvhd',
      type: 'event',
    }));
  } catch (error) {
    console.error('[TVTVHD] Error obteniendo eventos:', error.message);
    return [];
  }
}

/**
 * Obtener canales por país de TVTVHD
 * @returns {Promise<Array>}
 */
export async function getChannelsByCountry() {
  try {
    const countries = await getChannelsRaw();
    
    // Normalizar formato
    return countries.map(country => ({
      id: country.id,
      country: country.pais || country.country,
      flag: country.flag || '',
      totalChannels: country.totalCanales || country.totalChannels || 0,
      channels: (country.canales || country.channels || []).map(ch => ({
        id: `tvtvhd_${ch.nombre?.toLowerCase().replace(/\s+/g, '_') || 'unknown'}`,
        name: ch.nombre || ch.name,
        url: ch.url,
        logo: ch.logo || '',
        quality: 'HD',
        language: 'es',
        category: detectCategory({ name: ch.nombre || ch.name, group: country.pais || country.country }),
        country: detectCountry({ name: ch.nombre || ch.name, group: country.pais || country.country }),
        source: 'tvtvhd',
      })),
      source: 'tvtvhd',
    }));
  } catch (error) {
    console.error('[TVTVHD] Error obteniendo canales:', error.message);
    return [];
  }
}

/**
 * Obtener todos los canales de TVTVHD (flat)
 * @returns {Promise<Array>}
 */
export async function getAllTVTVHDChannels() {
  const countries = await getChannelsByCountry();
  return countries.flatMap(country => country.channels);
}

/**
 * Buscar canal específico en TVTVHD
 * @param {string} channelName
 * @returns {Promise<Object|null>}
 */
export async function findTVTVHDChannel(channelName) {
  const channels = await getAllTVTVHDChannels();
  const nameLower = channelName.toLowerCase();
  
  return channels.find(ch => 
    ch.name.toLowerCase().includes(nameLower) ||
    nameLower.includes(ch.name.toLowerCase())
  ) || null;
}
