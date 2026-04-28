import { createContext } from './scrapers/browserPool.js';

// Script simple para extraer 5 enlaces de canales y ver su estructura
async function quickTest() {
    console.log('Extrayendo muestra de canales...\n');
    
    const context = await createContext();
    const page = await context.newPage();
    
    try {
        await page.goto('https://tvtvhd.com/', { waitUntil: 'networkidle0', timeout: 30000 });
        
        const sample = await page.evaluate(() => {
            const links = document.querySelectorAll('a[href*="canales.php"]');
            const results = [];
            
            for (let i = 0; i < Math.min(5, links.length); i++) {
                const link = links[i];
                results.push({
                    text: link.textContent?.trim(),
                    innerHTML: link.innerHTML,
                    href: link.href
                });
            }
            
            return results;
        });
        
        console.log('=== PRIMEROS 5 ENLACES ===\n');
        sample.forEach((item, idx) => {
            console.log(`[${idx + 1}]`);
            console.log(`  Texto: "${item.text}"`);
            console.log(`  HTML: ${item.innerHTML}`);
            console.log(`  URL: ${item.href}\n`);
        });
        
    } finally {
        await context.close();
    }
}

quickTest().catch(console.error).finally(() => process.exit(0));
