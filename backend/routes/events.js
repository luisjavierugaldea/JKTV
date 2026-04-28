/**
 * routes/events.js — API de eventos deportivos con Playwright
 * 
 * Endpoints:
 * - GET /api/events → Lista todos los eventos (cache 3 min)
 * - GET /api/events/:id → Obtiene un evento específico
 * - POST /api/events/refresh → Limpia cache y fuerza actualización
 */

import express from 'express';
import { getEvents, getEventById, clearEventsCache } from '../scrapers/eventsManager.js';

const router = express.Router();

// ── GET /api/events → Obtener todos los eventos ──────────────────────────────
router.get('/', async (req, res, next) => {
    try {
        const events = await getEvents();
        res.json({
            success: true,
            count: events.length,
            cache: '3min',
            data: events
        });
    } catch (error) {
        console.error('[Events API] Error al obtener eventos:', error);
        next(error);
    }
});

// ── GET /api/events/:id → Obtener un evento específico ───────────────────────
router.get('/:id', async (req, res, next) => {
    try {
        const event = await getEventById(req.params.id);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Evento no encontrado'
            });
        }
        res.json({
            success: true,
            data: event
        });
    } catch (error) {
        console.error('[Events API] Error al obtener evento:', error);
        next(error);
    }
});

// ── POST /api/events/refresh → Forzar actualización del cache ─────────────────
router.post('/refresh', async (req, res, next) => {
    try {
        clearEventsCache();
        const events = await getEvents();
        res.json({
            success: true,
            message: 'Cache actualizado',
            count: events.length,
            data: events
        });
    } catch (error) {
        console.error('[Events API] Error al refrescar eventos:', error);
        next(error);
    }
});

// ── GET /api/events/extract-stream → Extrae URL real del stream ───────────────
router.get('/extract-stream', async (req, res, next) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'Falta el parámetro url'
            });
        }

        console.log(`[Events API] Extrayendo stream de: ${url}`);
        const streamUrl = await extractStreamUrl(url);
        
        if (!streamUrl) {
            return res.status(404).json({
                success: false,
                message: 'No se pudo extraer la URL del stream'
            });
        }

        res.json({
            success: true,
            url: streamUrl
        });
    } catch (error) {
        console.error('[Events API] Error al extraer stream:', error);
        next(error);
    }
});

export default router;
