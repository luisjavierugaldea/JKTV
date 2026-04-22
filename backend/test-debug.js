/**
 * test-debug.js
 * Modo debug con headless=false para VER en pantalla qué hace el scraper.
 * Abre una ventana de Chromium visible y navega al embed para diagnóstico.
 *
 * Uso: node test-debug.js
 */

import 'dotenv/config';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// URLs a diagnosticar — estas son las mismas que usa el scraper para TMDB ID 27205 (Inception)
const TEST_URLS = [
  'https://vidsrc.me/embed/movie?tmdb=27205',
  'https://vidsrc.to/embed/movie/27205',
  'https://embed.su/embed/movie/27205',
  'https://autoembed.co/movie/tmdb/27205',
  'https://multiembed.mov/?video_id=27205&tmdb=1',
];

const STREAM_URL_REGEX = /https?:\/\/[^\s"'\\]+(?:\.m3u8|\.mp4|\.mpd)(?:\?[^\s"'\\]*)?/i;
const JSON_STREAM_REGEX = /https?:\/\/[^\s"'\\]+(?:\.m3u8|\.mp4|\.mpd)(?:\?[^\s"'\\]*)?/gi;

console.log('\n🔬 MODO DEBUG — Chromium visible\n');

const browser = await chromium.launch({
  headless: false,  // ← VISIBLE para diagnóstico
  slowMo: 200,
  args: [
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-web-security',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

for (const embedUrl of TEST_URLS) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📍  Probando: ${embedUrl}`);

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();
  const foundUrls = new Set();

  // Interceptar requests
  page.on('request', (req) => {
    const url = req.url();
    if (STREAM_URL_REGEX.test(url)) {
      foundUrls.add(url);
      console.log(`  🎯  [REQUEST] ${url.substring(0, 120)}`);
    }
  });

  // Interceptar responses
  page.on('response', async (res) => {
    try {
      const url = res.url();
      const ct = res.headers()['content-type'] ?? '';

      if (STREAM_URL_REGEX.test(url)) {
        foundUrls.add(url);
        console.log(`  🎯  [RESPONSE URL] ${url.substring(0, 120)}`);
        return;
      }

      if (ct.includes('json') || ct.includes('javascript') || ct.includes('text/plain')) {
        const body = await res.text().catch(() => '');
        const matches = body.match(JSON_STREAM_REGEX);
        if (matches) {
          matches.forEach((m) => {
            foundUrls.add(m);
            console.log(`  📡  [JSON BODY] ${m.substring(0, 120)}`);
          });
        }
      }
    } catch { /* ignorar */ }
  });

  try {
    await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.waitForTimeout(2000);
    await page.mouse.click(960, 540);
    await page.waitForTimeout(8000); // Esperar 8s para ver qué carga
  } catch (err) {
    console.log(`  ⚠️   Error de navegación: ${err.message}`);
  }

  if (foundUrls.size > 0) {
    console.log(`\n  ✅  URLs de stream encontradas:`);
    foundUrls.forEach((u) => console.log(`     → ${u}`));
  } else {
    console.log(`  ❌  No se encontraron streams en esta fuente.`);
    
    // Mostrar todos los iframes que tiene la página
    const frames = page.frames();
    console.log(`  📋  Frames detectados (${frames.length}):`);
    frames.forEach((f) => console.log(`     → ${f.url()}`));
  }

  await context.close();

  // Preguntar si continuar con la siguiente fuente
  console.log(`\n  ⏳  Esperando 2s antes de la siguiente fuente...`);
  await new Promise((r) => setTimeout(r, 2000));
}

await browser.close();
console.log('\n✅  Diagnóstico completado.\n');
