/**
 * channels.js — Rutas API para canales de TV por países
 * 
 * Endpoints:
 * - GET /api/channels - Obtener todos los canales organizados por países
 * - GET /api/channels/:countryId - Obtener canales de un país específico
 * - POST /api/channels/refresh - Forzar actualización del cache
 */

import express from 'express';
import { getChannelsByCountry, clearChannelsCache } from '../scrapers/tvtvChannels.js';

const router = express.Router();

/**
 * GET /api/channels
 * Obtiene todos los canales organizados por países
 */
router.get('/', async (req, res) => {
    try {
        const channels = await getChannelsByCountry();
        
        // Calcular total de canales
        const totalChannels = channels.reduce((sum, country) => sum + country.totalCanales, 0);
        
        res.json({
            success: true,
            count: channels.length,
            totalChannels,
            cache: '30min',
            data: channels
        });
    } catch (error) {
        console.error('[API Channels] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener canales'
        });
    }
});

/**
 * GET /api/channels/:countryId
 * Obtiene canales de un país específico
 */
router.get('/:countryId', async (req, res) => {
    try {
        const channels = await getChannelsByCountry();
        const country = channels.find(c => c.id === req.params.countryId);
        
        if (!country) {
            return res.status(404).json({
                success: false,
                error: 'País no encontrado'
            });
        }
        
        res.json({
            success: true,
            data: country
        });
    } catch (error) {
        console.error('[API Channels] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener país'
        });
    }
});

/**
 * POST /api/channels/refresh
 * Fuerza actualización del cache de canales
 */
router.post('/refresh', async (req, res) => {
    try {
        clearChannelsCache();
        const channels = await getChannelsByCountry();
        
        res.json({
            success: true,
            message: 'Cache actualizado',
            count: channels.length
        });
    } catch (error) {
        console.error('[API Channels] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar cache'
        });
    }
});

export default router;
