import { createContext } from './scrapers/browserPool.js';

async function test() {
  const context = await createContext();
  const page = await context.newPage();
  const url = "https://cuevana.gs/pelicula/shrek"; // Suposición de URL
  
  console.log('Navegando a:', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'shrek_page_gs.png' });
  
  const html = await page.content();
  console.log('HTML LENGTH:', html.length);
  console.log('Tiene showEmbed?', html.includes('showEmbed'));
  console.log('Tiene player.php?', html.includes('player.php'));
  
  await context.close();
}

test();
