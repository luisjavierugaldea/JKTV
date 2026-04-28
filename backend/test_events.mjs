import { createContext } from './scrapers/browserPool.js';

// Test para ver cuántos enlaces de eventos hay en tvtvhd.com/eventos/
async function testEvents() {
    console.log('Analizando página de eventos...\n');
    
    const context = await createContext();
    const page = await context.newPage();
    
    try {
        console.log('Cargando https://tvtvhd.com/eventos/\n');
        await page.goto('https://tvtvhd.com/eventos/', { waitUntil: 'networkidle0', timeout: 30000 });
        
        const data = await page.evaluate(() => {
            const results = {
                totalLinks: 0,
                sampleLinks: [],
                allText: document.body.innerText.substring(0, 1000)
            };
            
            const links = document.querySelectorAll('a[href*="canales.php"]');
            results.totalLinks = links.length;
            
            for (let i = 0; i < Math.min(10, links.length); i++) {
                const link = links[i];
                const urlMatch = link.href.match(/stream=([^&]+)/);
                
                results.sampleLinks.push({
                    href: link.href,
                    streamId: urlMatch ? urlMatch[1] : 'N/A',
                    text: link.textContent?.trim()
                });
            }
            
            return results;
        });
        
        console.log(`Total de enlaces encontrados: ${data.totalLinks}\n`);
        console.log('Muestra de los primeros 10:');
        data.sampleLinks.forEach((item, idx) => {
            console.log(`[${idx + 1}] Stream: ${item.streamId} | URL: ${item.href}`);
        });
        
        console.log('\n\nTexto de la página (primeros 1000 chars):');
        console.log(data.allText);
        
    } finally {
        await context.close();
    }
}

testEvents().catch(console.error).finally(() => process.exit(0));
