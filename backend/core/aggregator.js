/**
 * core/aggregator.js
 * Sistema de agregación multi-fuente con actualización automática
 */

import cron from 'node-cron';
import { getAllM3UChannels } from '../sources/m3u_sources.js';
import { getAllTVTVHDChannels, getSportsEvents } from '../sources/tvtvhd.js';
import { filterLiveChannels, getHealthStats } from './healthCheck.js';
import cacheManager from './cache.js';
import { UPDATE_INTERVALS, CACHE_TTL } from '../config/sources.config.js';

class ContentAggregator {
  constructor() {
    this.isInitialized = false;
    this.updateInProgress = false;
    this.lastUpdate = null;
    this.stats = {
      totalChannels: 0,
      m3uChannels: 0,
      scrapedChannels: 0,
      events: 0,
      uptime: '0%',
    };
  }

  /**
   * Inicializar el agregador y programar actualizaciones
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('[Aggregator] Ya está inicializado');
      return;
    }

    console.log('[Aggregator] 🚀 Inicializando sistema de agregación...');

    // Actualización inicial
    await this.updateAllContent();

    // Programar actualizaciones automáticas
    this.scheduleCronJobs();

    this.isInitialized = true;
    console.log('[Aggregator] ✅ Sistema de agregación iniciado');
  }

  /**
   * Programar tareas cron para actualizaciones automáticas
   */
  scheduleCronJobs() {
    // Actualizar M3U cada 30 minutos
    cron.schedule('*/30 * * * *', async () => {
      console.log('[Aggregator] ⏰ Actualización programada: M3U');
      await this.updateM3UChannels();
    });

    // Actualizar canales scrapeados cada 30 minutos
    cron.schedule('*/30 * * * *', async () => {
      console.log('[Aggregator] ⏰ Actualización programada: Canales scrapeados');
      await this.updateScrapedChannels();
    });

    // Actualizar eventos cada 5 minutos
    cron.schedule('*/5 * * * *', async () => {
      console.log('[Aggregator] ⏰ Actualización programada: Eventos deportivos');
      await this.updateSportsEvents();
    });

    // Health check cada hora
    cron.schedule('0 * * * *', async () => {
      console.log('[Aggregator] ⏰ Health check programado');
      await this.runHealthCheck();
    });

    console.log('[Aggregator] 📅 Cron jobs programados:');
    console.log('  • M3U: cada 30 minutos');
    console.log('  • Scrapers: cada 30 minutos');
    console.log('  • Eventos: cada 5 minutos');
    console.log('  • Health Check: cada hora');
  }

  /**
   * Actualizar todo el contenido
   */
  async updateAllContent() {
    if (this.updateInProgress) {
      console.log('[Aggregator] ⚠️ Actualización ya en progreso...');
      return;
    }

    this.updateInProgress = true;
    console.log('[Aggregator] 🔄 Actualizando todo el contenido...');

    try {
      await Promise.allSettled([
        this.updateM3UChannels(),
        this.updateScrapedChannels(),
        this.updateSportsEvents(),
      ]);

      this.lastUpdate = new Date();
      console.log('[Aggregator] ✅ Actualización completa exitosa');
    } catch (error) {
      console.error('[Aggregator] ❌ Error en actualización:', error);
    } finally {
      this.updateInProgress = false;
    }
  }

  /**
   * Actualizar canales M3U
   */
  async updateM3UChannels() {
    try {
      const channels = await getAllM3UChannels();
      cacheManager.set('aggregator:m3u_channels', channels, CACHE_TTL.M3U_CHANNELS);
      this.stats.m3uChannels = channels.length;
      console.log(`[Aggregator] 📺 M3U actualizado: ${channels.length} canales`);
      return channels;
    } catch (error) {
      console.error('[Aggregator] Error actualizando M3U:', error.message);
      return [];
    }
  }

  /**
   * Actualizar canales scrapeados
   */
  async updateScrapedChannels() {
    try {
      const channels = await getAllTVTVHDChannels();
      cacheManager.set('aggregator:scraped_channels', channels, CACHE_TTL.SCRAPED_CHANNELS);
      this.stats.scrapedChannels = channels.length;
      console.log(`[Aggregator] 🌐 Scrapers actualizados: ${channels.length} canales`);
      return channels;
    } catch (error) {
      console.error('[Aggregator] Error actualizando scrapers:', error.message);
      return [];
    }
  }

  /**
   * Actualizar eventos deportivos
   */
  async updateSportsEvents() {
    try {
      const events = await getSportsEvents();
      cacheManager.set('aggregator:sports_events', events, CACHE_TTL.EVENTS);
      this.stats.events = events.length;
      console.log(`[Aggregator] 🏆 Eventos actualizados: ${events.length} eventos`);
      return events;
    } catch (error) {
      console.error('[Aggregator] Error actualizando eventos:', error.message);
      return [];
    }
  }

  /**
   * Ejecutar health check en todos los canales
   */
  async runHealthCheck() {
    try {
      console.log('[Aggregator] 🔍 Iniciando health check...');
      
      const allChannels = await this.getAllChannels();
      const stats = await getHealthStats(allChannels);
      
      this.stats.uptime = stats.uptime;
      this.stats.totalChannels = stats.total;
      
      console.log(`[Aggregator] 📊 Health Check: ${stats.alive}/${stats.total} vivos (${stats.uptime})`);
      return stats;
    } catch (error) {
      console.error('[Aggregator] Error en health check:', error.message);
      return null;
    }
  }

  /**
   * Obtener todos los canales agregados
   */
  async getAllChannels() {
    // Intentar obtener del caché primero
    const m3uChannels = cacheManager.get('aggregator:m3u_channels') || await this.updateM3UChannels();
    const scrapedChannels = cacheManager.get('aggregator:scraped_channels') || await this.updateScrapedChannels();

    // Combinar y eliminar duplicados por URL
    const allChannels = [...m3uChannels, ...scrapedChannels];
    const uniqueChannels = Array.from(
      new Map(allChannels.map(ch => [ch.url, ch])).values()
    );

    this.stats.totalChannels = uniqueChannels.length;

    return uniqueChannels;
  }

  /**
   * Obtener canales por categoría
   */
  async getChannelsByCategory(category) {
    const channels = await this.getAllChannels();
    return channels.filter(ch => ch.category === category);
  }

  /**
   * Obtener canales por país
   */
  async getChannelsByCountry(country) {
    const channels = await this.getAllChannels();
    return channels.filter(ch => ch.country === country);
  }

  /**
   * Obtener eventos deportivos
   */
  async getSportsEvents() {
    return cacheManager.get('aggregator:sports_events') || await this.updateSportsEvents();
  }

  /**
   * Obtener estadísticas del agregador
   */
  getStats() {
    return {
      ...this.stats,
      lastUpdate: this.lastUpdate,
      isUpdating: this.updateInProgress,
      cache: cacheManager.getStats(),
    };
  }

  /**
   * Forzar actualización manual
   */
  async forceUpdate() {
    console.log('[Aggregator] 🔄 Actualización forzada manualmente');
    await this.updateAllContent();
  }
}

// Singleton
const aggregator = new ContentAggregator();

export default aggregator;
