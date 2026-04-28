/**
 * tvtvScraper.js — Scraper optimizado de eventos deportivos
 * 
 * Extrae la cartelera diaria de https://tvtvhd.com/eventos/
 * Decodifica URLs ofuscadas en Base64 y evade bloqueos 403
 * 
 * Dependencias: npm install axios cheerio
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// Cache en memoria (5 minutos)
let cachedEvents = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Genera headers de navegador real para evitar 403
 */
function getBrowserHeaders(referer = 'https://tvtvhd.com/') {
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': referer,
        'Origin': 'https://tvtvhd.com',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Cache-Control': 'max-age=0'
    };
}

/**
 * Decodifica URL Base64 ofuscada
 */
function decodeBase64Url(encodedUrl) {
    try {
        if (!encodedUrl) return null;
        
        // Limpiar espacios y caracteres extra
        const cleaned = encodedUrl.trim();
        
        // Detectar si ya es Base64
        if (/^[A-Za-z0-9+/]+=*$/.test(cleaned)) {
            const decoded = Buffer.from(cleaned, 'base64').toString('utf-8');
            
            // Construir URL absoluta si es necesario
            if (decoded.startsWith('http')) {
                return decoded;
            } else if (decoded.startsWith('/')) {
                return `https://tvtvhd.com${decoded}`;
            } else {
                return `https://tvtvhd.com/${decoded}`;
            }
        }
        
        return encodedUrl.startsWith('http') ? encodedUrl : `https://tvtvhd.com${encodedUrl}`;
    } catch (error) {
        console.error('[Scraper] Error decodificando Base64:', error.message);
        return null;
    }
}

/**
 * Asigna logo emoji según la liga/deporte
 */
function getLogoForLeague(liga) {
    if (!liga) return '⚽';
    
    const ligaLower = liga.toLowerCase();
    
    if (ligaLower.includes('futbol') || ligaLower.includes('soccer') || 
        ligaLower.includes('liga') || ligaLower.includes('premier') ||
        ligaLower.includes('laliga') || ligaLower.includes('champions') ||
        ligaLower.includes('libertadores') || ligaLower.includes('sudamericana')) {
        return '⚽';
    }
    if (ligaLower.includes('nba') || ligaLower.includes('basket')) return '🏀';
    if (ligaLower.includes('nfl') || ligaLower.includes('super bowl')) return '🏈';
    if (ligaLower.includes('nhl') || ligaLower.includes('hockey')) return '🏒';
    if (ligaLower.includes('mlb') || ligaLower.includes('baseball')) return '⚾';
    if (ligaLower.includes('f1') || ligaLower.includes('formula')) return '🏎️';
    if (ligaLower.includes('tenis') || ligaLower.includes('tennis')) return '🎾';
    if (ligaLower.includes('box') || ligaLower.includes('ufc') || ligaLower.includes('mma')) return '🥊';
    if (ligaLower.includes('voleibol') || ligaLower.includes('volleyball')) return '🏐';
    if (ligaLower.includes('rugby')) return '🏉';
    
    return '⚽'; // Default
}

/**
 * Scraper principal: Extrae eventos de tvtvhd.com
 */
export async function scrapeEvents() {
    // Verificar cache
    const now = Date.now();
    if (cachedEvents && (now - cacheTimestamp) < CACHE_TTL) {
        console.log('[tvtvScraper] 📦 Sirviendo desde cache');
        return cachedEvents;
    }

    try {
        console.log('[tvtvScraper] 🔄 Scrapeando https://tvtvhd.com/eventos/...');

        // Petición con headers de navegador real
        const response = await axios.get('https://tvtvhd.com/eventos/', {
            headers: getBrowserHeaders(),
            timeout: 15000,
            maxRedirects: 5
        });

        const html = response.data;
        const $ = cheerio.load(html);

        const events = [];

        // Selectores comunes en sitios de streaming deportivo
        const selectors = [
            '.card-partido',         // Selector genérico
            '.evento',               // Selector genérico
            '.match-card',           // Selector de partidos
            '.event-item',           // Selector de eventos
            'article',               // HTML5 semantic
            '.card',                 // Bootstrap cards
            '[class*="event"]',      // Cualquier clase con "event"
            '[class*="partido"]',    // Cualquier clase con "partido"
            '[class*="match"]'       // Cualquier clase con "match"
        ];

        let $events = $();
        for (const selector of selectors) {
            $events = $(selector);
            if ($events.length > 0) {
                console.log(`[tvtvScraper] ✅ Encontrados ${$events.length} eventos con selector: ${selector}`);
                break;
            }
        }

        // Si no encontramos contenedores estructurados, parsear el body como texto
        if ($events.length === 0) {
            console.log('[tvtvScraper] ⚠️ No se encontraron selectores estructurados, intentando parseo de texto...');
            return parseEventsFromText($);
        }

        // Iterar sobre cada evento encontrado
        $events.each((index, element) => {
            const $event = $(element);

            // Extraer información del evento
            const titulo = $event.find('h3, h4, .titulo, .title, .match-title, [class*="title"]').first().text().trim() ||
                          $event.find('.team, .equipo').map((i, el) => $(el).text().trim()).get().join(' vs ') ||
                          $event.text().trim().split('\n')[0];

            const hora = $event.find('.hora, .time, [class*="time"], [class*="hora"]').first().text().trim() ||
                        $event.text().match(/\d{1,2}:\d{2}/)?.[0] || '';

            const liga = $event.find('.liga, .league, .competition, [class*="liga"], [class*="league"]').first().text().trim() ||
                        'Deportes';

            // Extraer canales con URLs potencialmente ofuscadas
            const canales = [];
            $event.find('a, button, .btn, [data-url], [data-stream]').each((i, btn) => {
                const $btn = $(btn);
                
                // Intentar múltiples atributos donde puede estar la URL
                let url = $btn.attr('data-url') || 
                         $btn.attr('data-stream') || 
                         $btn.attr('data-src') ||
                         $btn.attr('href') || 
                         $btn.data('url') ||
                         $btn.data('stream');

                // Nombre del canal
                const nombre = $btn.text().trim() || 
                              $btn.attr('title') || 
                              $btn.attr('alt') ||
                              `Canal ${i + 1}`;

                if (url && nombre && !nombre.toLowerCase().includes('ver')) {
                    // Decodificar si es Base64
                    const decodedUrl = decodeBase64Url(url);
                    
                    if (decodedUrl) {
                        canales.push({
                            nombre: nombre,
                            url: decodedUrl,
                            calidad: 'HD',
                            idioma: 'ES'
                        });
                    }
                }
            });

            // Si no encontramos canales en botones, agregar canales genéricos
            if (canales.length === 0) {
                const defaultChannels = [
                    { nombre: 'ESPN', url: 'https://tvtvhd.com/vivo/canales.php?stream=espn', calidad: 'HD', idioma: 'ES' },
                    { nombre: 'ESPN 2', url: 'https://tvtvhd.com/vivo/canales.php?stream=espn2', calidad: 'HD', idioma: 'ES' },
                    { nombre: 'ESPN 3', url: 'https://tvtvhd.com/vivo/canales.php?stream=espn3', calidad: 'HD', idioma: 'ES' },
                    { nombre: 'Fox Sports', url: 'https://tvtvhd.com/vivo/canales.php?stream=foxsports', calidad: 'HD', idioma: 'ES' },
                    { nombre: 'Fox Sports 2', url: 'https://tvtvhd.com/vivo/canales.php?stream=foxsports2', calidad: 'HD', idioma: 'ES' },
                    { nombre: 'Win Sports', url: 'https://tvtvhd.com/vivo/canales.php?stream=winsports', calidad: 'HD', idioma: 'ES' },
                    { nombre: 'DSports', url: 'https://tvtvhd.com/vivo/canales.php?stream=dsports', calidad: 'HD', idioma: 'ES' },
                    { nombre: 'TNT Sports', url: 'https://tvtvhd.com/vivo/canales.php?stream=tntsports', calidad: 'HD', idioma: 'ES' }
                ];
                canales.push(...defaultChannels);
            }

            if (titulo && canales.length > 0) {
                events.push({
                    id: `event-${Date.now()}-${index}`,
                    titulo,
                    hora,
                    liga,
                    logo: getLogoForLeague(liga),
                    canales
                });
            }
        });

        // Guardar en cache
        cachedEvents = events;
        cacheTimestamp = now;

        console.log(`[tvtvScraper] ✅ ${events.length} eventos extraídos exitosamente`);
        return events;

    } catch (error) {
        console.error('[tvtvScraper] ❌ Error:', error.message);
        
        // Si hay error pero tenemos cache antigua, devolverla
        if (cachedEvents) {
            console.log('[tvtvScraper] ⚠️ Devolviendo cache antigua');
            return cachedEvents;
        }

        return [];
    }
}

/**
 * Parseo alternativo cuando no hay selectores estructurados
 */
function parseEventsFromText($) {
    const events = [];
    const bodyText = $('body').text();
    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);

    let currentEvent = null;
    const timeRegex = /^\d{1,2}:\d{2}/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detectar hora
        if (timeRegex.test(line)) {
            if (currentEvent && currentEvent.titulo) {
                events.push(currentEvent);
            }
            currentEvent = {
                id: `event-${Date.now()}-${i}`,
                hora: line,
                titulo: '',
                liga: 'Deportes',
                logo: '⚽',
                canales: []
            };
        }
        // Detectar partido (contiene "vs")
        else if (currentEvent && line.toLowerCase().includes(' vs ')) {
            currentEvent.titulo = line;
        }
        // Detectar liga
        else if (currentEvent && line.includes(':') && !line.toLowerCase().includes(' vs ')) {
            currentEvent.liga = line.split(':')[0].trim();
            currentEvent.logo = getLogoForLeague(currentEvent.liga);
        }
    }

    // Agregar último evento
    if (currentEvent && currentEvent.titulo) {
        events.push(currentEvent);
    }

    // Agregar canales genéricos a todos
    events.forEach(event => {
        if (event.canales.length === 0) {
            event.canales = [
                { nombre: 'ESPN', url: 'https://tvtvhd.com/vivo/canales.php?stream=espn', calidad: 'HD', idioma: 'ES' },
                { nombre: 'ESPN 2', url: 'https://tvtvhd.com/vivo/canales.php?stream=espn2', calidad: 'HD', idioma: 'ES' },
                { nombre: 'Fox Sports', url: 'https://tvtvhd.com/vivo/canales.php?stream=foxsports', calidad: 'HD', idioma: 'ES' },
                { nombre: 'DSports', url: 'https://tvtvhd.com/vivo/canales.php?stream=dsports', calidad: 'HD', idioma: 'ES' }
            ];
        }
    });

    return events;
}

/**
 * Limpiar cache manualmente
 */
export function clearCache() {
    cachedEvents = null;
    cacheTimestamp = 0;
    console.log('[tvtvScraper] 🧹 Cache limpiado');
}

/**
 * Obtener evento por ID
 */
export async function getEventById(eventId) {
    const events = await scrapeEvents();
    return events.find(e => e.id === eventId) || null;
}
