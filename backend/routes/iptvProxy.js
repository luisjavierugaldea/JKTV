import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { reportDeadChannel } from '../scrapers/iptvManager.js';

const router = express.Router();

// ── URL Registry ──────────────────────────────────────────────────────────────
// Guarda URLs largas → IDs cortos para evitar el error 414 (URI Too Long)
// Los IDs duran 4 horas y luego se limpian automáticamente
const urlRegistry = new Map(); // id → { url, channelId, createdAt }

function storeUrl(url, channelId) {
    // Usar hash SHA-1 de la URL como ID corto (10 caracteres)
    const id = crypto.createHash('sha1').update(url).digest('hex').substring(0, 10);
    if (!urlRegistry.has(id)) {
        urlRegistry.set(id, { url, channelId, createdAt: Date.now() });
    }
    return id;
}

// Limpiar entradas viejas cada hora
setInterval(() => {
    const now = Date.now();
    const TTL = 4 * 60 * 60 * 1000; // 4 horas
    let cleaned = 0;
    for (const [id, entry] of urlRegistry.entries()) {
        if (now - entry.createdAt > TTL) {
            urlRegistry.delete(id);
            cleaned++;
        }
    }
    if (cleaned > 0) console.log(`[IPTV Proxy] 🧹 Registry limpiado: ${cleaned} URLs viejas borradas.`);
}, 60 * 60 * 1000);

// ── Headers según el tipo de proveedor ───────────────────────────────────────
function getHeaders(targetUrl) {
    // Samsung TV Plus / jmp2.uk → Simular Tizen TV
    if (targetUrl.includes('jmp2.uk') || targetUrl.includes('samsung')) {
        return {
            'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebkit/538.1 (KHTML, like Gecko) Version/6.5 TV Safari/538.1',
            'Accept': '*/*',
            'Accept-Language': 'es-ES,es;q=0.9',
            'Referer': 'https://www.samsungtvplus.com/',
            'Origin': 'https://www.samsungtvplus.com',
            'Connection': 'keep-alive',
        };
    }
    // Pluto TV → Simular Roku/Smart TV
    if (targetUrl.includes('pluto.tv') || targetUrl.includes('plutotv')) {
        return {
            'User-Agent': 'Pluto TV/4.0 (Linux; Android 11; SHIELD Android TV Build/RQ1A.210105.003)',
            'Accept': 'application/x-mpegURL, application/vnd.apple.mpegurl, */*',
            'Accept-Language': 'es-ES,es;q=0.9',
            'Connection': 'keep-alive',
        };
    }
    // Default → Simular Android genérico (para Diablo, Zeus, FlexLive, etc.)
    return {
        'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 11; M2012K11AG Build/RKQ1.201112.002)',
        'Accept': '*/*',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Connection': 'keep-alive',
    };
}

// ── Ruta: Proxy usando ID corto (segmentos .ts) ───────────────────────────────
// GET /api/iptv-proxy/s/:id
router.get('/s/:id', async (req, res) => {
    const entry = urlRegistry.get(req.params.id);
    if (!entry) {
        return res.status(404).send('URL no encontrada o expirada. Recarga el canal.');
    }
    await proxyUrl(entry.url, entry.channelId, req, res);
});

// ── Ruta: Proxy usando URL en Base64 (enlace inicial del canal) ───────────────
// GET /api/iptv-proxy/stream?url=BASE64&channelId=ID
router.get('/stream', async (req, res) => {
    const { url, channelId } = req.query;
    if (!url) return res.status(400).send('Falta el parámetro URL');

    let decodedUrl;
    try {
        decodedUrl = Buffer.from(url, 'base64').toString('utf-8');
    } catch (e) {
        decodedUrl = url;
    }

    await proxyUrl(decodedUrl, channelId, req, res);
});

// ── Función principal de proxy ────────────────────────────────────────────────
async function proxyUrl(targetUrl, channelId, req, res) {
    try {
        const response = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'stream',
            timeout: 25000,
            maxRedirects: 5,
            headers: {
                ...getHeaders(targetUrl),
                'X-Forwarded-For': req.ip,
            }
        });

        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

        const contentType = response.headers['content-type'] || '';
        const isPlaylist = contentType.includes('mpegurl') ||
                           contentType.includes('apple.mpegurl') ||
                           targetUrl.includes('.m3u8') ||
                           targetUrl.includes('.m3u');

        if (isPlaylist) {
            // Reescribir el M3U8 usando IDs cortos en lugar de Base64
            let body = '';
            response.data.on('data', chunk => body += chunk);
            response.data.on('end', () => {
                const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

                const lines = body.split('\n').map(line => {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) return line;

                    let absoluteUrl = trimmed;
                    if (!trimmed.startsWith('http')) {
                        absoluteUrl = baseUrl + trimmed;
                    }

                    // Guardar en el registry y usar ID corto
                    const id = storeUrl(absoluteUrl, channelId);
                    return `${req.protocol}://${req.get('host')}/api/iptv-proxy/s/${id}`;
                });

                res.send(lines.join('\n'));
            });
        } else {
            response.data.pipe(res);
        }

        response.data.on('error', (err) => {
            console.error('[IPTV Proxy] Error en el stream:', err.message);
            if (!res.headersSent) res.status(500).send('Error en la transmisión');
        });

    } catch (error) {
        const status = error.response?.status;
        console.error(`[IPTV Proxy] ❌ Error ${status || '???'}: ${targetUrl.substring(0, 60)}...`);

        // AUTO-LIMPIEZA: Solo baneamos 404 (canal no existe)
        // 403/503 NO se banean → pueden ser PPV sin evento activo
        if ((status === 404 || status === 410) && channelId) {
            console.log(`[IPTV Proxy] 🧹 Canal inexistente (${status}): ${channelId}`);
            reportDeadChannel(channelId, targetUrl);
        }

        if (!res.headersSent) {
            res.status(status || 500).send('No se pudo conectar con el stream');
        }
    }
}

export default router;
