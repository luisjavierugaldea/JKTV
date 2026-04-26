import { createContext } from './scrapers/browserPool.js';

async function test() {
  const title = "La momia de Lee Cronin";
  const context = await createContext();
  const page = await context.newPage();
  const searchUrl = `https://cue.cuevana3.nu/?s=${encodeURIComponent(title)}`;
  
  console.log('Navegando a:', searchUrl);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  const results = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]'))
      .filter(a => a.href.includes('/peliculas-online/') && /\/\d+\//.test(a.href))
      .map(a => ({
        href: a.href,
        text: a.innerText.trim(),
        html: a.innerHTML
      }));
  });
  
  console.log('RESULTADOS ENCONTRADOS:', JSON.stringify(results, null, 2));
  await context.close();
}

test();
