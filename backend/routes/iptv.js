import { Router } from 'express';
import { buildMasterPlaylist, fetchCustomPlaylist } from '../scrapers/iptvManager.js';

const router = Router();

// Caché en memoria
let cachedIptv = null;
let lastUpdate = null;

// Inicializa la caché en segundo plano
buildMasterPlaylist().then(data => {
    cachedIptv = data;
    lastUpdate = new Date();
});

// Actualiza la caché cada 24 horas (86400000 ms)
setInterval(() => {
    buildMasterPlaylist().then(data => {
        cachedIptv = data;
        lastUpdate = new Date();
    });
}, 86400000);

router.get('/channels', async (req, res) => {
    const { customUrl } = req.query;

    if (customUrl) {
        try {
            const customChannels = await fetchCustomPlaylist(customUrl);
            return res.json({
                success: true,
                data: customChannels,
                meta: {
                    lastUpdate: new Date(),
                    totalChannels: customChannels.length,
                    isCustom: true
                }
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: { message: 'Error procesando tu lista IPTV personalizada. Verifica la URL o tus credenciales.' }
            });
        }
    }

    if (!cachedIptv) {
        return res.status(503).json({ 
            success: false, 
            error: { message: 'Procesando canales públicos... Intenta de nuevo en unos segundos.' } 
        });
    }

    res.json({
        success: true,
        data: cachedIptv,
        meta: {
            lastUpdate,
            totalChannels: cachedIptv.length
        }
    });
});

export default router;
