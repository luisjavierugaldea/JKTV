import { createContext } from './scrapers/browserPool.js';

async function detailedEventsTest() {
    console.log('Test detallado de eventos en tvtvhd.com/eventos/\n');
    
    const context = await createContext();
    const page = await context.newPage();
    
    try {
        await page.goto('https://tvtvhd.com/eventos/', { waitUntil: 'networkidle0', timeout: 30000 });
        
        const data = await page.evaluate(() => {
            const pageText = document.body.innerText;
            const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            
            // Buscar todas las líneas con formato de hora
            const timeLines = lines.filter(l => /^\d{1,2}:\d{2}$/.test(l));
            
            return {
                allLines: lines,
                timeLines: timeLines,
                fullText: pageText.substring(0, 2000)
            };
        });
        
        console.log(`Total de líneas: ${data.allLines.length}`);
        console.log(`\nLíneas con horario encontradas: ${data.timeLines.length}`);
        console.log(`Horarios: ${data.timeLines.join(', ')}\n`);
        
        console.log('Primeras 50 líneas del contenido:\n');
        data.allLines.slice(0, 50).forEach((line, idx) => {
            console.log(`${idx + 1}. ${line}`);
        });
        
        console.log('\n\nTexto completo (primeros 2000 chars):\n');
        console.log(data.fullText);
        
    } finally {
        await context.close();
    }
}

detailedEventsTest().catch(console.error).finally(() => process.exit(0));
