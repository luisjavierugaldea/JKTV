import { createContext } from './scrapers/browserPool.js';

async function diagnoseChannels() {
    console.log('\n🔍 === DIAGNÓSTICO DE CANALES ===\n');
    
    const context = await createContext();
    const page = await context.newPage();
    
    try {
        await page.goto('https://tvtvhd.com/', {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        console.log('✅ Página cargada\n');
        
        // Extraer estructura de canales
        const channelsData = await page.evaluate(() => {
            const results = {
                totalLinks: 0,
                sampleLinks: [],
                countries: []
            };
            
            // Buscar TODOS los enlaces
            const allLinks = document.querySelectorAll('a[href*="canales.php"]');
            results.totalLinks = allLinks.length;
            
            console.log(`Total de enlaces encontrados: ${allLinks.length}`);
            
            // Tomar muestra de primeros 10 enlaces
            for (let i = 0; i < Math.min(10, allLinks.length); i++) {
                const link = allLinks[i];
                
                results.sampleLinks.push({
                    href: link.href,
                    textContent: link.textContent?.trim(),
                    innerHTML: link.innerHTML,
                    title: link.title,
                    'data-channel': link.getAttribute('data-channel'),
                    'data-name': link.getAttribute('data-name'),
                    className: link.className,
                    outerHTML: link.outerHTML.substring(0, 200)
                });
            }
            
            // Buscar encabezados de países
            const possibleHeaders = document.querySelectorAll('h1, h2, h3, h4, h5, button, [class*="country"], [class*="title"]');
            
            for (const header of possibleHeaders) {
                const text = header.textContent?.trim() || '';
                
                if (text.match(/Argentina|Brasil|Colombia|Chile|México|Perú|Uruguay|España|USA/i)) {
                    results.countries.push({
                        tag: header.tagName,
                        text: text,
                        className: header.className,
                        outerHTML: header.outerHTML.substring(0, 200)
                    });
                    
                    if (results.countries.length >= 5) break;
                }
            }
            
            return results;
        });
        
        console.log('📊 RESULTADOS:\n');
        console.log(`Total de enlaces: ${channelsData.totalLinks}\n`);
        
        console.log('📋 MUESTRA DE ENLACES (primeros 10):');
        channelsData.sampleLinks.forEach((link, idx) => {
            console.log(`\n[${idx + 1}] URL: ${link.href}`);
            console.log(`    textContent: "${link.textContent}"`);
            console.log(`    innerHTML: ${link.innerHTML}`);
            console.log(`    title: ${link.title || 'N/A'}`);
            console.log(`    data-channel: ${link['data-channel'] || 'N/A'}`);
            console.log(`    data-name: ${link['data-name'] || 'N/A'}`);
            console.log(`    className: ${link.className || 'N/A'}`);
            console.log(`    HTML: ${link.outerHTML}`);
        });
        
        console.log('\n\n🌎 ENCABEZADOS DE PAÍSES ENCONTRADOS:');
        channelsData.countries.forEach((country, idx) => {
            console.log(`\n[${idx + 1}] ${country.tag}: "${country.text}"`);
            console.log(`    className: ${country.className || 'N/A'}`);
            console.log(`    HTML: ${country.outerHTML}`);
        });
        
    } finally {
        await context.close();
    }
}

async function diagnoseEvents() {
    console.log('\n\n🔍 === DIAGNÓSTICO DE EVENTOS ===\n');
    
    const context = await createContext();
    const page = await context.newPage();
    
    try {
        await page.goto('https://tvtvhd.com/eventos/', {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        console.log('✅ Página de eventos cargada\n');
        
        const eventsData = await page.evaluate(() => {
            const results = {
                totalLinks: 0,
                allText: '',
                sampleLinks: [],
                structure: []
            };
            
            // Texto completo
            results.allText = document.body.innerText.substring(0, 2000);
            
            // Enlaces de canales
            const allLinks = document.querySelectorAll('a[href*="canales.php"]');
            results.totalLinks = allLinks.length;
            
            // Muestra de enlaces
            for (let i = 0; i < Math.min(10, allLinks.length); i++) {
                const link = allLinks[i];
                
                // Buscar contexto (contenedor padre)
                let container = link.parentElement;
                for (let j = 0; j < 3; j++) {
                    if (container && container.parentElement) {
                        container = container.parentElement;
                    }
                }
                
                results.sampleLinks.push({
                    href: link.href,
                    text: link.textContent?.trim(),
                    innerHTML: link.innerHTML,
                    parentText: link.parentElement?.textContent?.trim(),
                    containerText: container?.textContent?.substring(0, 300),
                    outerHTML: link.outerHTML.substring(0, 200)
                });
            }
            
            // Buscar elementos con horarios
            const timeElements = document.querySelectorAll('*');
            for (const el of timeElements) {
                const text = el.textContent?.trim() || '';
                if (text.match(/^\d{1,2}:\d{2}$/) && results.structure.length < 5) {
                    results.structure.push({
                        time: text,
                        tag: el.tagName,
                        parentHTML: el.parentElement?.outerHTML?.substring(0, 500)
                    });
                }
            }
            
            return results;
        });
        
        console.log('📊 RESULTADOS DE EVENTOS:\n');
        console.log(`Total de enlaces: ${eventsData.totalLinks}\n`);
        
        console.log('📄 TEXTO DE LA PÁGINA (primeros 2000 caracteres):\n');
        console.log(eventsData.allText);
        
        console.log('\n\n📋 MUESTRA DE ENLACES DE CANALES:');
        eventsData.sampleLinks.forEach((link, idx) => {
            console.log(`\n[${idx + 1}] URL: ${link.href}`);
            console.log(`    Texto: "${link.text}"`);
            console.log(`    innerHTML: ${link.innerHTML}`);
            console.log(`    Texto del padre: "${link.parentText}"`);
            console.log(`    Contexto del contenedor: "${link.containerText}"`);
            console.log(`    HTML: ${link.outerHTML}`);
        });
        
        console.log('\n\n⏰ ELEMENTOS CON HORARIOS:');
        eventsData.structure.forEach((item, idx) => {
            console.log(`\n[${idx + 1}] Hora: ${item.time}`);
            console.log(`    Tag: ${item.tag}`);
            console.log(`    HTML del padre:\n${item.parentHTML}`);
        });
        
    } finally {
        await context.close();
    }
}

// Ejecutar ambos diagnósticos
(async () => {
    try {
        await diagnoseChannels();
        await diagnoseEvents();
        console.log('\n\n✅ Diagnóstico completado\n');
    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
    }
})();
