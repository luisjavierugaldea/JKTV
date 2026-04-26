import { createContext } from './scrapers/browserPool.js';

async function test() {
  const context = await createContext();
  const page = await context.newPage();
  const searchUrl = "https://cuevana.gs/?s=Shrek";
  
  console.log('Navegando a:', searchUrl);
  const resp = await page.goto(searchUrl, { waitUntil: 'networkidle' });
  console.log('STATUS:', resp.status());
  await page.screenshot({ path: 'shrek_search_gs.png' });
  
  const html = await page.content();
  console.log('HTML LENGTH:', html.length);
  
  await context.close();
}

test();
