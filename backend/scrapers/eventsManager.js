/**
 * eventsManager.js — Gestor de eventos deportivos en vivo
 * 
 * Scrapea la página de eventos de tvtvhd.com para obtener la agenda deportiva.
 * Extrae eventos con sus canales disponibles para cada partido.
 * 
 * Proveedor: tvtvhd.com/eventos/
 * Última actualización: 2026-04-27
 */

import { createContext } from './browserPool.js';

// Cache de eventos (TTL: 3 minutos para eventos en vivo)
let cachedEvents = null;
let cacheTimestamp = 0;
const CACHE_TTL = 3 * 60 * 1000; // 3 minutos

/**
 * Obtiene y procesa los eventos deportivos desde tvtvhd.com
 * @returns {Promise<Array>} Array de eventos procesados
 */
export async function getEvents() {
    // Verificar cache
    const now = Date.now();
    if (cachedEvents && (now - cacheTimestamp) < CACHE_TTL) {
        console.log('[Events] 📦 Sirviendo desde cache');
        return cachedEvents;
    }

    let context = null;
    let page = null;

    try {
        console.log('[Events] 🔄 Scrapeando eventos deportivos de tvtvhd.com...');
        
        context = await createContext();
        page = await context.newPage();
        
        // Navegar a la página de eventos
        await page.goto('https://tvtvhd.com/eventos/', {
            waitUntil: 'domcontentloaded',
            timeout: 20000
        });

        // Esperar a que cargue el contenido
        await page.waitForSelector('.toggle-submenu, li', { timeout: 10000 }).catch(() => {
            console.log('[Events] No se encontró selector específico, intentando extracción genérica...');
        });

        // Extraer eventos CON sus canales específicos desde el submenu oculto
        const events = await page.evaluate(() => {
            const results = [];
            
            // Buscar todos los elementos de eventos (li.toggle-submenu)
            const eventElements = document.querySelectorAll('li.toggle-submenu');
            
            eventElements.forEach((eventEl) => {
                try {
                    // Extraer hora
                    const timeEl = eventEl.querySelector('time[datetime]');
                    const hora = timeEl ? timeEl.textContent.trim() : '';
                    
                    // Extraer título del evento
                    const titleEl = eventEl.querySelector('span[style*="flex: 1"]');
                    const fullTitle = titleEl ? titleEl.textContent.trim() : '';
                    
                    // Separar liga y título (formato: "LIGA: Equipo vs Equipo")
                    let liga = '';
                    let titulo = fullTitle;
                    const titleParts = fullTitle.split(':');
                    if (titleParts.length >= 2) {
                        liga = titleParts[0].trim();
                        titulo = titleParts.slice(1).join(':').trim();
                    }
                    
                    // Extraer canales del submenu (están ocultos con display:none)
                    const canales = [];
                    const submenuLinks = eventEl.querySelectorAll('a.submenu-item');
                    
                    submenuLinks.forEach((link) => {
                        const channelName = link.querySelector('span');
                        const href = link.getAttribute('href');
                        
                        if (channelName && href) {
                            // Extraer el parámetro r (base64) de la URL
                            const urlMatch = href.match(/[?&]r=([^&]+)/);
                            if (urlMatch) {
                                const base64Url = urlMatch[1];
                                // Decodificar base64 para obtener la URL real
                                try {
                                    const decodedUrl = atob(base64Url);
                                    canales.push({
                                        nombre: channelName.textContent.trim(),
                                        url: decodedUrl,
                                        calidad: 'HD',
                                        idioma: 'ES'
                                    });
                                } catch (e) {
                                    // Si falla la decodificación, usar URL con embed
                                    canales.push({
                                        nombre: channelName.textContent.trim(),
                                        url: `https://tvtvhd.com${href}`,
                                        calidad: 'HD',
                                        idioma: 'ES'
                                    });
                                }
                            }
                        }
                    });
                    
                    // Solo agregar eventos que tengan todos los datos
                    if (hora && titulo && canales.length > 0) {
                        results.push({
                            hora,
                            titulo,
                            liga,
                            canales
                        });
                    }
                } catch (err) {
                    console.error('[Events] Error procesando evento:', err);
                }
            });
            
            return results;
        });

        // Procesar y limpiar eventos
        const processedEvents = events
            .filter(event => event.titulo && event.titulo.length > 3)
            .map((event, index) => {
                // Determinar logo según la liga
                let logo = '⚽'; // Por defecto fútbol
                const ligaLower = (event.liga || '').toLowerCase();
                const tituloLower = event.titulo.toLowerCase();
                
                if (ligaLower.includes('nba') || tituloLower.includes('nba') || ligaLower.includes('basket')) logo = '🏀';
                else if (ligaLower.includes('nfl') || tituloLower.includes('nfl') || ligaLower.includes('super bowl')) logo = '🏈';
                else if (ligaLower.includes('nhl') || tituloLower.includes('nhl') || ligaLower.includes('hockey')) logo = '🏒';
                else if (ligaLower.includes('mlb') || tituloLower.includes('mlb') || ligaLower.includes('baseball')) logo = '⚾';
                else if (ligaLower.includes('f1') || tituloLower.includes('f1') || ligaLower.includes('formula')) logo = '🏎️';
                else if (ligaLower.includes('tenis') || tituloLower.includes('tenis') || ligaLower.includes('tennis')) logo = '🎾';
                else if (ligaLower.includes('box') || tituloLower.includes('box') || ligaLower.includes('ufc')) logo = '🥊';
                
                // Los canales ya vienen del scraping, no necesitamos agregar genéricos
                const canales = event.canales || [];
                
                return {
                    id: `event-${Date.now()}-${index}`,
                    titulo: event.titulo,
                    hora: event.hora || '',
                    liga: event.liga || 'Deportes',
                    logo,
                    canales,
                    hasChannels: canales.length > 0
                };
            });

        await page.close();
        await context.close();

        // Guardar en cache
        cachedEvents = processedEvents;
        cacheTimestamp = now;

        // Contar canales únicos
        const uniqueChannels = new Set();
        processedEvents.forEach(event => {
            event.canales.forEach(canal => uniqueChannels.add(canal.nombre));
        });

        console.log(`[Events] ✅ ${processedEvents.length} eventos scrapeados con ${uniqueChannels.size} canales únicos`);
        return processedEvents;

    } catch (error) {
        console.error('[Events] ❌ Error al scrapear eventos:', error.message);
        
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        
        // Si hay cache vieja, devolverla
        if (cachedEvents) {
            console.log('[Events] ⚠️ Devolviendo cache antigua por error');
            return cachedEvents;
        }

        // Si no hay cache, devolver array vacío
        return [];
    }
}

/**
 * Limpia el cache de eventos (útil para forzar actualización)
 */
export function clearEventsCache() {
    cachedEvents = null;
    cacheTimestamp = 0;
    console.log('[Events] 🧹 Cache limpiado');
}

/**
 * Obtiene un evento específico por ID
 * @param {string} eventId - ID del evento
 * @returns {Promise<Object|null>} Evento encontrado o null
 */
export async function getEventById(eventId) {
    const events = await getEvents();
    return events.find(e => e.id === eventId) || null;
}
