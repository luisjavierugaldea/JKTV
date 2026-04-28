import { createContext } from './scrapers/browserPool.js';

// Test para buscar canales dentro de cada evento en tvtvhd.com/eventos/
async function testEventChannels() {
    console.log('🔍 Buscando canales dentro de eventos...\n');
    
    const context = await createContext();
    const page = await context.newPage();
    
    try {
        console.log('Cargando https://tvtvhd.com/eventos/\n');
        await page.goto('https://tvtvhd.com/eventos/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        
        const data = await page.evaluate(() => {
            const results = {
                totalLinks: 0,
                eventBlocks: [],
                htmlSample: ''
            };
            
            // Buscar todos los enlaces que contengan canales.php
            const allLinks = document.querySelectorAll('a[href*="canales.php"]');
            results.totalLinks = allLinks.length;
            
            // Intentar encontrar bloques de eventos
            const possibleEvents = document.querySelectorAll('[class*="event"], [class*="partido"], [class*="game"], div[class*="card"]');
            
            if (possibleEvents.length === 0) {
                // Si no hay bloques obvios, buscar patrones en el HTML
                results.htmlSample = document.body.innerHTML.substring(0, 3000);
            } else {
                possibleEvents.forEach((block, idx) => {
                    if (idx < 5) { // Solo los primeros 5
                        const blockLinks = block.querySelectorAll('a[href*="canales.php"]');
                        results.eventBlocks.push({
                            html: block.outerHTML.substring(0, 500),
                            linksCount: blockLinks.length,
                            links: Array.from(blockLinks).slice(0, 5).map(l => {
                                const urlMatch = l.href.match(/stream=([^&]+)/);
                                return {
                                    stream: urlMatch ? urlMatch[1] : 'N/A',
                                    text: l.textContent?.trim() || 'Sin texto',
                                    href: l.href
                                };
                            })
                        });
                    }
                });
            }
            
            // Buscar todos los enlaces en la página
            if (allLinks.length > 0) {
                results.allLinksGrouped = [];
                let currentGroup = { links: [], context: '' };
                
                allLinks.forEach((link, idx) => {
                    const urlMatch = link.href.match(/stream=([^&]+)/);
                    const streamId = urlMatch ? urlMatch[1] : 'N/A';
                    
                    // Buscar contexto (texto antes del enlace)
                    let context = '';
                    let prev = link.previousSibling;
                    while (prev && context.length < 100) {
                        if (prev.textContent) {
                            context = prev.textContent.trim() + ' ' + context;
                        }
                        prev = prev.previousSibling;
                    }
                    
                    // Si el contexto cambia significativamente, es un nuevo grupo
                    if (context.includes(':') && context !== currentGroup.context) {
                        if (currentGroup.links.length > 0) {
                            results.allLinksGrouped.push({...currentGroup});
                        }
                        currentGroup = { links: [], context };
                    }
                    
                    currentGroup.links.push({
                        stream: streamId,
                        text: link.textContent?.trim() || 'Link',
                        href: link.href
                    });
                });
                
                if (currentGroup.links.length > 0) {
                    results.allLinksGrouped.push(currentGroup);
                }
            }
            
            return results;
        });
        
        console.log(`📊 Total de enlaces: ${data.totalLinks}\n`);
        
        if (data.eventBlocks.length > 0) {
            console.log('📦 Bloques de eventos encontrados:\n');
            data.eventBlocks.forEach((block, idx) => {
                console.log(`[Bloque ${idx + 1}] ${block.linksCount} enlaces:`);
                block.links.forEach(l => {
                    console.log(`  - ${l.stream}: ${l.text}`);
                });
                console.log('');
            });
        }
        
        if (data.allLinksGrouped && data.allLinksGrouped.length > 0) {
            console.log('\n🔗 Enlaces agrupados por contexto:\n');
            data.allLinksGrouped.forEach((group, idx) => {
                console.log(`[Grupo ${idx + 1}] Contexto: "${group.context.substring(0, 100)}"`);
                console.log(`Canales (${group.links.length}):`);
                group.links.forEach(l => {
                    console.log(`  - ${l.stream} (${l.text})`);
                });
                console.log('');
            });
        }
        
        if (data.htmlSample) {
            console.log('\n📄 Muestra del HTML:\n');
            console.log(data.htmlSample);
        }
        
    } finally {
        await context.close();
    }
}

testEventChannels().catch(console.error).finally(() => process.exit(0));
