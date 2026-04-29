/**
 * config/filters.config.js
 * Configuración de filtros para contenido LATAM
 */

// Países permitidos (LATAM + España)
export const ALLOWED_COUNTRIES = [
  'mexico',
  'méxico',
  'colombia',
  'argentina',
  'perú',
  'peru',
  'chile',
  'venezuela',
  'ecuador',
  'uruguay',
  'españa',
  'spain',
  'latam',
  'latinoamerica',
  'latino',
  'spanish',
  'español',
  'es',
  'mx',
  'co',
  'ar',
  'pe',
  'cl',
  've',
  'ec',
  'uy',
];

// Keywords deportivas permitidas (incluye global)
export const SPORTS_KEYWORDS = [
  // LATAM
  'espn',
  'fox sports',
  'fox',
  'tnt sports',
  'tnt',
  'directv',
  'directv sports',
  'win sports',
  'win',
  'goltv',
  'gol',
  'tyc sports',
  'tyc',
  'bein sports',
  'bein',
  'dazn',
  'tudn',
  'univision',
  'telemundo',
  'claro sports',
  'vix',
  'afizzionados',
  'izzi',
  'sky sports',
  'movistar',
  'caracol',
  'rcn',
  'deportv',
  // GLOBAL (permitido para deportes)
  'premier league',
  'laliga',
  'serie a',
  'bundesliga',
  'ligue 1',
  'champions league',
  'uefa',
  'nfl',
  'nba',
  'mlb',
  'nhl',
  'f1',
  'formula',
  'ufc',
  'wwe',
  'boxing',
  'tennis',
  'golf',
  'motogp',
  'cricket',
  'rugby',
  'setanta',
  'arena sport',
  'sport tv',
  'eurosport',
  'eleven sports',
];

// Keywords de películas 24/7
export const MOVIES_247_KEYWORDS = [
  '24/7',
  '247',
  'cine',
  'pelicula',
  'peliculas',
  'movie',
  'movies',
  'cinema',
  'films',
  'film',
  'paramount',
  'warner',
  'hbo',
  'fx',
  'amc',
  'tnt',
  'space',
  'cinecanal',
  'cinemax',
  'golden',
  'studio universal',
  'sony',
  'axn',
];

// Keywords de entretenimiento LATAM
export const ENTERTAINMENT_KEYWORDS = [
  'televisa',
  'azteca',
  'imagen',
  'multimedios',
  'canal de las estrellas',
  'canal 5',
  'nueve',
  'once',
  'trece',
  'caracol',
  'rcn',
  'telefe',
  'canal 13',
  'mega',
  'chv',
  'tvn',
  'ecuavisa',
  'tc',
  'rts',
  'venevision',
  'televen',
  'globovision',
  'telemundo',
  'univision',
];

// Keywords de noticias LATAM
export const NEWS_KEYWORDS = [
  'cnn español',
  'cnn en español',
  'ntn24',
  'dw español',
  'euronews español',
  'rt español',
  'telesur',
  'milenio',
  'foro tv',
  'n+',
  'adn40',
  'tlnovelas',
  'de película',
  'telemundo',
  'univision noticias',
];

// Palabras excluidas (idiomas no español, regiones no LATAM)
export const EXCLUDED_KEYWORDS = [
  // Asia
  'india',
  'pakistan',
  'bangladesh',
  'china',
  'japan',
  'korea',
  'thai',
  'vietnam',
  'indonesia',
  'malaysia',
  'philippines',
  
  // Medio Oriente
  'arab',
  'arabic',
  'turkey',
  'turkish',
  'iran',
  'persian',
  
  // Europa no española
  'uk',
  'british',
  'germany',
  'german',
  'france',
  'french',
  'italy',
  'italian',
  'poland',
  'portugal', // Excepto si tiene contenido español
  'russia',
  'russian',
  
  // África
  'africa',
  'nigeria',
  'south africa',
  
  // Otros idiomas
  'hindi',
  'urdu',
  'bengali',
  'mandarin',
  'cantonese',
  'japanese',
  'korean',
];

/**
 * Verificar si un canal es válido para LATAM
 * @param {Object} channel - Objeto del canal con name y group
 * @returns {boolean}
 */
export function isLatamChannel(channel) {
  const name = (channel.name || '').toLowerCase();
  const group = (channel.group || channel.groupTitle || '').toLowerCase();
  const combined = `${name} ${group}`;

  // 1. Excluir palabras prohibidas (excepto si es deportes o películas premium)
  const category = detectCategory(channel);
  const isSpecialCategory = category === 'sports' || category === 'movies';
  
  if (!isSpecialCategory) {
    for (const excluded of EXCLUDED_KEYWORDS) {
      if (combined.includes(excluded)) {
        return false;
      }
    }
  }

  // 2. Verificar países permitidos
  for (const country of ALLOWED_COUNTRIES) {
    if (combined.includes(country)) {
      return true;
    }
  }

  // 3. Permitir deportes globales
  if (category === 'sports') {
    return true;
  }

  // 4. Permitir películas 24/7
  if (category === 'movies') {
    return true;
  }

  // 5. Verificar keywords entretenimiento
  for (const keyword of ENTERTAINMENT_KEYWORDS) {
    if (combined.includes(keyword)) {
      return true;
    }
  }

  // 6. Verificar keywords noticias
  for (const keyword of NEWS_KEYWORDS) {
    if (combined.includes(keyword)) {
      return true;
    }
  }

  // Por defecto rechazar si no hay coincidencias
  return false;
}

/**
 * Detectar categoría del canal
 * @param {Object} channel
 * @returns {string} - 'sports' | 'movies' | 'entertainment' | 'news' | 'other'
 */
export function detectCategory(channel) {
  const name = (channel.name || '').toLowerCase();
  const group = (channel.group || channel.groupTitle || '').toLowerCase();
  const combined = `${name} ${group}`;

  // Deportes (prioridad alta)
  for (const keyword of SPORTS_KEYWORDS) {
    if (combined.includes(keyword)) {
      return 'sports';
    }
  }

  // Películas 24/7
  for (const keyword of MOVIES_247_KEYWORDS) {
    if (combined.includes(keyword)) {
      return 'movies';
    }
  }

  // Noticias
  for (const keyword of NEWS_KEYWORDS) {
    if (combined.includes(keyword)) {
      return 'news';
    }
  }

  // Entretenimiento
  for (const keyword of ENTERTAINMENT_KEYWORDS) {
    if (combined.includes(keyword)) {
      return 'entertainment';
    }
  }

  return 'other';
}

/**
 * Detectar país del canal
 * @param {Object} channel
 * @returns {string|null}
 */
export function detectCountry(channel) {
  const name = (channel.name || '').toLowerCase();
  const group = (channel.group || channel.groupTitle || '').toLowerCase();
  const combined = `${name} ${group}`;

  const countryMap = {
    'mexico': ['mexico', 'méxico', 'mx'],
    'colombia': ['colombia', 'co'],
    'argentina': ['argentina', 'ar'],
    'peru': ['perú', 'peru', 'pe'],
    'chile': ['chile', 'cl'],
    'venezuela': ['venezuela', 've'],
    'ecuador': ['ecuador', 'ec'],
    'uruguay': ['uruguay', 'uy'],
    'españa': ['españa', 'spain', 'es'],
  };

  for (const [country, keywords] of Object.entries(countryMap)) {
    for (const keyword of keywords) {
      if (combined.includes(keyword)) {
        return country;
      }
    }
  }

  return 'latam'; // Genérico si no se detecta país específico
}
