/**
 * routes/tv.js
 * API para la nueva sección TV con contenido agregado
 */

import express from 'express';
import aggregator from '../core/aggregator.js';
import { resolveChannel, getBestStream } from '../core/resolver.js';
import { checkStreamHealth } from '../core/healthCheck.js';

const router = express.Router();

/**
 * GET /api/tv/channels
 * Obtener todos los canales agregados de todas las fuentes
 */
router.get('/channels', async (req, res) => {
  try {
    const channels = await aggregator.getAllChannels();

    res.json({
      success: true,
      count: channels.length,
      data: channels,
      cache: '30min',
    });
  } catch (error) {
    console.error('[API TV] Error obteniendo canales:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo canales de TV',
    });
  }
});

/**
 * GET /api/tv/channels/category/:category
 * Obtener canales por categoría (sports, entertainment, news, other)
 */
router.get('/channels/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const channels = await aggregator.getChannelsByCategory(category);

    res.json({
      success: true,
      category,
      count: channels.length,
      data: channels,
    });
  } catch (error) {
    console.error('[API TV] Error obteniendo canales por categoría:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo canales',
    });
  }
});

/**
 * GET /api/tv/channels/country/:country
 * Obtener canales por país
 */
router.get('/channels/country/:country', async (req, res) => {
  try {
    const { country } = req.params;
    const channels = await aggregator.getChannelsByCountry(country);

    res.json({
      success: true,
      country,
      count: channels.length,
      data: channels,
    });
  } catch (error) {
    console.error('[API TV] Error obteniendo canales por país:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo canales',
    });
  }
});

/**
 * GET /api/tv/resolve/:channelName
 * Resolver stream para un canal específico
 */
router.get('/resolve/:channelName', async (req, res) => {
  try {
    const { channelName } = req.params;
    const streams = await resolveChannel(channelName);

    res.json({
      success: true,
      channel: channelName,
      count: streams.length,
      data: streams,
    });
  } catch (error) {
    console.error('[API TV] Error resolviendo canal:', error);
    res.status(500).json({
      success: false,
      error: 'Error resolviendo canal',
    });
  }
});

/**
 * GET /api/tv/best/:channelName
 * Obtener el mejor stream validado para un canal
 */
router.get('/best/:channelName', async (req, res) => {
  try {
    const { channelName } = req.params;
    const stream = await getBestStream(channelName);

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: `No se encontró stream para: ${channelName}`,
      });
    }

    res.json({
      success: true,
      channel: channelName,
      data: stream,
    });
  } catch (error) {
    console.error('[API TV] Error obteniendo mejor stream:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo stream',
    });
  }
});

/**
 * POST /api/tv/refresh
 * Forzar actualización de contenido
 */
router.post('/refresh', async (req, res) => {
  try {
    await aggregator.forceUpdate();

    res.json({
      success: true,
      message: 'Contenido actualizado exitosamente',
      stats: aggregator.getStats(),
    });
  } catch (error) {
    console.error('[API TV] Error actualizando contenido:', error);
    res.status(500).json({
      success: false,
      error: 'Error actualizando contenido',
    });
  }
});

/**
 * GET /api/tv/stats
 * Obtener estadísticas del agregador
 */
router.get('/stats', (req, res) => {
  try {
    const stats = aggregator.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[API TV] Error obteniendo stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas',
    });
  }
});

export default router;
