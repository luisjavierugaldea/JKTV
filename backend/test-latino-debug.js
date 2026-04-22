/**
 * test-latino-debug.js
 * Abre los embeds interactivos con headless:false y vuelca TODOS
 * los elementos que podrían ser controles de idioma/servidor.
 *
 * Uso: node test-latino-debug.js
 */

import 'dotenv/config';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

// ── Película de prueba: Inception (tmdbId bien conocido) ─────────────────────
const TMDB_ID = '27205';

const TEST_SOURCES = [
  { id: 'vidlink',       url: `https://vidlink.pro/movie/${TMDB_ID}?primaryLang=es` },
  { id: 'multiembed',   url: `https://multiembed.mov/?video_id=${TMDB_ID}&tmdb=1` },
  { id: 'vidsrc_to',    url: `https://vidsrc.to/embed/movie/${TMDB_ID}` },
  { id: 'autoembed',    url: `https://autoembed.co/movie/tmdb/${TMDB_ID}?lang=es` },
];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Selectores candidatos para paneles de idioma/servidor ────────────────────
const DUMP_SELECTOR =
  'li, button, span, div, a, [role="tab"], [role="option"], [role="menuitem"], ' +
  '[data-lang], [data-id], [class*="lang"], [class*="server"], [class*="tab"], ' +
  '[class*="source"], [class*="quality"], [class*="mirror"]';

console.log('\n🔬  DEBUG MODO LATINO — Chromium visible + slowMo\n');

const browser = await chromium.launch({
  headless: false,
  slowMo: 150,
  args: [
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-web-security',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

for (const source of TEST_SOURCES) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📍  [${source.id}] → ${source.url}`);
  console.log(`${'═'.repeat(70)}`);

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1920, height: 1080 },
    locale: 'es-MX',
    extraHTTPHeaders: { 'Accept-Language': 'es-ES,es;q=0.9' },
  });
  await context.addCookies([
    { name: 'lang',        value: 'es',    domain: new URL(source.url).hostname, path: '/' },
    { name: 'language',    value: 'es-MX', domain: new URL(source.url).hostname, path: '/' },
  ]);

  const page = await context.newPage();

  try {
    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 20_000 });

    // Esperar que el JS cargue el reproductor
    await page.waitForTimeout(4_000);

    // Clic en el centro para activar el player
    await page.mouse.click(960, 540);
    await page.waitForTimeout(2_000);

    // ── Inspeccionar TODOS los frames ─────────────────────────────────────
    const allFrames = [page.mainFrame(), ...page.frames()];
    console.log(`\n  📋  Frames detectados: ${allFrames.length}`);
    for (const f of allFrames) {
      console.log(`       → ${f.url().substring(0, 100)}`);
    }

    // ── Por cada frame, volcar elementos candidatos ───────────────────────
    for (const frame of allFrames) {
      const frameUrl = frame.url();
      if (!frameUrl || frameUrl === 'about:blank') continue;

      let elements;
      try {
        elements = await frame.evaluate((sel) => {
          return Array.from(document.querySelectorAll(sel))
            .filter((e) => {
              const text = (e.innerText ?? e.textContent ?? '').trim();
              // Solo elementos con texto corto (etiquetas, no párrafos)
              return text.length > 0 && text.length < 80;
            })
            .slice(0, 80) // Limitar output
            .map((e) => ({
              tag:       e.tagName,
              text:      (e.innerText ?? e.textContent ?? '').trim().substring(0, 60),
              id:        e.id || null,
              classes:   e.className?.substring?.(0, 80) || null,
              dataLang:  e.dataset?.lang  || null,
              dataId:    e.dataset?.id    || null,
              role:      e.getAttribute('role') || null,
              visible:   e.offsetParent !== null || e.offsetWidth > 0,
            }));
        }, DUMP_SELECTOR);
      } catch {
        console.log(`  ⚠️   No se pudo evaluar frame: ${frameUrl.substring(0, 60)}`);
        continue;
      }

      if (!elements || elements.length === 0) {
        console.log(`\n  [Frame: ${frameUrl.substring(0, 60)}] — Sin elementos candidatos`);
        continue;
      }

      console.log(`\n  ┌─ Frame: ${frameUrl.substring(0, 70)}`);
      console.log(`  │  ${elements.length} elementos encontrados:`);

      // Resaltar candidatos de idioma/servidor
      const LANG_RE    = /latin|latino|español|spanish|ingles|english|sub|dub|lang|idioma/i;
      const SERVER_RE  = /filemoon|streamwish|vidhide|voesx|netu|vimeos|dood|server|mirror|source/i;

      for (const el of elements) {
        const isLang   = LANG_RE.test(el.text) || LANG_RE.test(el.classes) || LANG_RE.test(el.dataLang);
        const isServer = SERVER_RE.test(el.text) || SERVER_RE.test(el.classes);
        const prefix   = isLang ? '  🌎 ' : isServer ? '  🖥️ ' : '     ';
        if (isLang || isServer) {
          console.log(`${prefix}[${el.tag}] "${el.text}" | id="${el.id}" | class="${el.classes}" | data-lang="${el.dataLang}" | data-id="${el.dataId}" | role="${el.role}" | visible=${el.visible}`);
        }
      }

      // Si no hay matches relevantes, mostrar todos igualmente para no perderse nada
      const hasRelevant = elements.some((e) =>
        LANG_RE.test(e.text) || SERVER_RE.test(e.text) ||
        LANG_RE.test(e.classes) || SERVER_RE.test(e.classes)
      );
      if (!hasRelevant) {
        console.log('  │  (sin candidatos de idioma/servidor — mostrando primeros 20):');
        elements.slice(0, 20).forEach((e) =>
          console.log(`       [${e.tag}] "${e.text}" | class="${e.classes}" | visible=${e.visible}`)
        );
      }
      console.log('  └─────────────────────────────────────────────────');
    }

    // Esperar para inspección visual
    console.log('\n  ⏳  Esperando 6s para inspección visual...');
    await page.waitForTimeout(6_000);

  } catch (err) {
    console.log(`  ❌  Error: ${err.message}`);
  }

  await context.close();
}

await browser.close();
console.log('\n✅  Debug completado.\n');
