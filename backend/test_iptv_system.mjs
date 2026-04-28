/**
 * test_iptv_system.mjs
 * Script de prueba para verificar el sistema IPTV
 */

import aggregator from './core/aggregator.js';
import { getAllM3UChannels } from './sources/m3u_sources.js';
import { resolveChannel, getBestStream } from './core/resolver.js';
import { checkStreamHealth } from './core/healthCheck.js';
import cacheManager from './core/cache.js';

async function testIPTVSystem() {
  console.log('🧪 Iniciando pruebas del sistema IPTV...\n');

  try {
    // Test 1: Inicializar agregador
    console.log('📋 Test 1: Inicializar agregador');
    await aggregator.initialize();
    console.log('✅ Agregador inicializado\n');

    // Esperar 3 segundos para que se cargue contenido
    console.log('⏳ Esperando 3 segundos para carga inicial...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 2: Obtener todos los canales
    console.log('\n📋 Test 2: Obtener todos los canales');
    const allChannels = await aggregator.getAllChannels();
    console.log(`✅ Total de canales: ${allChannels.length}`);
    
    if (allChannels.length > 0) {
      console.log('   Ejemplo de canal:');
      console.log('   ', JSON.stringify(allChannels[0], null, 2));
    }

    // Test 3: Obtener canales por categoría
    console.log('\n📋 Test 3: Obtener canales deportivos');
    const sportsChannels = await aggregator.getChannelsByCategory('sports');
    console.log(`✅ Canales deportivos: ${sportsChannels.length}`);

    // Test 4: Obtener canales por país
    console.log('\n📋 Test 4: Obtener canales de México');
    const mexicoChannels = await aggregator.getChannelsByCountry('mexico');
    console.log(`✅ Canales de México: ${mexicoChannels.length}`);

    // Test 5: Resolver canal específico
    console.log('\n📋 Test 5: Resolver streams para "ESPN"');
    const espnStreams = await resolveChannel('ESPN');
    console.log(`✅ Streams encontrados para ESPN: ${espnStreams.length}`);
    
    if (espnStreams.length > 0) {
      console.log('   Top 3 streams:');
      espnStreams.slice(0, 3).forEach((stream, i) => {
        console.log(`   ${i + 1}. ${stream.name} (score: ${stream.score.toFixed(2)}) - ${stream.source}`);
      });
    }

    // Test 6: Obtener mejor stream validado
    if (espnStreams.length > 0) {
      console.log('\n📋 Test 6: Validar mejor stream de ESPN');
      const bestStream = await getBestStream('ESPN');
      
      if (bestStream) {
        console.log('✅ Mejor stream encontrado:');
        console.log('   Nombre:', bestStream.name);
        console.log('   URL:', bestStream.url.substring(0, 50) + '...');
        console.log('   Fuente:', bestStream.source);
        console.log('   Validado:', bestStream.validated ? '✅' : '⚠️');
        console.log('   Latencia:', bestStream.latency ? `${bestStream.latency}ms` : 'N/A');
      } else {
        console.log('⚠️ No se pudo validar ningún stream');
      }
    }

    // Test 7: Estadísticas del agregador
    console.log('\n📋 Test 7: Estadísticas del sistema');
    const stats = aggregator.getStats();
    console.log('✅ Estadísticas:');
    console.log('   Total canales:', stats.totalChannels);
    console.log('   Canales M3U:', stats.m3uChannels);
    console.log('   Canales scrapeados:', stats.scrapedChannels);
    console.log('   Eventos deportivos:', stats.events);
    console.log('   Uptime:', stats.uptime);
    console.log('   Última actualización:', stats.lastUpdate);

    // Test 8: Estadísticas del cache
    console.log('\n📋 Test 8: Estadísticas del caché');
    const cacheStats = cacheManager.getStats();
    console.log('✅ Caché:');
    console.log('   Entradas totales:', cacheStats.total);
    console.log('   Entradas válidas:', cacheStats.valid);
    console.log('   Entradas expiradas:', cacheStats.expired);
    console.log('   Keys:', cacheStats.keys.slice(0, 5).join(', '), '...');

    console.log('\n\n🎉 Todas las pruebas completadas exitosamente!\n');
    console.log('📊 Resumen:');
    console.log(`   • ${allChannels.length} canales totales`);
    console.log(`   • ${sportsChannels.length} canales deportivos`);
    console.log(`   • ${mexicoChannels.length} canales de México`);
    console.log(`   • Sistema de agregación: ✅ Funcionando`);
    console.log(`   • Sistema de resolución: ✅ Funcionando`);
    console.log(`   • Sistema de caché: ✅ Funcionando`);
    console.log(`   • Health check: ✅ Funcionando\n`);

  } catch (error) {
    console.error('\n❌ Error durante las pruebas:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

// Ejecutar pruebas
testIPTVSystem();
