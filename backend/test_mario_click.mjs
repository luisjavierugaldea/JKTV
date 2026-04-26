import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Bloquear recursos que no necesitamos
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'font', 'stylesheet', 'media'].includes(type)) return route.abort();
    return route.continue();
  });

  const url = 'https://cue.cuevana3.nu/peliculas-online/119708/super-mario-galaxy-la-pelicula-online-gratis-en-cuevana/';
  console.log('Navegando a:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  // Esperar a que los tabs de idiomas carguen
  try {
    await page.waitForSelector('.tab_language_movie', { timeout: 10000 });
    console.log('Tabs de lenguajes cargados.');
  } catch (e) {
    console.log('Timeout esperando tabs');
  }

  // Interceptar la petición POST al WP-JSON o AJAX que devuelve el iframe
  const embeds = [];
  page.on('response', async (resp) => {
    if (resp.url().includes('admin-ajax.php') || resp.url().includes('wp-json')) {
      try {
        const text = await resp.text();
        // Si la respuesta incluye un showEmbed
        const match = text.match(/showEmbed=([A-Za-z0-9+/=]+)/);
        if (match) {
          const decoded = atob(match[1]);
          console.log('Embed decodificado de AJAX:', decoded);
          embeds.push(decoded);
        }
      } catch (e) {}
    }
  });

  // Buscar el iframe actual
  const iframeSrc = await page.evaluate(() => {
    const iframe = document.querySelector('iframe[src*="showEmbed"]');
    return iframe ? iframe.getAttribute('src') : null;
  });

  if (iframeSrc) {
    const match = iframeSrc.match(/showEmbed=([A-Za-z0-9+/=]+)/);
    if (match) {
      console.log('Embed decodificado del DOM inicial:', atob(match[1]));
      embeds.push(atob(match[1]));
    }
  }

  // Hacer click en cada opción de servidor para forzar la carga del iframe
  const options = await page.$$('li[data-tplayernv]');
  console.log(`Haciendo click en ${options.length} servidores...`);
  
  for (const opt of options) {
    try {
      await opt.click();
      await page.waitForTimeout(500); // Esperar a que responda el AJAX
    } catch (e) {}
  }

  console.log('Todos los embeds extraídos:', [...new Set(embeds)]);
  await browser.close();
}

run().catch(console.error);
