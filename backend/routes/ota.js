/**
 * routes/ota.js
 * Sistema OTA (Over-The-Air) para actualización dinámica sin reinstalar APK
 */

import express from 'express';
import aggregator from '../core/aggregator.js';

const router = express.Router();

// Versión actual de la aplicación (incrementar con cada actualización)
const APP_VERSION = '2.0.0';

// URL del frontend (cambia según entorno)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * GET /app/config
 * Configuración principal de la aplicación (OTA)
 */
router.get('/config', (req, res) => {
  try {
    const config = {
      version: APP_VERSION,
      frontendUrl: FRONTEND_URL,
      features: {
        movies: true,
        tv: true,
        anime: true,
        kdrama: true,
        iptv: true,
        sports: true,
        music: true,
      },
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001/api',
      updateRequired: false, // Cambiar a true para forzar actualización
      minVersion: '1.0.0',
    };

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('[OTA] Error en /app/config:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo configuración',
    });
  }
});

/**
 * GET /app/features
 * Características habilitadas/deshabilitadas
 */
router.get('/features', (req, res) => {
  try {
    const features = {
      sections: {
        movies: {
          enabled: true,
          scrapers: ['cuevana', 'pelisplus'],
          priority: 1,
        },
        tv: {
          enabled: true,
          sources: ['m3u', 'tvtvhd'],
          aggregated: true,
          priority: 2,
        },
        anime: {
          enabled: true,
          scrapers: ['animeflv', 'jkanime', 'animeav1'],
          priority: 3,
        },
        kdrama: {
          enabled: true,
          scrapers: ['doramasflix'],
          priority: 4,
        },
        iptv: {
          enabled: true,
          type: 'custom',
          priority: 5,
        },
        sports: {
          enabled: true,
          sources: ['tvtvhd'],
          realtime: true,
          priority: 1,
        },
        music: {
          enabled: true,
          priority: 6,
        },
      },
      experimental: {
        autoResolver: true,
        healthCheck: true,
        smartCache: true,
      },
    };

    res.json({
      success: true,
      data: features,
    });
  } catch (error) {
    console.error('[OTA] Error en /app/features:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo características',
    });
  }
});

/**
 * GET /config/sources
 * Configuración de fuentes (scrapers, M3U, etc.)
 */
router.get('/sources', (req, res) => {
  try {
    const sources = {
      m3u: {
        enabled: true,
        updateInterval: '30min',
        sources: [
          'iptv-org-latam',
          'iptv-org-co',
          'iptv-org-ar',
          'iptv-org-cl',
          'iptv-org-es',
          'iptv-org-sports',
        ],
      },
      scrapers: {
        tvtvhd: {
          enabled: true,
          features: ['channels', 'events'],
          updateInterval: '30min',
        },
        cuevana: {
          enabled: true,
          type: 'movies',
        },
        pelisplus: {
          enabled: true,
          type: 'movies',
        },
        animeflv: {
          enabled: true,
          type: 'anime',
        },
        doramasflix: {
          enabled: true,
          type: 'kdrama',
        },
      },
      aggregation: {
        enabled: true,
        autoUpdate: true,
        healthCheck: true,
      },
    };

    res.json({
      success: true,
      data: sources,
    });
  } catch (error) {
    console.error('[OTA] Error en /config/sources:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo configuración de fuentes',
    });
  }
});

/**
 * GET /config/filters
 * Configuración de filtros LATAM
 */
router.get('/filters', (req, res) => {
  try {
    const filters = {
      regions: {
        enabled: ['latam', 'mexico', 'colombia', 'argentina', 'peru', 'chile', 'venezuela', 'ecuador', 'uruguay', 'españa'],
        excluded: ['asia', 'middle-east', 'europe-non-spanish'],
      },
      languages: {
        preferred: ['español', 'spanish', 'es'],
        excluded: ['english', 'portuguese', 'french', 'german'],
      },
      categories: {
        sports: true,
        entertainment: true,
        news: true,
        other: true,
      },
    };

    res.json({
      success: true,
      data: filters,
    });
  } catch (error) {
    console.error('[OTA] Error en /config/filters:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo filtros',
    });
  }
});

/**
 * GET /app/status
 * Estado del sistema
 */
router.get('/status', (req, res) => {
  try {
    const stats = aggregator.getStats();

    const status = {
      online: true,
      version: APP_VERSION,
      uptime: process.uptime(),
      aggregator: {
        initialized: aggregator.isInitialized,
        updating: aggregator.updateInProgress,
        lastUpdate: aggregator.lastUpdate,
        stats: stats,
      },
    };

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[OTA] Error en /app/status:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estado',
    });
  }
});

export default router;
