import { getCuevanaEmbedUrls } from './scrapers/cuevana.js';

(async () => {
  console.log("Probando Cuevana...");
  try {
    const urls = await getCuevanaEmbedUrls({
      title: 'Shrek',
      year: '2001',
      type: 'movie',
      season: 1,
      episode: 1
    });
    console.log("RESULTADO:", urls);
  } catch (err) {
    console.error("ERROR:", err);
  }
  process.exit(0);
})();
