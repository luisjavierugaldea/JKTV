import { createContext } from './scrapers/browserPool.js';

async function debugAccordionStructure() {
    console.log('🔍 Analizando estructura de acordeón en tvtvhd.com...\n');
    
    const context = await createContext();
    const page = await context.newPage();
    
    try {
        await page.goto('https://tvtvhd.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const structure = await page.evaluate(() => {
            const results = [];
            
            // Buscar H3 de países y su contenedor padre
            const h3List = document.querySelectorAll('h3.item-game');
            
            h3List.forEach((h3, idx) => {
                const text = h3.textContent?.trim();
                const parent = h3.parentElement;
                const grandparent = parent?.parentElement;
                
                // Buscar canales en el padre o abuelo
                let channelsInParent = 0;
                let channelsInGrandparent = 0;
                let parentClass = parent ? parent.className : '';
                let grandparentClass = grandparent ? grandparent.className : '';
                
                if (parent) {
                    channelsInParent = parent.querySelectorAll('a[href*="canales.php"]').length;
                }
                if (grandparent) {
                    channelsInGrandparent = grandparent.querySelectorAll('a[href*="canales.php"]').length;
                }
                
                // Buscar en hermanos siguientes del padre
                let channelsInNextParentSibling = 0;
                if (parent?.nextElementSibling) {
                    channelsInNextParentSibling = parent.nextElementSibling.querySelectorAll('a[href*="canales.php"]').length;
                }
                
                results.push({
                    index: idx,
                    text,
                    parentTag: parent ? parent.tagName : 'NULL',
                    parentClass,
                    channelsInParent,
                    grandparentTag: grandparent ? grandparent.tagName : 'NULL',
                    grandparentClass,
                    channelsInGrandparent,
                    channelsInNextParentSibling,
                    parentHTML: parent ? parent.outerHTML.substring(0, 300) : ''
                });
            });
            
            return results;
        });
        
        console.log(`📊 Estructura de ${structure.length} secciones:\n`);
        
        structure.forEach(s => {
            if (s.text.match(/ARGENTINA|CHILE|PERU|COLOMBIA|MEXICO|USA|BRASIL|ESPAÑA/)) {
                console.log(`\n🌎 [${s.index}] ${s.text}`);
                console.log(`   Padre: <${s.parentTag}> class="${s.parentClass}"`);
                console.log(`   Canales en padre: ${s.channelsInParent}`);
                console.log(`   Abuelo: <${s.grandparentTag}> class="${s.grandparentClass}"`);
                console.log(`   Canales en abuelo: ${s.channelsInGrandparent}`);
                console.log(`   Canales en hermano siguiente del padre: ${s.channelsInNextParentSibling}`);
                console.log(`   HTML padre: ${s.parentHTML}`);
            }
        });
        
    } finally {
        await context.close();
    }
}

debugAccordionStructure().catch(console.error).finally(() => process.exit(0));
