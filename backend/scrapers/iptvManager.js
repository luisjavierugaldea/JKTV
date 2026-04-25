import axios from 'axios';
import parser from 'iptv-playlist-parser';
import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), '.iptv_cache.json');
const BLACKLIST_FILE = path.join(process.cwd(), '.iptv_blacklist.json');

// Cargar lista negra al inicio
let blacklist = new Set();
if (fs.existsSync(BLACKLIST_FILE)) {
    try {
        blacklist = new Set(JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8')));
    } catch (e) { console.error('[IPTV] Error cargando lista negra'); }
} else {
    blacklist = new Set(); // Asegurar que está vacía si borramos el archivo
}

// 📡 PROVEEDORES IPTV — 24/7 en Español / América Latina
const PROVIDERS = [

    // ── POR PAÍS (100% local, sin mezcla de idiomas) ──────────────────────────
    {
        name: 'México 🇲🇽',
        url: 'https://iptv-org.github.io/iptv/countries/mx.m3u'
    },
    {
        name: 'Argentina 🇦🇷',
        url: 'https://iptv-org.github.io/iptv/countries/ar.m3u'
    },
    {
        name: 'Colombia 🇨🇴',
        url: 'https://iptv-org.github.io/iptv/countries/co.m3u'
    },
    {
        name: 'Chile 🇨🇱',
        url: 'https://iptv-org.github.io/iptv/countries/cl.m3u'
    },
    {
        name: 'Venezuela 🇻🇪',
        url: 'https://iptv-org.github.io/iptv/countries/ve.m3u'
    },
    {
        name: 'Perú 🇵🇪',
        url: 'https://iptv-org.github.io/iptv/countries/pe.m3u'
    },
    {
        name: 'España 🇪🇸',
        url: 'https://iptv-org.github.io/iptv/countries/es.m3u'
    },
    {
        name: 'Ecuador 🇪🇨',
        url: 'https://iptv-org.github.io/iptv/countries/ec.m3u'
    },

    // ── DEPORTES (universales — Champions, F1, NFL, NBA) ─────────────────────
    {
        name: 'Deportes LATAM',
        url: 'https://iptv-org.github.io/iptv/regions/lac.m3u'
    },
    {
        name: 'Deportes Europa',
        url: 'https://iptv-org.github.io/iptv/categories/sports.m3u'
    },

    // ── ANIME 24/7 ────────────────────────────────────────────────────────────
    {
        name: 'Anime 24/7',
        url: 'https://iptv-org.github.io/iptv/categories/animation.m3u'
    },

    // ── PELÍCULAS 24/7 EN ESPAÑOL ─────────────────────────────────────────────
    {
        name: 'Películas 24/7',
        url: 'https://iptv-org.github.io/iptv/categories/movies.m3u'
    },

    // ── CANALES 24/7 ESPECIALIZADOS (Pluto TV, Generales) ────────────────────
    {
        name: 'Pluto TV Latino (24/7)',
        url: 'https://i.mjh.nz/PlutoTV/latin.m3u8'
    },
    {
        name: 'General Español',
        url: 'https://iptv-org.github.io/iptv/languages/spa.m3u'
    },

    // ── CANALES DE PAGO PERSONAL (descomentar y agregar credenciales) ─────────
    // {
    //     name: 'Diablo',
    //     url: 'http://tv.diablotv.net:8080/get.php?username=USER&password=PASS&type=m3u_plus&output=m3u8'
    // },
    // {
    //     name: 'Zeus',
    //     url: 'http://zeus.server.com:8080/get.php?username=USER&password=PASS&type=m3u_plus&output=m3u8'
    // },
];

function normalizeChannelName(name) {
    if (!name) return 'Canal Desconocido';
    return name
        .replace(/hd|fhd|4k|1080p|720p|sd/gi, '')
        .replace(/\[.*?\]|\(.*?\)/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

// Normaliza el nombre del grupo/categoría a un nombre limpio y unificado
function normalizeGroupName(rawGroup, channelName = '', url = '') {
    const g = (rawGroup || 'General').trim();
    const lower = g.toLowerCase();
    const nameLower = channelName.toLowerCase();

    // ── CANALES 24/7 (Pluto TV, Chavo, etc) ──
    if (lower.includes('pluto') || url.includes('plutotv') || nameLower.includes('24/7') || lower.includes('24/7')) {
        return 'Canales 24/7';
    }

    // Animación / Anime
    if (/animat|anime|cartoon|dibujo|animaci/i.test(lower)) return 'Animación';
    // Deportes
    if (/sport|deport|futbol|soccer|football|tenis|box|ufc|f1|nfl|nba|mlb|liga|copa|champion/i.test(lower)) return 'Deportes';
    // Películas
    if (/movie|pelicul|film|cine|cinema/i.test(lower)) return 'Películas';
    // Series
    if (/serie|series|show|novela|telenovela|drama/i.test(lower)) return 'Series';
    // Noticias
    if (/news|noticias|noticiero|informativo/i.test(lower)) return 'Noticias';
    // Niños
    if (/kids|ni[ñn]os|infantil|child|baby|junior/i.test(lower)) return 'Infantil';
    // Música
    if (/music|m[uú]sica|radio|hits/i.test(lower)) return 'Música';
    // Documentales
    if (/documen|discovery|history|nat.?geo|nature/i.test(lower)) return 'Documentales';
    // Entretenimiento / General
    if (/entret|variety|general|variedades/i.test(lower)) return 'Entretenimiento';
    // Adultos
    if (/adult|xxx|18\+|erotic/i.test(lower)) return 'Adultos';

    return 'General';
}

let isUpdating = false;

async function buildMasterPlaylist() {
    // 1. Intentar cargar desde cache para velocidad instantánea
    if (fs.existsSync(CACHE_FILE)) {
        try {
            const cacheData = fs.readFileSync(CACHE_FILE, 'utf8');
            const cachedChannels = JSON.parse(cacheData);
            console.log(`[IPTV] ⚡ Cache cargado: ${cachedChannels.length} canales listos.`);

            // Si el cache es viejo (> 12h) o acabamos de arrancar, actualizamos en segundo plano
            if (!isUpdating) {
                updateCacheInBackground();
            }

            return cachedChannels;
        } catch (e) {
            console.error('[IPTV] Error leyendo cache, descargando de nuevo...');
        }
    }

    return await downloadAndProcessAll();
}

async function updateCacheInBackground() {
    isUpdating = true;
    console.log('[IPTV] 🔄 Actualizando lista en segundo plano...');
    try {
        const freshChannels = await downloadAndProcessAll();
        fs.writeFileSync(CACHE_FILE, JSON.stringify(freshChannels));
        console.log('[IPTV] ✅ Cache actualizado.');
    } catch (err) {
        console.error('[IPTV] ❌ Falló la actualización en segundo plano');
    } finally {
        isUpdating = false;
    }
}

async function downloadAndProcessAll() {
    console.log('[IPTV] Descargando listas en paralelo...');
    const masterChannels = new Map();

    const promises = PROVIDERS.map(async (provider) => {
        try {
            const response = await axios.get(provider.url, {
                timeout: 60000, // Aumentamos a 1 minuto por si la lista es gigante
                responseType: 'text',
                headers: {
                    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 11; M2012K11AG Build/RKQ1.201112.002)',
                    'Accept': '*/*',
                    'Accept-Encoding': 'gzip'
                }
            });

            const parsed = parser.parse(response.data);
            console.log(`[IPTV] 📥 ${provider.name}: ${parsed.items.length} canales brutos.`);

            // Limitar para no estar horas validando si es la primera vez
            // O procesar todos pero validar solo una muestra o los más importantes
            parsed.items.forEach(channel => {
                if (!channel.url) return;
                // 🛡️ FILTRO DE LISTA NEGRA
                if (blacklist.has(channel.url)) return;

                // 🚫 FILTRO DE DOMINIOS RESTRINGIDOS POR DISPOSITIVO
                // Estos servidores requieren autenticación de dispositivo específico (Samsung TV, Pluto, etc.)
                // y no pueden reproducirse a través de un proxy web.
                const RESTRICTED_DOMAINS = [
                    // Solo bloqueamos los que requieren cuenta de pago o DRM real
                    'peacocktv.com',     // Peacock - requiere cuenta de pago
                    'plex.tv',           // Plex - requiere cuenta
                ];
                if (RESTRICTED_DOMAINS.some(d => channel.url.includes(d))) return;

                // Para canales de Samsung TV Plus (jmp2.uk), reemplazamos el SID con nuestro propio UUID
                // para simular un dispositivo Samsung TV virtual
                if (channel.url.includes('jmp2.uk') && channel.url.includes('sid=')) {
                    // Reemplazamos el SID con un UUID propio generado una vez
                    channel.url = channel.url.replace(/sid=[^&]+/, 'sid=SAMSUNG-TVPLUS-jktv-virtual-device-00001');
                }

                if (channel.url.includes('/movie/') || channel.url.includes('/series/')) return;

                const cleanName = normalizeChannelName(channel.name);
                if (!cleanName) return;

                const originalName = (channel.name || '');
                const rawGroupTitle = (channel.group && channel.group.title) ? channel.group.title : 'General';
                const groupTitle = normalizeGroupName(rawGroupTitle, originalName, channel.url);
                const originalNameLower = originalName.toLowerCase();
                const groupLower = groupTitle.toLowerCase();
                const language = ((channel.tvg && channel.tvg.language) || '').toLowerCase().trim();

                // ── PASO 1: Los deportes siempre pasan (son universales) ──────
                const isSports = /sport|deport|futbol|fútbol|soccer|football|nfl|nba|mlb|f1|formula|tenis|box|ufc|mma|olimp|copa|liga|champion|premier|laliga|serie a|bundesliga|eurocup|eurocopa/i.test(groupLower + ' ' + originalNameLower);

                if (!isSports) {
                    // ── PASO 2: Si tiene idioma explícito, debe ser español ────
                    const SPANISH_LANGS = ['spanish', 'español', 'spa', 'es', 'castellano', 'latino', 'latin', 'spa;eng', 'es;en'];
                    if (language && !SPANISH_LANGS.some(l => language.includes(l))) return;

                    // ── PASO 3: Prefijos de país no hispano en el nombre ───────
                    // Ej: "IT | Rai 1", "FR: TF1", "DE | ARD", "EN | BBC One"
                    const NON_SPANISH_PREFIX = /^(IT|FR|DE|NL|PT|PL|RU|TR|GR|AL|RS|HR|RO|SK|CZ|HU|UA|BG|MK|BE|CH|AT|SE|NO|DK|FI|EN|UK|US|AU|CA|IN|PK|AR|AE|SA|EG|MA|IL|LB|IQ|IR|SY|KZ|AF|NG|GH|ET|TN|DZ|LY|YE|QA|BH|KW|OM|BD|SL|MM|KR|JP|CN|TW|VN|TH|ID|MY|PH)\s*[\|:\-]/i;
                    if (NON_SPANISH_PREFIX.test(originalName.trim())) return;

                    // ── PASO 4: Palabras clave de canales claramente no hispanos ─
                    const NON_SPANISH_KEYWORDS = [
                        // Inglés
                        ' bbc ', 'bbc one', 'bbc two', 'bbc news', 'bbc world', 'cnn', 'fox news', 'msnbc',
                        'abc news', 'nbc news', 'sky news', 'channel 4', 'channel 5', 'itv ', 'dave tv',
                        // Italiano
                        'rai uno', 'rai due', 'rai tre', 'rai news', 'rete 4', 'canale 5', 'italia 1', 'mediaset',
                        // Francés
                        'tf1', 'france 2', 'france 3', 'france 5', 'm6 ', 'canal+ fr', 'arte ',
                        // Alemán
                        ' ard', ' zdf', 'rtl ', 'sat 1', 'pro sieben', 'kabel 1',
                        // Portugués (de Portugal, no Brasil)
                        'rtp1', 'rtp2', 'sic ', 'tvi ',
                        // Árabe
                        'al jazeera', 'al arabiya', 'mbc ', 'rotana', 'nile tv',
                        // Turco
                        'trt ', 'star tv tr', 'kanal d',
                    ];
                    if (NON_SPANISH_KEYWORDS.some(k => originalNameLower.includes(k))) return;

                    // ── PASO 5: Grupos claramente no hispanos ─────────────────
                    const NON_SPANISH_GROUPS = /\b(english|french|arabic|turkish|portuguese|russian|german|italian|polish|dutch|hindi|chinese|japanese|korean|albanian|romanian|greek|persian|urdu|bangla|tamil|hebrew|czech|slovak|hungarian|ukrainian|swedish|norwegian|danish|finnish|serbian|croatian|bulgarian|shqip|shqiperi)\b/i;
                    if (NON_SPANISH_GROUPS.test(groupLower)) return;

                    // ── PASO 6: Palabras clave albanesas/no latinas en el nombre ─
                    const ALBANIAN_KEYWORDS = ['rtsh', 'tv klan', 'top channel', 'vizion+', 'zjarr tv', 'shqip', 'abc news al', 'syri tv'];
                    if (ALBANIAN_KEYWORDS.some(k => originalNameLower.includes(k))) return;
                }

                const adultKeywords = ['xxx', 'adult', '18+', 'porn', 'hentai', 'sexy', 'erotica', 'redlight', 'brazzers', 'playboy', 'actrices premium'];
                const isAdult = adultKeywords.some(key =>
                    originalName.includes(key) ||
                    groupLower.includes(key)
                );

                if (masterChannels.has(cleanName)) {
                    const existingChannel = masterChannels.get(cleanName);
                    if (!existingChannel.urls.includes(channel.url)) {
                        existingChannel.urls.push(channel.url);
                        existingChannel.providers.push(provider.name);
                    }
                    if (isAdult) existingChannel.isAdult = true;
                } else {
                    masterChannels.set(cleanName, {
                        id: `tv_${cleanName}`,
                        displayName: (channel.name || 'Canal').replace(/\[.*?\]/g, '').trim(),
                        logo: (channel.tvg && channel.tvg.logo) ? channel.tvg.logo : 'https://via.placeholder.com/150?text=TV',
                        group: groupTitle,
                        urls: [channel.url],
                        providers: [provider.name],
                        isAdult: isAdult,
                        lastVerified: null
                    });
                }
            });
        } catch (error) {
            console.error(`[IPTV] ❌ ${provider.name} falló.`);
        }
    });

    await Promise.all(promises);

    let finalPlaylist = Array.from(masterChannels.values());

    // ORDENAR: Primero los que no son adultos
    finalPlaylist.sort((a, b) => {
        if (a.isAdult !== b.isAdult) return a.isAdult ? 1 : -1;
        return a.displayName.localeCompare(b.displayName);
    });

    // Hemos eliminado la validación masiva (Top 500) porque IPTV providers bloquean la IP por hacer demasiados HEAD requests.
    // Confiaremos en que el cliente simplemente auto-salte (auto-skip) si el canal está caído, sin sobrecargar la red aquí.
    
    fs.writeFileSync(CACHE_FILE, JSON.stringify(finalPlaylist));
    return finalPlaylist;
}

function reportDeadChannel(channelId, url) {
    // 1. Agregar a la Lista Negra persistente
    blacklist.add(url);
    try {
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(Array.from(blacklist)));
        console.log(`[Blacklist] 🚫 URL bloqueada permanentemente: ${url.substring(0, 50)}...`);
    } catch (e) { console.error('Error guardando blacklist'); }

    // 2. Eliminar del cache actual
    if (!fs.existsSync(CACHE_FILE)) return;
    try {
        const cacheData = fs.readFileSync(CACHE_FILE, 'utf8');
        let cachedChannels = JSON.parse(cacheData);

        const index = cachedChannels.findIndex(ch => ch.id === channelId);
        if (index !== -1) {
            const ch = cachedChannels[index];
            // Quitar la URL muerta
            ch.urls = ch.urls.filter(u => u !== url);

            if (ch.urls.length === 0) {
                // Si ya no quedan URLs, eliminar canal
                cachedChannels.splice(index, 1);
                console.log(`[IPTV Cleaning] 🗑️ Canal eliminado por estar fuera de servicio: ${ch.displayName}`);
            } else {
                console.log(`[IPTV Cleaning] 🛠️ URL eliminada del canal: ${ch.displayName}`);
            }

            fs.writeFileSync(CACHE_FILE, JSON.stringify(cachedChannels));
        }
    } catch (e) {
        console.error('[IPTV Cleaning] Error al reportar canal muerto:', e.message);
    }
}

async function fetchCustomPlaylist(customUrl) {
    console.log(`[IPTV] 📥 Obteniendo lista personal desde: ${customUrl.substring(0, 50)}...`);
    try {
        const response = await axios.get(customUrl, {
            timeout: 60000,
            responseType: 'text',
            headers: {
                'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 11; M2012K11AG Build/RKQ1.201112.002)',
                'Accept': '*/*'
            }
        });

        const parsed = parser.parse(response.data);
        const masterChannels = new Map();

        parsed.items.forEach(channel => {
            if (!channel.url) return;
            const originalName = (channel.name || '').trim() || 'Canal Desconocido';
            const cleanName = originalName.toUpperCase(); // Simplificamos normalización para listas privadas
            const rawGroupTitle = (channel.group && channel.group.title) ? channel.group.title : 'General';

            const id = 'custom_' + crypto.createHash('md5').update(cleanName).digest('hex');

            // Ignoramos filtros de idioma o blacklist para listas personales del usuario
            if (!masterChannels.has(id)) {
                masterChannels.set(id, {
                    id,
                    displayName: originalName,
                    cleanName: cleanName,
                    group: rawGroupTitle, // Usamos el grupo tal cual viene del proveedor
                    logo: channel.tvg?.logo || null,
                    urls: [channel.url],
                    isAdult: false // Asumimos que no es adulto a menos que el usuario lo decida
                });
            } else {
                masterChannels.get(id).urls.push(channel.url);
            }
        });

        return Array.from(masterChannels.values());
    } catch (err) {
        console.error('[IPTV] Error obteniendo lista personal:', err.message);
        throw err;
    }
}

export { buildMasterPlaylist, reportDeadChannel, fetchCustomPlaylist };
