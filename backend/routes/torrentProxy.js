/**
 * routes/torrentProxy.js
 * Proxy para convertir magnet links a HTTP streaming
 * WebTorrent solo funciona en Node.js, no en navegadores modernos
 */
import express from 'express';
import WebTorrent from 'webtorrent';
import pump from 'pump';

const router = express.Router();

// Cliente WebTorrent global (reutilizable)
const client = new WebTorrent();

// Mapa de torrents activos (para evitar duplicados)
const activeTorrents = new Map();

/**
 * GET /api/torrent/stream?magnet=magnet:?xt=urn:btih:...
 * 
 * Descarga el torrent y sirve el archivo de video más grande como HTTP stream
 */
router.get('/stream', async (req, res) => {
  const { magnet } = req.query;

  if (!magnet || !magnet.startsWith('magnet:')) {
    return res.status(400).json({ error: 'Magnet link inválido' });
  }

  try {
    console.log('[TorrentProxy] 🧲 Nueva petición de torrent');
    
    // Extraer infoHash del magnet
    const infoHashMatch = magnet.match(/urn:btih:([a-f0-9]{40})/i);
    if (!infoHashMatch) {
      return res.status(400).json({ error: 'No se pudo extraer infoHash' });
    }
    const infoHash = infoHashMatch[1].toLowerCase();

    // Si el torrent ya está activo, reutilizarlo
    let torrent = activeTorrents.get(infoHash);
    
    if (!torrent) {
      console.log(`[TorrentProxy] Agregando nuevo torrent: ${infoHash}`);
      
      // Agregar torrent con timeout
      torrent = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout al conectar con peers (30s)'));
        }, 30000);

        client.add(magnet, { destroyStoreOnDestroy: false }, (t) => {
          clearTimeout(timeout);
          console.log(`[TorrentProxy] ✅ Torrent agregado: ${t.name}`);
          activeTorrents.set(infoHash, t);
          resolve(t);
        });
      });
    } else {
      console.log(`[TorrentProxy] ♻️ Reutilizando torrent existente: ${torrent.name}`);
    }

    // Buscar el archivo de video más grande
    const videoFile = torrent.files
      .filter(f => /\.(mp4|mkv|avi|webm|mov)$/i.test(f.name))
      .sort((a, b) => b.length - a.length)[0];

    if (!videoFile) {
      return res.status(404).json({ error: 'No se encontró archivo de video en el torrent' });
    }

    console.log(`[TorrentProxy] 📹 Archivo: ${videoFile.name} (${(videoFile.length / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`[TorrentProxy] 👥 Peers: ${torrent.numPeers}, Descargado: ${(torrent.progress * 100).toFixed(1)}%`);

    // Headers para streaming
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', videoFile.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Soporte para Range requests (seek en el video)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : videoFile.length - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${videoFile.length}`);
      res.setHeader('Content-Length', chunksize);

      const stream = videoFile.createReadStream({ start, end });
      pump(stream, res);
    } else {
      // Sin range, enviar todo el archivo
      const stream = videoFile.createReadStream();
      pump(stream, res);
    }

    // Limpiar torrent después de 10 minutos sin uso
    const cleanupTimer = setTimeout(() => {
      if (torrent.numPeers === 0) {
        console.log(`[TorrentProxy] 🗑️ Limpiando torrent inactivo: ${infoHash}`);
        torrent.destroy();
        activeTorrents.delete(infoHash);
      }
    }, 10 * 60 * 1000);

    res.on('close', () => {
      console.log('[TorrentProxy] Cliente desconectado');
      clearTimeout(cleanupTimer);
    });

  } catch (error) {
    console.error('[TorrentProxy] ❌ Error:', error);
    res.status(500).json({ 
      error: 'Error al procesar torrent',
      details: error.message 
    });
  }
});

/**
 * GET /api/torrent/info?magnet=...
 * Obtiene información del torrent sin descargarlo completo
 */
router.get('/info', async (req, res) => {
  const { magnet } = req.query;

  if (!magnet || !magnet.startsWith('magnet:')) {
    return res.status(400).json({ error: 'Magnet link inválido' });
  }

  try {
    const infoHashMatch = magnet.match(/urn:btih:([a-f0-9]{40})/i);
    if (!infoHashMatch) {
      return res.status(400).json({ error: 'No se pudo extraer infoHash' });
    }
    const infoHash = infoHashMatch[1].toLowerCase();

    let torrent = activeTorrents.get(infoHash);

    if (!torrent) {
      torrent = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout al obtener metadata'));
        }, 15000);

        client.add(magnet, { destroyStoreOnDestroy: false }, (t) => {
          clearTimeout(timeout);
          activeTorrents.set(infoHash, t);
          resolve(t);
        });
      });
    }

    const videoFile = torrent.files
      .filter(f => /\.(mp4|mkv|avi|webm|mov)$/i.test(f.name))
      .sort((a, b) => b.length - a.length)[0];

    res.json({
      name: torrent.name,
      size: torrent.length,
      progress: (torrent.progress * 100).toFixed(1),
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      peers: torrent.numPeers,
      videoFile: videoFile ? {
        name: videoFile.name,
        size: videoFile.length,
        sizeMB: (videoFile.length / 1024 / 1024).toFixed(2)
      } : null
    });

  } catch (error) {
    console.error('[TorrentProxy] Error en info:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
