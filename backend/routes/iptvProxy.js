import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { reportDeadChannel } from '../scrapers/iptvManager.js';
import { createContext } from '../scrapers/browserPool.js';

const router = express.Router();

// ── Extractor de streams desde páginas HTML ───────────────────────────────────
async function extractStreamFromPage(pageUrl) {
    let context = null;
    let page = null;

    try {
        context = await createContext();
        page = await context.newPage();

        // Interceptar peticiones de red para capturar URLs .m3u8
        const m3u8Urls = [];
        page.on('request', (request) => {
            const url = request.url();
            if (url.includes('.m3u8') || url.includes('playlist')) {
                m3u8Urls.push(url);
            }
        });

        // Navegar a la página
        await page.goto(pageUrl, {
            waitUntil: 'networkidle0',
            timeout: 15000
        });

        // Esperar un poco para que cargue el reproductor
        await page.waitForTimeout(3000);

        // Buscar URLs en el DOM
        const extractedUrls = await page.evaluate(() => {
            const urls = [];

            // Buscar en iframes
            document.querySelectorAll('iframe').forEach(iframe => {
                if (iframe.src) urls.push(iframe.src);
            });

            // Buscar en scripts
            document.querySelectorAll('script').forEach(script => {
                const content = script.textContent || '';
                const matches = content.match(/(https?:\/\/[^\s'"]+\.m3u8[^\s'"]*)/gi);
                if (matches) urls.push(...matches);
            });

            // Buscar en atributos data-*
            document.querySelectorAll('[data-src], [data-stream], [data-url]').forEach(el => {
                const dataSrc = el.getAttribute('data-src') || 
                               el.getAttribute('data-stream') || 
                               el.getAttribute('data-url');
                if (dataSrc) urls.push(dataSrc);
            });

            return urls;
        });

        await page.close();
        await context.close();

        // Combinar URLs y filtrar
        const allUrls = [...new Set([...m3u8Urls, ...extractedUrls])];
        const validUrls = allUrls.filter(url => {
            return url.includes('.m3u8') && url.startsWith('http');
        });

        return validUrls[0] || null;

    } catch (error) {
        console.error('[IPTV Proxy] Error extrayendo stream:', error.message);
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        return null;
    }
}

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
    // 🏆 CRÍTICO: Dominios deportivos piratas → INYECTAR headers Referer y Origin
    // Sin estos headers, el CDN devuelve 403 Forbidden
    const sportsDomainsPattern = [
        'tvtvhd.com',
        'fubohd.com', 
        'rojadirectatv.online',
        'rojadirecta.me',
        'sportshd.me',
        'pirlotv',
        'futbollibre',
        'librefutbol',
        'librestream',
        'sportsonline',
        'vercanalestv',
        'elnacional.com',
        'latele.tv'
    ];
    
    // Detectar si el dominio es de deportes piratas
    const isSportsDomain = sportsDomainsPattern.some(domain => targetUrl.includes(domain));
    
    // También detectar CDNs comunes de streams piratas
    const isPirateStreamCDN = targetUrl.includes('.m3u8') && (
        targetUrl.includes('cdn') ||
        targetUrl.includes('stream') ||
        targetUrl.includes('live') ||
        targetUrl.includes('hls') ||
        targetUrl.includes('.lat') ||
        targetUrl.includes('.online') ||
        targetUrl.includes('.me')
    );
    
    if (isSportsDomain || isPirateStreamCDN) {
        console.log('[IPTV Proxy] 🔒 Inyectando headers anti-403 para:', targetUrl.substring(0, 50) + '...');
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://tvtvhd.com/',
            'Origin': 'https://tvtvhd.com',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };
    }
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
        // 🔍 Detectar si es una página HTML de canales (tvtvhd.com/canales.php)
        if (targetUrl.includes('canales.php') || targetUrl.includes('/vivo/')) {
            console.log('[IPTV Proxy] 🔍 Detectada página HTML, extrayendo stream...');
            const extractedUrl = await extractStreamFromPage(targetUrl);
            
            if (extractedUrl) {
                console.log('[IPTV Proxy] ✅ Stream extraído:', extractedUrl);
                targetUrl = extractedUrl; // Usar la URL extraída
            } else {
                console.log('[IPTV Proxy] ⚠️ No se pudo extraer stream, intentando con URL original');
            }
        }

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
