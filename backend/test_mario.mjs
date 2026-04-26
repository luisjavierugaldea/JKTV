import { findMovieUrl, extractEmbeds } from './scrapers/cuevana.js';

async function test() {
  const title = "Super Mario Galaxy";
  console.log(`--- TEST MARIO ---`);
  const url = await findMovieUrl(title, 'movie');
  console.log('URL ENCONTRADA:', url);
  if (url) {
    const embeds = await extractEmbeds(url);
    console.log('RESULTADO EXTRACCION:', JSON.stringify(embeds, null, 2));
  }
}

test();
