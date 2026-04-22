/**
 * test-cuevana.js
 * Prueba rápida del scraper de Cuevana:
 *   1. Slugifica el título.
 *   2. Carga la página con Playwright y extrae el token.
 *   3. Imprime las URLs de todos los servidores Latino.
 *   4. Intenta extraer el stream real del primer servidor.
 *
 * Uso: node test-cuevana.js
 */

import 'dotenv/config';
import { slugify, getCuevanaEmbedUrls, LATINO_SERVERS } from './scrapers/cuevana.js';

// ── Película de prueba ────────────────────────────────────────────────────────
const TEST = {
  title: 'Super Mario Galaxy la película',
  year:  '2026',
  type:  'movie',
};

console.log('\n🌮  TEST CUEVANA SCRAPER\n');
console.log(`  Título : ${TEST.title}`);
console.log(`  Año    : ${TEST.year}`);
console.log(`  Slug   : ${slugify(TEST.title, TEST.year)}`);
console.log(`  Servidores que se probarán: ${LATINO_SERVERS.join(', ')}\n`);

const embeds = await getCuevanaEmbedUrls(TEST);

if (embeds.length === 0) {
  console.error('\n❌  No se obtuvieron URLs. Verifica el slug o si la película está en cuevana.gs.\n');
  process.exit(1);
}

console.log(`\n✅  ${embeds.length} URLs construidas:\n`);
for (const e of embeds) {
  console.log(`  [${e.id}] ${e.embedUrl}`);
}

// ── Intentar extraer stream real del primer servidor ─────────────────────────
console.log('\n⏳  Intentando extraer stream del primer servidor…\n');

const { trySourceExtraction } = await import('./scrapers/streamExtractor.js');
// trySourceExtraction no es export — importar desde el extractor directamente
// En su lugar, usamos waitForStreamUrl manualmente desde cuevana
// (Si prefieres, comenta el bloque siguiente y solo verifica las URLs)

import { createContext } from './scrapers/browserPool.js';

const first = embeds[0];
console.log(`  → ${first.embedUrl}\n`);

let context = null;
try {
  context = await createContext();
  const page = await context.newPage();

  const streamUrl = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 30_000);
    page.on('request', (req) => {
      const u = req.url();
      if (/\.m3u8|\.mp4/i.test(u)) { clearTimeout(timer); resolve(u); }
    });
    page.on('response', async (res) => {
      try {
        const u = res.url();
        const ct = res.headers()['content-type'] ?? '';
        if (/\.m3u8|\.mp4/i.test(u)) { clearTimeout(timer); resolve(u); return; }
        if (ct.includes('json') || ct.includes('javascript')) {
          const body = await res.text().catch(() => '');
          const m = body.match(/https?:\/\/[^\s"'\\]+(?:\.m3u8|\.mp4)(?:\?[^\s"'\\]*)?/i);
          if (m) { clearTimeout(timer); resolve(m[0]); }
        }
      } catch { /* ignorar */ }
    });
    page.goto(first.embedUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
    setTimeout(() => { try { page.mouse.click(640, 360); } catch { /* ignorar */ } }, 3000);
  });

  if (streamUrl) {
    console.log(`\n  🎯  STREAM ENCONTRADO:\n     ${streamUrl}\n`);
  } else {
    console.log(`\n  ⚠️  No se detectó stream en 30s para el servidor: ${first.id}\n`);
    console.log('     Prueba abrir la URL manualmente en el navegador:\n');
    console.log(`     ${first.embedUrl}\n`);
  }
} finally {
  if (context) await context.close().catch(() => {});
  process.exit(0);
}
