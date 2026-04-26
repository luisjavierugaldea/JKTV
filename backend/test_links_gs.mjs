import { createContext } from './scrapers/browserPool.js';

async function test() {
  const title = "Shrek";
  const context = await createContext();
  const page = await context.newPage();
  const searchUrl = `https://cuevana.gs/?s=${encodeURIComponent(title)}`;
  
  console.log('Navegando a:', searchUrl);
  await page.goto(searchUrl, { waitUntil: 'networkidle' });
  
  const results = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]'))
      .filter(a => (a.href.includes('/pelicula/') || a.href.includes('/serie/')))
      .map(a => ({
        href: a.href,
        text: a.innerText.trim() || a.querySelector('img')?.alt
      }));
  });
  
  console.log('RESULTADOS GS:', JSON.stringify(results, null, 2));
  await context.close();
}

test();
