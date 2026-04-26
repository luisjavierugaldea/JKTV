import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const url = 'https://cue.cuevana3.nu/peliculas-online/119708/super-mario-galaxy-la-pelicula-online-gratis-en-cuevana/';
  console.log('Navegando a:', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'mario_screenshot.png' });
  
  const html = await page.content();
  console.log('LENGTH:', html.length);
  if (html.includes('tab_language_movie')) {
      console.log('¡TIENE LAS TABS!');
  } else {
      console.log('NO TIENE TABS');
  }

  await browser.close();
}

run().catch(console.error);
