import { createContext } from './scrapers/browserPool.js';

async function test() {
  const context = await createContext();
  const page = await context.newPage();
  const searchUrl = "https://cuevana.gs/?s=Shrek";
  
  await page.goto(searchUrl, { waitUntil: 'networkidle' });
  
  const allLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({ href: a.href, text: a.innerText }));
  });
  
  console.log('ALL LINKS COUNT:', allLinks.length);
  console.log('SAMPLE LINKS:', JSON.stringify(allLinks.slice(0, 50), null, 2));
  
  await context.close();
}

test();
