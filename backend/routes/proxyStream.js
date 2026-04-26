/**
 * routes/proxyStream.js
 * Proxy HLS optimizado para máxima velocidad de segmentos.
 *
 * Optimizaciones vs. versión anterior:
 *  1. Usa `https.request()` nativo en vez de axios → menos overhead de memoria
 *  2. HTTP Agent con keepAlive → reutiliza conexiones TCP al CDN (evita handshake por segmento)
 *  3. Pipe directo response→res sin buffering → segmentos fluyen en cuanto llegan
 *  4. Soporte de Range Requests → el navegador puede hacer seeking
 *  5. Cache-Control en segmentos → el navegador cachea segmentos ya vistos
 */

import { Router } from 'express';
import https from 'https';
import http  from 'http';
import axios from 'axios';

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────

const enc = (s) => Buffer.from(s).toString('base64url');
const dec = (s) => { try { return Buffer.from(s, 'base64url').toString('utf8'); } catch { return ''; } };

// Agentes de red — keepAlive reutiliza conexiones TCP/TLS entre segmentos (crítico para 720p+)
const agents = {
  https: new https.Agent({ keepAlive: true, maxSockets: 40, keepAliveMsecs: 2_000 }),
  http:  new http.Agent({  keepAlive: true, maxSockets: 40, keepAliveMsecs: 2_000 }),
};


function getAgent(url) {
  return url.startsWith('https') ? agents.https : agents.http;
}

function buildCdnHeaders(referer, extra = {}) {
  const origin = (() => { try { return new URL(referer).origin; } catch { return 'https://vidlink.pro'; } })();
  return {
    'Referer':         referer || 'https://vidlink.pro/',
    'Origin':          origin,
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          '*/*',
    'Accept-Language': 'es-MX,es;q=0.9',
    'Connection':      'keep-alive',
    ...extra,
  };
}

function resolveUrl(base, relative) {
  try { return new URL(relative, base).href; } catch { return relative; }
}

function toProxyUrl(segmentUrl, referer) {
  const isPlaylist = /\.m3u8/i.test(segmentUrl);
  const route = isPlaylist ? 'playlist' : 'segment';
  return `/api/proxy-stream/${route}?url=${enc(segmentUrl)}&ref=${enc(referer)}`;
}

/**
 * Hace una petición HTTP/HTTPS nativa con pipe directo al response.
 * Mucho más eficiente que axios para binarios grandes.
 */
function nativeProxy(url, headers, rangeHeader, res) {
  return new Promise((resolve, reject) => {
    const parsed   = new URL(url);
    const protocol = parsed.protocol === 'https:' ? https : http;
    const agent    = getAgent(url);

    const reqHeaders = { ...headers };
    if (rangeHeader) reqHeaders['Range'] = rangeHeader;

    const req = protocol.request(
      {
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        method:   'GET',
        headers:  reqHeaders,
        agent,
        timeout:  30_000,
      },
      (upstream) => {
        const status = upstream.statusCode ?? 200;

        // Cabeceras de respuesta al cliente
        const outHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Range',
          'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
        };

        const ct = upstream.headers['content-type'];
        if (ct) outHeaders['Content-Type'] = ct;

        const cl = upstream.headers['content-length'];
        if (cl) outHeaders['Content-Length'] = cl;

        const cr = upstream.headers['content-range'];
        if (cr) outHeaders['Content-Range'] = cr;

        // Cachear segmentos ya servidos en el navegador (1 hora)
        outHeaders['Cache-Control'] = 'public, max-age=3600';

        res.writeHead(status, outHeaders);
        upstream.pipe(res);
        upstream.on('end', resolve);
        upstream.on('error', reject);
      }
    );

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout de proxy')); });
    req.end();
  });
}

// ── GET /api/proxy-stream/playlist ────────────────────────────────────────────
router.get('/playlist', async (req, res) => {
  const url     = dec(req.query.url);
  const referer = dec(req.query.ref) || 'https://vidlink.pro/';

  if (!url) return res.status(400).send('url requerida');

  const base = url.substring(0, url.lastIndexOf('/') + 1);

  try {
    // Para playlists usamos axios (texto, no binario — overhead irrelevante)
    const { data } = await axios.get(url, {
      headers:      buildCdnHeaders(referer),
      responseType: 'text',
      timeout:      15_000,
      httpsAgent:   agents.https,
      httpAgent:    agents.http,
    });

    // Reescribir líneas del playlist
    const rewritten = data
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const absolute = trimmed.startsWith('http') ? trimmed : resolveUrl(base, trimmed);
        return toProxyUrl(absolute, referer);
      })
      .join('\n');

    res.set({
      'Content-Type':                'application/vnd.apple.mpegurl',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control':               'no-cache',   // playlists siempre frescos
    });
    res.send(rewritten);

  } catch (err) {
    console.error(`[ProxyStream] Playlist error: ${err.message}`);
    res.status(502).send('No se pudo obtener el playlist del CDN.');
  }
});

// ── OPTIONS (preflight CORS) ───────────────────────────────────────────────────
router.options('/segment', (_, res) => {
  res.set({
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Max-Age':       '86400',
  }).sendStatus(204);
});

// ── GET /api/proxy-stream/segment ─────────────────────────────────────────────
// Pipe directo con https nativo — máxima velocidad para segmentos binarios
router.get('/segment', async (req, res) => {
  const url     = dec(req.query.url);
  const referer = dec(req.query.ref) || 'https://vidlink.pro/';

  if (!url) return res.status(400).send('url requerida');

  const headers  = buildCdnHeaders(referer);
  const range    = req.headers['range'];   // soporte Range para seeking

  try {
    await nativeProxy(url, headers, range, res);
  } catch (err) {
    console.error(`[ProxyStream] Segment error: ${url.substring(0,80)} → ${err.message}`);
    if (!res.headersSent) res.status(502).end();
  }
});

// ── GET /api/proxy-stream/iframe ──────────────────────────────────────────────
// Proxy para incrustar iframes (Cuevana, PelisPlus) evadiendo X-Frame-Options
router.get('/iframe', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('url requerida');

  try {
    const parsedUrl = new URL(url);
    const origin = parsedUrl.origin;

    const { data, headers } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': origin,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
      responseType: 'text',
      timeout: 15_000,
    });

    // Remover cabeceras de seguridad que bloquean el iframe
    const safeHeaders = { ...headers };
    delete safeHeaders['x-frame-options'];
    delete safeHeaders['content-security-policy'];
    delete safeHeaders['set-cookie'];

    // Inyectar etiqueta <base> para que las rutas relativas funcionen
    // Y un meta referrer 'no-referrer' para evitar que los CDNs (vimeos, streamwish) bloqueen peticiones desde localhost
    const modifiedHtml = data.replace(
      /<head>/i,
      `<head>\n<base href="${origin}/">\n<meta name="referrer" content="no-referrer">`
    );

    res.set(safeHeaders);
    res.set('Access-Control-Allow-Origin', '*');
    res.send(modifiedHtml);

  } catch (err) {
    console.error(`[ProxyStream] Iframe error: ${err.message}`);
    res.status(502).send('No se pudo cargar el reproductor.');
  }
});

export default router;
export { enc };
