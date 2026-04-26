import { findMovieUrl, extractEmbeds } from './scrapers/cuevana.js';

async function test() {
  const title = "Shrek";
  const url = await findMovieUrl(title, 'movie');
  console.log('URL ENCONTRADA:', url);
  if (url) {
    const result = await extractEmbeds(url);
    console.log('RESULTADO EXTRACCION:', JSON.stringify(result, null, 2));
  }
}

test();
