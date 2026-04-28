import { createContext } from './scrapers/browserPool.js';

async function debugChileChannels() {
    console.log('🔍 Investigando por qué Chile tiene 107 canales...\n');
    
    const context = await createContext();
    const page = await context.newPage();
    
    try {
        await page.goto('https://tvtvhd.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const countryAnalysis = await page.evaluate(() => {
            const results = {
                totalLinks: 0,
                countrySections: []
            };
            
            // Buscar todos los headers que mencionen países
            const possibleCountryHeaders = document.querySelectorAll('h2, h3, h4, div[class*="title"], div[class*="header"], button, a');
            
            const countryNames = ['Argentina', 'Brasil', 'Colombia', 'Chile', 'Ecuador', 'México', 'Perú', 'Uruguay', 'Venezuela', 'España', 'USA'];
            
            for (const header of possibleCountryHeaders) {
                const headerText = header.textContent?.trim() || '';
                
                for (const country of countryNames) {
                    if (headerText.toLowerCase().includes(country.toLowerCase())) {
                        // Contar canales después de este header
                        const searchAreas = [
                            header.nextElementSibling,
                            header.parentElement,
                            header.parentElement?.parentElement
                        ];
                        
                        let channelCount = 0;
                        for (const area of searchAreas) {
                            if (!area) continue;
                            const links = area.querySelectorAll('a[href*="canales.php"]');
                            channelCount = Math.max(channelCount, links.length);
                        }
                        
                        results.countrySections.push({
                            country,
                            headerText: headerText.substring(0, 100),
                            channelsFound: channelCount,
                            elementType: header.tagName
                        });
                        
                        break;
                    }
                }
            }
            
            // Contar total de enlaces
            results.totalLinks = document.querySelectorAll('a[href*="canales.php"]').length;
            
            return results;
        });
        
        console.log(`📊 Total de enlaces en la página: ${countryAnalysis.totalLinks}\n`);
        console.log('📍 Secciones de países encontradas:\n');
        
        const countryGroups = {};
        countryAnalysis.countrySections.forEach(section => {
            if (!countryGroups[section.country]) {
                countryGroups[section.country] = [];
            }
            countryGroups[section.country].push(section);
        });
        
        Object.entries(countryGroups).forEach(([country, sections]) => {
            console.log(`\n🌎 ${country} - ${sections.length} sección(es) encontrada(s):`);
            sections.forEach((s, idx) => {
                console.log(`  [${idx + 1}] Header: "${s.headerText}"`);
                console.log(`      Tipo: ${s.elementType}, Canales: ${s.channelsFound}`);
            });
            const totalChannels = sections.reduce((sum, s) => sum + s.channelsFound, 0);
            console.log(`  ➡️  TOTAL: ${totalChannels} canales`);
        });
        
    } finally {
        await context.close();
    }
}

debugChileChannels().catch(console.error).finally(() => process.exit(0));
