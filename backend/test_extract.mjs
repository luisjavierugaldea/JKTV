import { extractEmbeds } from './scrapers/cuevana.js';

async function test() {
  const url = "https://cue.cuevana3.nu/peliculas-online/119823/la-momia-de-lee-cronin-online-gratis-en-cuevana";
  const result = await extractEmbeds(url);
  console.log('RESULTADO EXTRACCION:', JSON.stringify(result, null, 2));
}

test();
