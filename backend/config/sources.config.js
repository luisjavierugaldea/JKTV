/**
 * config/sources.config.js
 * Configuración de fuentes de contenido IPTV
 */

// URLs de listas M3U públicas (LATAM enfocadas)
export const M3U_SOURCES = [
  {
    id: 'iptv-org-global',
    name: 'IPTV.org Global (Filtrado)',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
    enabled: true,
    priority: 1,
  },
  {
    id: 'iptv-org-latam',
    name: 'IPTV.org LATAM',
    url: 'https://iptv-org.github.io/iptv/countries/mx.m3u',
    enabled: true,
    priority: 2,
  },
  {
    id: 'iptv-org-co',
    name: 'IPTV.org Colombia',
    url: 'https://iptv-org.github.io/iptv/countries/co.m3u',
    enabled: true,
    priority: 1,
  },
  {
    id: 'iptv-org-ar',
    name: 'IPTV.org Argentina',
    url: 'https://iptv-org.github.io/iptv/countries/ar.m3u',
    enabled: true,
    priority: 1,
  },
  {
    id: 'iptv-org-cl',
    name: 'IPTV.org Chile',
    url: 'https://iptv-org.github.io/iptv/countries/cl.m3u',
    enabled: true,
    priority: 1,
  },
  {
    id: 'iptv-org-es',
    name: 'IPTV.org España',
    url: 'https://iptv-org.github.io/iptv/countries/es.m3u',
    enabled: true,
    priority: 2,
  },
  {
    id: 'iptv-org-sports',
    name: 'IPTV.org Sports',
    url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
    enabled: true,
    priority: 1,
  },
  // ── Más países LATAM ──
  {
    id: 'iptv-org-pe',
    name: 'IPTV.org Perú',
    url: 'https://iptv-org.github.io/iptv/countries/pe.m3u',
    enabled: true,
    priority: 1,
  },
  {
    id: 'iptv-org-ec',
    name: 'IPTV.org Ecuador',
    url: 'https://iptv-org.github.io/iptv/countries/ec.m3u',
    enabled: true,
    priority: 1,
  },
  {
    id: 'iptv-org-ve',
    name: 'IPTV.org Venezuela',
    url: 'https://iptv-org.github.io/iptv/countries/ve.m3u',
    enabled: true,
    priority: 1,
  },
  {
    id: 'iptv-org-uy',
    name: 'IPTV.org Uruguay',
    url: 'https://iptv-org.github.io/iptv/countries/uy.m3u',
    enabled: true,
    priority: 1,
  },
  {
    id: 'iptv-org-bo',
    name: 'IPTV.org Bolivia',
    url: 'https://iptv-org.github.io/iptv/countries/bo.m3u',
    enabled: true,
    priority: 2,
  },
  {
    id: 'iptv-org-py',
    name: 'IPTV.org Paraguay',
    url: 'https://iptv-org.github.io/iptv/countries/py.m3u',
    enabled: true,
    priority: 2,
  },
  // ── Más categorías ──
  {
    id: 'iptv-org-news',
    name: 'IPTV.org Noticias',
    url: 'https://iptv-org.github.io/iptv/categories/news.m3u',
    enabled: true,
    priority: 2,
  },
  {
    id: 'iptv-org-movies',
    name: 'IPTV.org Películas 24/7',
    url: 'https://iptv-org.github.io/iptv/categories/movies.m3u',
    enabled: true,
    priority: 2,
  },
  {
    id: 'iptv-org-series',
    name: 'IPTV.org Series 24/7',
    url: 'https://iptv-org.github.io/iptv/categories/series.m3u',
    enabled: true,
    priority: 3,
  },
  {
    id: 'iptv-org-music',
    name: 'IPTV.org Música',
    url: 'https://iptv-org.github.io/iptv/categories/music.m3u',
    enabled: true,
    priority: 3,
  },
  // ── Puedes agregar tus propias listas M3U aquí ──
  // Ejemplo:
  // {
  //   id: 'mi-lista-custom',
  //   name: 'Mi Lista Personal',
  //   url: 'https://tu-servidor.com/lista.m3u',
  //   enabled: false,  // Deshabilitado por defecto
  //   priority: 5,
  // },
];

// Configuración de scrapers
export const SCRAPERS = [
  {
    id: 'tvtvhd',
    name: 'TVTVHD Channels',
    type: 'scraper',
    enabled: true,
    priority: 1,
    module: '../scrapers/tvtvChannels.js',
  },
  {
    id: 'tvtvhd-events',
    name: 'TVTVHD Events',
    type: 'scraper',
    enabled: true,
    priority: 1,
    module: '../scrapers/eventsManager.js',
  },
  // Aquí puedes agregar más scrapers en el futuro
];

// Intervalos de actualización (en milisegundos)
export const UPDATE_INTERVALS = {
  M3U: 30 * 60 * 1000,        // 30 minutos
  EVENTS: 5 * 60 * 1000,       // 5 minutos
  CHANNELS: 30 * 60 * 1000,    // 30 minutos
  HEALTH_CHECK: 60 * 60 * 1000, // 1 hora
};

// TTLs de caché
export const CACHE_TTL = {
  M3U_CHANNELS: 30 * 60 * 1000,     // 30 minutos
  SCRAPED_CHANNELS: 30 * 60 * 1000, // 30 minutos
  EVENTS: 5 * 60 * 1000,            // 5 minutos
  STREAM_VALIDATION: 15 * 60 * 1000, // 15 minutos
  CONFIG: 60 * 60 * 1000,           // 1 hora
};

// Configuración de validación de streams
export const STREAM_VALIDATION = {
  TIMEOUT: 5000,              // 5 segundos timeout
  MAX_RETRIES: 2,             // Reintentos máximos
  BATCH_SIZE: 10,             // Validar en lotes de 10
  PARALLEL_CHECKS: 5,         // Checks paralelos
};

// User agents para rotación
export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
];

/**
 * Obtener fuentes M3U habilitadas
 */
export function getEnabledM3USources() {
  return M3U_SOURCES.filter(s => s.enabled).sort((a, b) => a.priority - b.priority);
}

/**
 * Obtener scrapers habilitados
 */
export function getEnabledScrapers() {
  return SCRAPERS.filter(s => s.enabled).sort((a, b) => a.priority - b.priority);
}

/**
 * Obtener user agent aleatorio
 */
export function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}
