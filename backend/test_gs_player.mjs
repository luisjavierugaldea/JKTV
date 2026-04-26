import { createContext } from './scrapers/browserPool.js';

async function test() {
  const context = await createContext();
  const page = await context.newPage();
  const url = "https://cuevana.gs/pelicula/shrek-2";
  
  console.log('Navegando a:', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  
  // Buscar el botón de Latino
  const latinoBtn = await page.$('.dooplay_player_option[data-type="latino"], .dooplay_player_option:has-text("Latino")');
  if (latinoBtn) {
    console.log('Haciendo click en Latino...');
    await latinoBtn.click();
    await page.waitForTimeout(2000);
  } else {
    console.log('No se encontró botón Latino, intentando click en el Play central...');
    const playBtn = await page.$('.play-video, .play-button');
    if (playBtn) await playBtn.click();
    await page.waitForTimeout(2000);
  }
  
  await page.screenshot({ path: 'shrek_play_gs.png' });
  const html = await page.content();
  console.log('Iframe src:', await page.evaluate(() => document.querySelector('iframe')?.src));
  
  await context.close();
}

test();
