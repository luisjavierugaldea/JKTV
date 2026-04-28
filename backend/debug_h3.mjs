import { createContext } from './scrapers/browserPool.js';

async function debugH3Structure() {
    console.log('🔍 Analizando estructura de H3 en tvtvhd.com...\n');
    
    const context = await createContext();
    const page = await context.newPage();
    
    try {
        await page.goto('https://tvtvhd.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const h3Analysis = await page.evaluate(() => {
            const allH3 = document.querySelectorAll('h3');
            const results = [];
            
            allH3.forEach((h3, idx) => {
                const text = h3.textContent?.trim() || '';
                const nextSibling = h3.nextElementSibling;
                const nextSiblingTag = nextSibling ? nextSibling.tagName : 'NULL';
                const linksInNext = nextSibling ? nextSibling.querySelectorAll('a[href*="canales.php"]').length : 0;
                
                results.push({
                    index: idx,
                    text: text.substring(0, 100),
                    nextSiblingTag,
                    linksInNext,
                    html: h3.outerHTML.substring(0, 200)
                });
            });
            
            return results;
        });
        
        console.log(`📊 Total H3 encontrados: ${h3Analysis.length}\n`);
        
        h3Analysis.forEach(h3 => {
            console.log(`[${h3.index}] "${h3.text}"`);
            console.log(`    Siguiente: <${h3.nextSiblingTag}> con ${h3.linksInNext} canales`);
            console.log(`    HTML: ${h3.html}`);
            console.log('');
        });
        
    } finally {
        await context.close();
    }
}

debugH3Structure().catch(console.error).finally(() => process.exit(0));
