import { createContext } from './scrapers/browserPool.js';

async function test() {
  const context = await createContext();
  const page = await context.newPage();
  await page.goto("https://cue.cuevana3.nu/", { waitUntil: 'networkidle' });
  
  const searchForm = await page.evaluate(() => {
    const form = document.querySelector('form[role="search"], form[action*="s="], form');
    return {
      action: form?.action,
      method: form?.method,
      inputs: Array.from(form?.querySelectorAll('input') || []).map(i => ({ name: i.name, type: i.type, value: i.value }))
    };
  });
  
  console.log('SEARCH FORM:', searchForm);
  await context.close();
}

test();
