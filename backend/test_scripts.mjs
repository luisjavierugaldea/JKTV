import { createContext } from './scrapers/browserPool.js';

async function test() {
  const url = "https://cue.cuevana3.nu/peliculas-online/119823/la-momia-de-lee-cronin-online-gratis-en-cuevana";
  const context = await createContext();
  const page = await context.newPage();
  
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  const scripts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('script'))
      .map(s => s.innerHTML)
      .filter(h => h.includes('showEmbed') || h.includes('OptL'));
  });
  
  console.log('SCRIPTS ENCONTRADOS:', scripts.length);
  scripts.forEach((s, i) => {
    console.log(`SCRIPT ${i}:`, s.substring(0, 500));
  });
  
  await context.close();
}

test();
