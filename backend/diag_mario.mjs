/**
 * Diagnóstico: Qué devuelve player.php de cuevana.gs
 */
import { findMovieUrl, extractEmbeds } from './scrapers/cuevana.js';
import axios from 'axios';

async function diagnoseMario() {
  console.log('=== DIAGNÓSTICO MARIO ===\n');
  
  // 1. Buscar la película
  const url = await findMovieUrl('Super Mario Galaxy', 'movie');
  console.log('1. URL encontrada:', url);
  if (!url) { console.log('ERROR: No se encontró la película'); process.exit(1); }

  // 2. Extraer embeds
  const result = await extractEmbeds(url, 35_000);
  console.log('\n2. Resultado extracción:', JSON.stringify(result, null, 2));

  if (result.type === 'token' && result.token) {
    // 3. Probar directamente el player.php con diferentes servidores
    const servers = ['goodstream', 'vimeos', 'hlswish', 'voe', 'netu'];
    for (const server of servers) {
      const playerUrl = `${result.base}/player.php?t=${result.token}&server=${server}`;
      console.log(`\n3. Probando: ${playerUrl.substring(0, 80)}...`);
      try {
        const resp = await axios.get(playerUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': result.base,
          },
          timeout: 10_000
        });
        const body = resp.data;
        // Buscar si hay una URL de video
        const videoMatch = body.match(/https?:\/\/[^\s"'<>]+\.(m3u8|mp4|mkv)[^\s"'<>]*/g);
        const iframeMatch = body.match(/src=["']([^"']*goodstream[^"']*)["']/);
        const jwMatch = body.match(/file:\s*["']([^"']+)["']/);
        const sourceMatch = body.match(/sources?:\s*\[([^\]]+)\]/);
        
        console.log(`   Status: ${resp.status}`);
        console.log(`   Tamaño HTML: ${body.length} bytes`);
        console.log(`   URLs de video: ${videoMatch ? videoMatch.slice(0,3).join(', ') : 'ninguna'}`);
        console.log(`   iframe goodstream: ${iframeMatch ? iframeMatch[1] : 'no'}`);
        console.log(`   JW file: ${jwMatch ? jwMatch[1] : 'no'}`);
        console.log(`   Sources: ${sourceMatch ? sourceMatch[0].substring(0, 100) : 'no'}`);
        
        // Si es pequeño, mostrar el HTML completo
        if (body.length < 2000) {
          console.log(`   HTML completo:\n${body}`);
        }
      } catch (e) {
        console.log(`   ERROR: ${e.message}`);
      }
    }
  }

  if (result.type === 'embeds' && result.embeds.length > 0) {
    console.log('\n3. Embeds directos encontrados:');
    for (const e of result.embeds) {
      console.log(`   URL: ${e.directUrl}`);
    }
  }
}

diagnoseMario().catch(console.error);
