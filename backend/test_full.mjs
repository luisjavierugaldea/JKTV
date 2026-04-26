import { getCuevanaEmbedUrls } from './scrapers/cuevana.js';

async function test() {
  console.log('=== TEST COMPLETO getCuevanaEmbedUrls ===\n');
  const servers = await getCuevanaEmbedUrls({
    title: 'Super Mario Galaxy',
    originalTitle: 'The Super Mario Galaxy Movie',
    year: 2026,
    type: 'movie'
  });
  console.log('\n=== RESULTADO FINAL ===');
  console.log(JSON.stringify(servers, null, 2));
}

test().catch(console.error);
