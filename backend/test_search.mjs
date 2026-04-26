import { findMovieUrl } from './scrapers/cuevana.js';

async function test() {
  const title = "La momia de Lee Cronin";
  const url = await findMovieUrl(title, 'movie');
  console.log('RESULTADO BUSQUEDA:', url);
}

test();
