/**
 * test-scraper.js
 * Script de prueba independiente del scraper.
 * Úsalo para diagnosticar sin necesidad de arrancar todo el servidor.
 *
 * Uso: node test-scraper.js "Inception" 2010
 *      node test-scraper.js "Breaking Bad" --type tv --season 1 --episode 1
 */

import 'dotenv/config';
import { extractStream } from './scrapers/streamExtractor.js';
import { closeBrowser } from './scrapers/browserPool.js';

const title = process.argv[2] ?? 'Inception';
const year  = process.argv[3] ?? '2010';
const type  = process.env.TYPE ?? 'movie';

console.log(`\n${'='.repeat(60)}`);
console.log(`  TEST: "${title}" (${year}) [${type}]`);
console.log(`${'='.repeat(60)}\n`);

const start = Date.now();

try {
  const result = await extractStream({ title, year, type });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ✅  RESULTADO en ${elapsed}s:`);
  console.log(JSON.stringify(result, null, 2));
  console.log(`${'='.repeat(60)}\n`);
} catch (err) {
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.error(`\n${'='.repeat(60)}`);
  console.error(`  ❌  ERROR en ${elapsed}s: ${err.message}`);
  console.error(`${'='.repeat(60)}\n`);
} finally {
  await closeBrowser();
}
