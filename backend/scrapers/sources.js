/**
 * scrapers/sources.js - revisado 2026-04
 * Prioridad de idioma: Latino > Subtitulado > Ingles
 */

export const MOVIE_SOURCES = [
  // ── Latino ─────────────────────────────────────────────────────────────────
  {
    id: 'autoembed_latino',
    name: 'AutoEmbed',
    language: 'Latino',
    qualityHint: '1080p',
    priority: 1,
    isInteractive: false,
    buildUrl: ({ tmdbId }) =>
      `https://autoembed.co/movie/tmdb/${tmdbId}?lang=es`,
  },
  {
    id: 'multiembed_movie',
    name: 'MultiEmbed',
    language: 'Latino',
    qualityHint: '1080p',
    priority: 2,
    isInteractive: false,
    buildUrl: ({ tmdbId }) =>
      `https://multiembed.mov/directstream.php?video_id=${tmdbId}&tmdb=1`,
  },
  {
    id: '2embed_movie',
    name: '2Embed',
    language: 'Latino',
    qualityHint: '1080p',
    priority: 2,
    isInteractive: false,
    buildUrl: ({ tmdbId }) =>
      `https://www.2embed.cc/embed/${tmdbId}`,
  },
  {
    id: 'warezcdn_movie',
    name: 'WarezCDN',
    language: 'Latino',
    qualityHint: '1080p',
    priority: 2,
    isInteractive: false,
    buildUrl: ({ tmdbId }) =>
      `https://embed.warezcdn.com/filme/${tmdbId}`,
  },
  {
    id: 'embedflix_movie',
    name: 'EmbedFlix',
    language: 'Latino',
    qualityHint: '1080p',
    priority: 2,
    isInteractive: false,
    buildUrl: ({ tmdbId }) =>
      `https://embedflix.vercel.app/movie/${tmdbId}`,
  },
  // ── Subtitulado ────────────────────────────────────────────────────────────
  {
    id: 'embedsu',
    name: 'Embed.su',
    language: 'Subtitulado',
    qualityHint: '1080p',
    priority: 3,
    isInteractive: false,
    buildUrl: ({ tmdbId }) => `https://embed.su/embed/movie/${tmdbId}`,
  },
  {
    id: 'vidsrc_me',
    name: 'VidSrc.me',
    language: 'Subtitulado',
    qualityHint: '1080p',
    priority: 4,
    isInteractive: false,
    buildUrl: ({ tmdbId }) => `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`,
  },
  {
    id: 'vidsrc_cc',
    name: 'VidSrc.cc',
    language: 'Subtitulado',
    qualityHint: '1080p',
    priority: 5,
    isInteractive: false,
    buildUrl: ({ tmdbId }) => `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,
  },
  {
    id: 'videasy',
    name: 'Videasy',
    language: 'Subtitulado',
    qualityHint: '1080p',
    priority: 6,
    isInteractive: false,
    buildUrl: ({ tmdbId }) => `https://player.videasy.net/movie/${tmdbId}`,
  },
  // ── Inglés ─────────────────────────────────────────────────────────────────
  {
    id: 'vidlink_en',
    name: 'VidLink',
    language: 'Ingles',
    qualityHint: '1080p',
    priority: 7,
    isInteractive: false,
    buildUrl: ({ tmdbId }) => `https://vidlink.pro/movie/${tmdbId}?primaryLang=en`,
  },
];

export const TV_SOURCES = [
  // ── Latino ─────────────────────────────────────────────────────────────────
  {
    id: 'autoembed_tv_lat',
    name: 'AutoEmbed',
    language: 'Latino',
    qualityHint: '1080p',
    priority: 1,
    isInteractive: false,
    buildUrl: ({ tmdbId, season = 1, episode = 1 }) =>
      `https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}?lang=es`,
  },
  {
    id: 'multiembed_tv',
    name: 'MultiEmbed',
    language: 'Latino',
    qualityHint: '1080p',
    priority: 2,
    isInteractive: false,
    buildUrl: ({ tmdbId, season = 1, episode = 1 }) =>
      `https://multiembed.mov/directstream.php?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`,
  },
  {
    id: '2embed_tv',
    name: '2Embed',
    language: 'Latino',
    qualityHint: '1080p',
    priority: 2,
    isInteractive: false,
    buildUrl: ({ tmdbId, season = 1, episode = 1 }) =>
      `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`,
  },
  {
    id: 'warezcdn_tv',
    name: 'WarezCDN',
    language: 'Latino',
    qualityHint: '1080p',
    priority: 2,
    isInteractive: false,
    buildUrl: ({ tmdbId, season = 1, episode = 1 }) =>
      `https://embed.warezcdn.com/serie/${tmdbId}/${season}/${episode}`,
  },
  {
    id: 'embedflix_tv',
    name: 'EmbedFlix',
    language: 'Latino',
    qualityHint: '1080p',
    priority: 2,
    isInteractive: false,
    buildUrl: ({ tmdbId, season = 1, episode = 1 }) =>
      `https://embedflix.vercel.app/tv/${tmdbId}/${season}/${episode}`,
  },
  // ── Subtitulado ────────────────────────────────────────────────────────────
  {
    id: 'embedsu_tv',
    name: 'Embed.su',
    language: 'Subtitulado',
    qualityHint: '1080p',
    priority: 3,
    isInteractive: false,
    buildUrl: ({ tmdbId, season = 1, episode = 1 }) =>
      `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: 'vidsrc_me_tv',
    name: 'VidSrc.me',
    language: 'Subtitulado',
    qualityHint: '1080p',
    priority: 4,
    isInteractive: false,
    buildUrl: ({ tmdbId, season = 1, episode = 1 }) =>
      `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`,
  },
  {
    id: 'vidsrc_cc_tv',
    name: 'VidSrc.cc',
    language: 'Subtitulado',
    qualityHint: '1080p',
    priority: 5,
    isInteractive: false,
    buildUrl: ({ tmdbId, season = 1, episode = 1 }) =>
      `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: 'videasy_tv',
    name: 'Videasy',
    language: 'Subtitulado',
    qualityHint: '1080p',
    priority: 6,
    isInteractive: false,
    buildUrl: ({ tmdbId, season = 1, episode = 1 }) =>
      `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`,
  },
  // ── Inglés ─────────────────────────────────────────────────────────────────
  {
    id: 'vidlink_tv_en',
    name: 'VidLink',
    language: 'Ingles',
    qualityHint: '1080p',
    priority: 7,
    isInteractive: false,
    buildUrl: ({ tmdbId, season = 1, episode = 1 }) =>
      `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?primaryLang=en`,
  },
];

// --- Patrones para detectar URLs de stream ----------------------------------
export const STREAM_PATTERNS = [
  /\.m3u8(\?.*)?$/i,
  /\/hls\/.*\.m3u8/i,
  /playlist\.m3u8/i,
  /\.mp4(\?.*)?$/i,
  /\.mpd(\?.*)?$/i,
];

// --- Patrones a bloquear (ads, tracking, assets estaticos) -----------------
export const BLOCKED_PATTERNS = [
  /google-analytics\.com/,
  /doubleclick\.net/,
  /facebook\.com\/tr/,
  /\.(png|jpg|jpeg|gif|webp|ico|css)(\?.*)?$/i,
  /\.woff2?(\?.*)?$/i,
  /ads\./i,
  /tracking\./i,
  /analytics\./i,
  /clarity\.ms/i,
  /browser-intake/i,
  /trafficjunky\.net/i,
  /exoclick\.com/i,
  /juicyads\.com/i,
  /adsterra\.com/i,
  /propellerads\.com/i,
  /popcash\.net/i,
  /hilltopads\.net/i,
  /ero-advertising\.com/i,
  /adnxs\.com/i,
  /[?&]vast=/i,
  /\/vast\.xml/i,
  /\/preroll\//i,
  /adserver\./i,
  /amd-cdn-\d+\.[a-f0-9]{20,}\.com/i,
];
