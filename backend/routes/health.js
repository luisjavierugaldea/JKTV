/**
 * routes/health.js
 * Endpoint de health check — útil para verificar que el servidor está vivo
 * y para monitoreo de uptime.
 *
 * GET /api/health
 */

import { Router } from 'express';
import { config } from '../config/env.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      tmdb: config.tmdb.apiKey ? 'configured' : 'missing_key',
      supabase: config.supabase.url ? 'configured' : 'not_configured',
    },
  });
});

export default router;
