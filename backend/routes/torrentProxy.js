/**
 * routes/torrentProxy.js
 * Proxy para convertir magnet links a HTTP streaming
 * WebTorrent solo funciona en Node.js, no en navegadores modernos
 * Con transcodificación FFmpeg (ffmpeg-static) para MKV → MP4
 */
import express from 'express';
import WebTorrent from 'webtorrent';
import pump from 'pump';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static'; 
import { spawn } from 'child_process';

// Asignar el binario de FFmpeg a fluent-ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

const router = express.Router();

// Cliente WebTorrent global (reutilizable)
const client = new WebTorrent();

// 🛑 AIRBAG: Evitar que WebTorrent tumbe el servidor si falla un nodo
client.on('error', (err) => {
  console.error('[WebTorrent Global Error] ⚠️:', err.message);
});

// 🚀 SÚPER TRACKERS: Inyectar esto asegura que WebTorrent encuentre peers rápido
const SUPER_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://exodus.desync.com:6969/announce',
  'wss://tracker.webtorrent.dev',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.files.fm:7073/announce'
];

// Mapa de torrents activos (para evitar duplicados)
const activeTorrents = new Map();

/**
 * GET /api/torrent/stream?magnet=magnet:?xt=urn:btih:...
 * * Descarga el torrent y sirve el archivo de video más grande como HTTP stream
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
      
      // 💉 Inyectar Súper Trackers al magnet link original
      let optimizedMagnet = magnet;
      SUPER_TRACKERS.forEach(tr => {
        if (!optimizedMagnet.includes(encodeURIComponent(tr))) {
          optimizedMagnet += `&tr=${encodeURIComponent(tr)}`;
        }
      });

      // Agregar torrent con timeout extendido a 45s
      torrent = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout al conectar con peers (45s)'));
        }, 45000);

        try {
          client.add(optimizedMagnet, { destroyStoreOnDestroy: false }, (t) => {
            clearTimeout(timeout);
            console.log(`[TorrentProxy] ✅ Torrent agregado: ${t.name}`);
            activeTorrents.set(infoHash, t);
            resolve(t);
          });
        } catch (addError) {
          clearTimeout(timeout);
          reject(addError);
        }
      });
      
      torrent.on('error', (err) => {
        console.error(`[TorrentProxy] Error en torrent ${infoHash}:`, err.message);
      });
      
    } else {
      console.log(`[TorrentProxy] ♻️ Reutilizando torrent existente: ${torrent.name}`);
    }

    // Buscar el archivo de video más grande (Dando prioridad leve a MP4 si existe)
    const videoFiles = torrent.files.filter(f => /\.(mp4|mkv|avi|webm|mov)$/i.test(f.name));
    const videoFile = videoFiles.find(f => f.name.endsWith('.mp4')) || 
                      videoFiles.sort((a, b) => b.length - a.length)[0];

    if (!videoFile) {
      return res.status(404).json({ error: 'No se encontró archivo de video en el torrent' });
    }

    console.log(`[TorrentProxy] 📹 Archivo: ${videoFile.name} (${(videoFile.length / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`[TorrentProxy] 👥 Peers: ${torrent.numPeers}, Descargado: ${(torrent.progress * 100).toFixed(1)}%`);

    // Detectar si necesita transcodificación (MKV, AVI, MOV → MP4)
    const needsTranscoding = /\.(mkv|avi|mov)$/i.test(videoFile.name);
    
    if (needsTranscoding) {
      console.log(`[TorrentProxy] 🎬 Transcodificando ${videoFile.name} → MP4 Fragmentado`);
      
      // Headers para streaming MP4 al vuelo
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'none'); // FFmpeg streaming no soporta saltos (seek) precisos
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Transfer-Encoding', 'chunked');

      // Crear stream del archivo del torrent
      const videoStream = videoFile.createReadStream();

      // FFmpeg transcoding: MKV → MP4 (h264 + aac)
      const ffmpegProcess = ffmpeg(videoStream)
        .videoCodec('libx264')          // H.264 video
        .audioCodec('aac')              // AAC audio
        .outputOptions([
          '-preset ultrafast',          // Máxima velocidad de CPU
          '-crf 28',                    // Calidad media aceptable
          '-movflags frag_keyframe+empty_moov', 
          '-max_muxing_queue_size 1024', 
          '-tune zerolatency'           // Empezar a transmitir inmediatamente
        ])
        .format('mp4')                  // Formato de salida para web
        .on('start', (cmd) => {
          console.log(`[FFmpeg] Comando iniciado... (Esperando frames)`);
        })
        .on('error', (err) => {
          // Ignorar el error inofensivo de cuando cierras la pestaña o cambias de video
          if (err.message.includes('Output stream closed') || err.message.includes('SIGKILL')) {
            console.log('[FFmpeg] 🛑 Transmisión detenida por el usuario.');
            return;
          }
          console.error('[FFmpeg] ❌ Error de conversión:', err.message);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Error al transcodificar video', details: err.message });
          }
        })
        .on('end', () => {
          console.log('[FFmpeg] ✅ Transcodificación completada');
        });

      // Enviar la salida de FFmpeg directo a la pestaña del navegador
      ffmpegProcess.pipe(res, { end: true });

      res.on('close', () => {
        console.log('[TorrentProxy] Cliente desconectado, matando proceso FFmpeg...');
        ffmpegProcess.kill('SIGKILL');
      });

    } else {
      // MP4 directo sin transcodificar (muy rápido)
      console.log(`[TorrentProxy] 📹 Sirviendo MP4 directo (sin transcodificar)`);
      
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', videoFile.length);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');

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
        const stream = videoFile.createReadStream();
        pump(stream, res);
      }

      res.on('close', () => {
        console.log('[TorrentProxy] Cliente MP4 directo desconectado');
      });
    }

    // Limpiar torrent después de 10 minutos sin uso
    const cleanupTimer = setTimeout(() => {
      if (torrent.numPeers === 0) {
        console.log(`[TorrentProxy] 🗑️ Limpiando torrent inactivo: ${infoHash}`);
        torrent.destroy();
        activeTorrents.delete(infoHash);
      }
    }, 10 * 60 * 1000);

  } catch (error) {
    console.error('[TorrentProxy] ❌ Error de bloque Catch:', error.message);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Error interno en el proxy',
        details: error.message 
      });
    }
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
      // 💉 Inyectar Súper Trackers también aquí por si acaso
      let optimizedMagnet = magnet;
      SUPER_TRACKERS.forEach(tr => {
        if (!optimizedMagnet.includes(encodeURIComponent(tr))) {
          optimizedMagnet += `&tr=${encodeURIComponent(tr)}`;
        }
      });

      torrent = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout al obtener metadata'));
        }, 15000);

        try {
          client.add(optimizedMagnet, { destroyStoreOnDestroy: false }, (t) => {
            clearTimeout(timeout);
            activeTorrents.set(infoHash, t);
            resolve(t);
          });
        } catch (addError) {
          clearTimeout(timeout);
          reject(addError);
        }
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
    console.error('[TorrentProxy] Error en info:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;