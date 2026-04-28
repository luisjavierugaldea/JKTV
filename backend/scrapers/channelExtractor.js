/**
 * channelExtractor.js — Extractor de URLs de stream reales
 * 
 * Scrapea las páginas de canales (canales.php) para extraer las URLs .m3u8 reales.
 * Proveedor: tvtvhd.com/vivo/canales.php
 */

import { createContext } from './browserPool.js';

// Cache de URLs extraídas (TTL: 1 hora, los streams cambian frecuentemente)
const urlCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

/**
 * Extrae la URL real del stream desde una página de canal
 * @param {string} pageUrl - URL de la página del canal (ej: canales.php?stream=espn)
 * @returns {Promise<string|null>} URL del stream .m3u8 o null si no se encuentra
 */
export async function extractStreamUrl(pageUrl) {
    // Verificar cache
    const cached = urlCache.get(pageUrl);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        console.log(`[ChannelExtractor] 📦 Cache hit: ${pageUrl}`);
        return cached.url;
    }

    let context = null;
    let page = null;

    try {
        console.log(`[ChannelExtractor] 🔍 Extrayendo stream de: ${pageUrl}`);
        
        context = await createContext();
        page = await context.newPage();

        // Interceptar peticiones de red para capturar URLs .m3u8
        const m3u8Urls = [];
        page.on('request', (request) => {
            const url = request.url();
            if (url.includes('.m3u8') || url.includes('playlist') || url.includes('stream')) {
                m3u8Urls.push(url);
                console.log(`[ChannelExtractor] 🎯 M3U8 detectado: ${url}`);
            }
        });

        // Navegar a la página del canal
        await page.goto(pageUrl, {
            waitUntil: 'networkidle2',
            timeout: 15000
        });

        // Esperar un poco más para que cargue el reproductor
        await page.waitForTimeout(2000);

        // Buscar URLs en el DOM (iframes, video tags, scripts)
        const extractedUrls = await page.evaluate(() => {
            const urls = [];

            // 1. Buscar en iframes
            document.querySelectorAll('iframe').forEach(iframe => {
                if (iframe.src && (iframe.src.includes('.m3u8') || iframe.src.includes('stream'))) {
                    urls.push(iframe.src);
                }
            });

            // 2. Buscar en video tags
            document.querySelectorAll('video source').forEach(source => {
                if (source.src && source.src.includes('.m3u8')) {
                    urls.push(source.src);
                }
            });

            // 3. Buscar en scripts (variables que contengan .m3u8)
            document.querySelectorAll('script').forEach(script => {
                const content = script.textContent || '';
                const m3u8Matches = content.match(/(https?:\/\/[^\s'"]+\.m3u8[^\s'"]*)/gi);
                if (m3u8Matches) {
                    urls.push(...m3u8Matches);
                }
            });

            // 4. Buscar atributos data-* y otras fuentes comunes
            document.querySelectorAll('[data-src], [data-stream], [data-url]').forEach(el => {
                const dataSrc = el.getAttribute('data-src') || el.getAttribute('data-stream') || el.getAttribute('data-url');
                if (dataSrc && dataSrc.includes('.m3u8')) {
                    urls.push(dataSrc);
                }
            });

            return urls;
        });

        // Combinar URLs de red y DOM
        const allUrls = [...new Set([...m3u8Urls, ...extractedUrls])];

        await page.close();
        await context.close();

        // Filtrar y seleccionar la mejor URL
        const validUrls = allUrls.filter(url => {
            return url.includes('.m3u8') && 
                   url.startsWith('http') &&
                   !url.includes('ads') &&
                   !url.includes('preroll');
        });

        if (validUrls.length === 0) {
            console.log(`[ChannelExtractor] ⚠️ No se encontró stream para: ${pageUrl}`);
            return null;
        }

        // Preferir URLs con mejor calidad (chunklist > playlist)
        const bestUrl = validUrls.find(u => u.includes('chunklist')) || 
                        validUrls.find(u => u.includes('playlist')) ||
                        validUrls[0];

        console.log(`[ChannelExtractor] ✅ Stream encontrado: ${bestUrl}`);

        // Guardar en cache
        urlCache.set(pageUrl, {
            url: bestUrl,
            timestamp: Date.now()
        });

        return bestUrl;

    } catch (error) {
        console.error(`[ChannelExtractor] ❌ Error al extraer stream de ${pageUrl}:`, error.message);
        
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        
        return null;
    }
}

/**
 * Limpia el cache de URLs
 */
export function clearUrlCache() {
    urlCache.clear();
    console.log('[ChannelExtractor] 🧹 Cache de URLs limpiado');
}

/**
 * Obtiene estadísticas del cache
 */
export function getCacheStats() {
    return {
        size: urlCache.size,
        entries: Array.from(urlCache.keys())
    };
}
