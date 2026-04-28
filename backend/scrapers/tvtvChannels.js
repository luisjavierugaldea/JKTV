/**
 * tvtvChannels.js — Scraper de canales por países desde tvtvhd.com
 * 
 * Extrae la lista de canales organizados por países/regiones desde la página principal.
 * Cada país tiene sus canales deportivos específicos.
 * 
 * Fuente: https://tvtvhd.com/
 * Última actualización: 2026-04-27
 */

import { createContext } from './browserPool.js';

// Cache de canales (TTL: 30 minutos - los canales no cambian tan frecuentemente)
let cachedChannels = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

/**
 * Obtiene los canales organizados por países desde tvtvhd.com
 * @returns {Promise<Array>} Array de países con sus canales
 */
export async function getChannelsByCountry() {
    // Verificar cache
    const now = Date.now();
    if (cachedChannels && (now - cacheTimestamp) < CACHE_TTL) {
        console.log('[TV Channels] 📦 Sirviendo desde cache');
        return cachedChannels;
    }

    let context = null;
    let page = null;

    try {
        console.log('[TV Channels] 🔄 Scrapeando canales desde tvtvhd.com...');
        
        context = await createContext();
        page = await context.newPage();
        
        // Navegar a la página principal
        await page.goto('https://tvtvhd.com/', {
            waitUntil: 'domcontentloaded',
            timeout: 20000
        });

        // Esperar a que cargue el contenido
        await page.waitForTimeout(2000);

        // Extraer canales organizados por países desde tvtvhd.com
        const channelsByCountry = await page.evaluate(() => {
            const countries = [];
            
            // Buscar todas las secciones/acordeones con países
            // tvtvhd.com usa estructura: H3.item-game dentro de div.header-title
            // Los canales están en el hermano siguiente de header-title
            
            // Buscar H3 con clase item-game (son los headers de países)
            const possibleCountryHeaders = document.querySelectorAll('h3.item-game');
            
            const countryData = new Map();
            
            for (const header of possibleCountryHeaders) {
                const headerText = header.textContent?.trim() || '';
                
                // Detectar si es un encabezado de país
                const countryNames = [
                    'Argentina', 'Brasil', 'Colombia', 'Chile', 'Ecuador', 
                    'México', 'Perú', 'Uruguay', 'Venezuela', 'España',
                    'Estados Unidos', 'USA', 'Internacional', 'Deportes', 'Portugal'
                ];
                
                let matchedCountry = null;
                for (const country of countryNames) {
                    if (headerText.toLowerCase().includes(country.toLowerCase())) {
                        // Normalizar nombre de país (usar el texto del header directamente)
                        matchedCountry = headerText;
                        break;
                    }
                }
                
                if (matchedCountry && !countryData.has(matchedCountry)) {
                    // H3 está dentro de div.header-title
                    // Los canales están en el hermano siguiente de header-title
                    const headerParent = header.parentElement;
                    const channelsContainer = headerParent?.nextElementSibling;
                    
                    // Solo buscar en el contenedor de canales (hermano siguiente de header-title)
                    const channels = [];
                    
                    if (channelsContainer) {
                        // Buscar enlaces a canales en este contenedor específico
                        const links = channelsContainer.querySelectorAll('a[href*="canales.php"], a[href*="/vivo/"]');
                        
                        for (const link of links) {
                            const channelUrl = link.href;
                            
                            // CRÍTICO: El nombre NO está en el textContent (todos dicen "Link")
                            // El nombre real está en el parámetro 'stream' de la URL
                            // Ejemplo: canales.php?stream=espn → ESPN
                            const urlMatch = channelUrl.match(/stream=([^&]+)/);
                            if (!urlMatch) continue;
                            
                            const streamId = urlMatch[1];
                            const channelName = formatChannelName(streamId);
                            
                            // Validar canal
                            if (channelName && 
                                channelUrl &&
                                channelUrl.includes('tvtvhd.com') &&
                                !channelName.toLowerCase().includes('evento') &&
                                !channelName.toLowerCase().includes('ver más')) {
                                
                                channels.push({
                                    nombre: channelName,
                                    url: channelUrl,
                                    logo: '📺',
                                    calidad: 'HD'
                                });
                            }
                        }
                    }
                    
                    if (channels.length > 0) {
                        // Remover duplicados
                        const uniqueChannels = [];
                        const seen = new Set();
                        for (const ch of channels) {
                            if (!seen.has(ch.url)) {
                                seen.add(ch.url);
                                uniqueChannels.push(ch);
                            }
                        }
                        
                        countryData.set(matchedCountry, {
                            pais: matchedCountry,
                            canales: uniqueChannels
                        });
                    }
                }
            }
            
            // Función helper para formatear nombres de canales desde stream ID
            function formatChannelName(streamId) {
                if (!streamId) return null;
                
                // Mapeo de IDs especiales
                const specialNames = {
                    'espn': 'ESPN',
                    'espn2': 'ESPN 2',
                    'espn3': 'ESPN 3',
                    'espn4': 'ESPN 4',
                    'espn5': 'ESPN 5',
                    'espndeportes': 'ESPN Deportes',
                    'espnplus': 'ESPN+',
                    'espnpremium': 'ESPN Premium',
                    'foxsports': 'Fox Sports',
                    'foxsports2': 'Fox Sports 2',
                    'foxsports3': 'Fox Sports 3',
                    'tntsports': 'TNT Sports',
                    'tycsports': 'TyC Sports',
                    'tycinternacional': 'TyC Sports Internacional',
                    'directvsports': 'DirecTV Sports',
                    'dsports': 'DSports',
                    'win': 'Win Sports',
                    'winsports': 'Win Sports',
                    'golperu': 'Gol Perú',
                    'goltv': 'Gol TV',
                    'bein': 'beIN Sports',
                    'dazn': 'DAZN',
                    'skysports': 'Sky Sports',
                    'nbcsports': 'NBC Sports',
                    'cdf': 'CDF',
                    'tudn': 'TUDN',
                    'unimas': 'Unimás',
                    'telemundo': 'Telemundo',
                    'univision': 'Univision',
                    'telefe': 'Telefe',
                    'tvpublica': 'TV Pública',
                    'canaltrece': 'Canal 13',
                    'canal13': 'Canal 13',
                    'canal9': 'Canal 9',
                    'america': 'América TV',
                    'latina': 'Latina',
                    'atv': 'ATV',
                    'panamericana': 'Panamericana',
                    'rcn': 'RCN',
                    'caracol': 'Caracol',
                    'canal1': 'Canal 1',
                    'citytv': 'City TV',
                    'teleantioquia': 'Teleantioquia',
                    'telecaribe': 'Telecaribe'
                };
                
                // Buscar en mapeo especial
                const streamKey = streamId.toLowerCase().replace(/[-_\s]/g, '');
                if (specialNames[streamKey]) {
                    return specialNames[streamKey];
                }
                
                // Si no está en el mapeo, capitalizar y limpiar
                return streamId
                    .replace(/[-_]/g, ' ')
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
            }
            
            // Convertir Map a Array
            const results = Array.from(countryData.values());
            
            // Si no encontró países, extraer todos los canales
            if (results.length === 0) {
                const allLinks = document.querySelectorAll('a[href*="canales.php"], a[href*="/vivo/"]');
                const channels = [];
                const seen = new Set();
                
                for (const link of allLinks) {
                    const url = link.href;
                    const urlMatch = url.match(/stream=([^&]+)/);
                    if (!urlMatch) continue;
                    
                    const streamId = urlMatch[1];
                    const name = formatChannelName(streamId);
                    
                    if (name && url && !seen.has(url) && name.length < 50) {
                        seen.add(url);
                        channels.push({
                            nombre: name,
                            url: url,
                            logo: '📺',
                            calidad: 'HD'
                        });
                    }
                }
                
                if (channels.length > 0) {
                    results.push({
                        pais: 'Todos los Canales',
                        canales: channels
                    });
                }
            }
            
            return results;
        });

        await page.close();
        await context.close();

        // Procesar y limpiar resultados
        const processedChannels = channelsByCountry
            .filter(country => country.canales.length > 0)
            .map((country, index) => ({
                id: `country-${Date.now()}-${index}`,
                pais: country.pais,
                flag: getCountryFlag(country.pais),
                canales: country.canales,
                totalCanales: country.canales.length
            }));

        // Guardar en cache
        cachedChannels = processedChannels;
        cacheTimestamp = now;

        console.log(`[TV Channels] ✅ ${processedChannels.length} países/regiones con canales`);
        return processedChannels;

    } catch (error) {
        console.error('[TV Channels] ❌ Error al scrapear canales:', error.message);
        
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        
        // Si hay cache vieja, devolverla
        if (cachedChannels) {
            console.log('[TV Channels] ⚠️ Devolviendo cache antigua por error');
            return cachedChannels;
        }

        // Si no hay cache, devolver array vacío
        return [];
    }
}

/**
 * Obtiene la bandera emoji de un país por su nombre
 */
function getCountryFlag(countryName) {
    const flags = {
        'Argentina': '🇦🇷',
        'Brasil': '🇧🇷',
        'Colombia': '🇨🇴',
        'Chile': '🇨🇱',
        'Ecuador': '🇪🇨',
        'México': '🇲🇽',
        'Perú': '🇵🇪',
        'Uruguay': '🇺🇾',
        'Venezuela': '🇻🇪',
        'España': '🇪🇸',
        'Estados Unidos': '🇺🇸',
        'USA': '🇺🇸',
        'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        'UK': '🏴󠁧󠁢󠁥󠁮󠁧󠁿'
    };
    
    // Normalizar nombre del país para búsqueda case-insensitive
    const normalizedCountry = countryName.toLowerCase();
    
    // Buscar coincidencia parcial (case-insensitive)
    for (const [country, flag] of Object.entries(flags)) {
        if (normalizedCountry.includes(country.toLowerCase())) {
            return flag;
        }
    }
    
    return '🌎'; // Default: globo terráqueo
}

/**
 * Limpia el cache de canales
 */
export function clearChannelsCache() {
    cachedChannels = null;
    cacheTimestamp = 0;
    console.log('[TV Channels] 🧹 Cache limpiado');
}

/**
 * Obtiene canales de un país específico
 */
export async function getChannelsByCountryName(countryName) {
    const allCountries = await getChannelsByCountry();
    return allCountries.find(c => 
        c.pais.toLowerCase().includes(countryName.toLowerCase())
    ) || null;
}
