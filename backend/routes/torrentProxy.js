/**
 * routes/torrentProxy.js
 * Proxy para convertir magnet links a HTTP streaming
 * WebTorrent solo funciona en Node.js, no en navegadores modernos
 * Con transcodificación FFmpeg (ffmpeg-static) para MKV → MP4/HLS
 */
import express from 'express';
import WebTorrent from 'webtorrent';
import pump from 'pump';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

// --- SISTEMA DE ESTADOS Y LOCKS ---
const activeTorrents = new Map();
const pendingTorrents = new Map(); // 👈 LOCK para evitar Torrents duplicados

const activeFfmpeg = new Map();
const pendingFfmpeg = new Map();   // 👈 LOCK para evitar FFmpeg duplicados

// Directorio temporal para HLS
const HLS_DIR = path.join(os.tmpdir(), 'jktv_hls');
if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

/**
 * GET /api/torrent/hls/:infoHash/:file
 * * Genera y sirve HLS al vuelo usando FFmpeg para soportar pistas de audio y buffer inteligente
 */
router.get('/hls/:infoHash/:file', async (req, res) => {
  const { infoHash, file } = req.params;
  const { magnet } = req.query;

  const folderPath = path.join(HLS_DIR, infoHash);
  const filePath = path.join(folderPath, file);

  // Debug State
  console.log(`[HLS] Request: ${file} | Torrent: ${activeTorrents.has(infoHash)} | PendT: ${pendingTorrents.has(infoHash)} | FFmpeg: ${activeFfmpeg.has(infoHash)} | PendF: ${pendingFfmpeg.has(infoHash)}`);

  if (file === 'master.m3u8') {

    // --- 1. RESOLVER TORRENT (Con Lock) ---
    let torrent = activeTorrents.get(infoHash);

    if (!torrent) {
      if (!magnet) return res.status(400).json({ error: 'Magnet link requerido para inicializar HLS' });

      if (pendingTorrents.has(infoHash)) {
        console.log(`[HLS] ⏳ Esperando torrent en progreso: ${infoHash}`);
        try {
          torrent = await pendingTorrents.get(infoHash);
        } catch (e) {
          return res.status(500).json({ error: 'Error al esperar torrent' });
        }
      } else {
        console.log(`[HLS] 🚀 Creando torrent nuevo: ${infoHash}`);

        let optimizedMagnet = magnet;
        SUPER_TRACKERS.forEach(tr => {
          if (!optimizedMagnet.includes(encodeURIComponent(tr))) {
            optimizedMagnet += `&tr=${encodeURIComponent(tr)}`;
          }
        });

        const torrentPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout 45s')), 45000);
          client.add(optimizedMagnet, { destroyStoreOnDestroy: false }, (t) => {
            clearTimeout(timeout);
            activeTorrents.set(infoHash, t);
            pendingTorrents.delete(infoHash);

            t.on('destroyed', () => {
              const p = activeFfmpeg.get(infoHash);
              if (p) {
                p.kill('SIGKILL');
                activeFfmpeg.delete(infoHash);
              }
              if (fs.existsSync(folderPath)) fs.rmSync(folderPath, { recursive: true, force: true });
            });

            console.log(`[HLS] ✅ Torrent listo: ${infoHash}`);
            resolve(t);
          });
        });

        pendingTorrents.set(infoHash, torrentPromise);

        try {
          torrent = await torrentPromise;
        } catch (err) {
          pendingTorrents.delete(infoHash);
          return res.status(500).json({ error: 'Error al conectar torrent', details: err.message });
        }
      }
    }

    // --- 2. RESOLVER FFMPEG (Con Lock) ---
    if (!activeFfmpeg.has(infoHash) && !pendingFfmpeg.has(infoHash)) {

      const videoFile = torrent.files
        .filter(f => /\.(mp4|mkv|avi|webm|mov)$/i.test(f.name))
        .sort((a, b) => b.length - a.length)[0];

      if (!videoFile) return res.status(404).json({ error: 'No video file' });

      if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

      console.log(`[HLS] 🎬 Transcodificando ${videoFile.name} a HLS`);

      const ffmpegPromise = new Promise((resolve, reject) => {
        const videoStream = videoFile.createReadStream();

        const ffmpegProcess = ffmpeg(videoStream)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-preset ultrafast',
            '-crf 28',
            '-map 0:v:0',
            '-map 0:a?',
            '-f hls',
            '-hls_time 6',
            '-hls_list_size 0',
            '-hls_flags independent_segments',
            '-hls_segment_filename', path.join(folderPath, 'seg_%03d.ts').replace(/\\/g, '/')
          ])
          .output(filePath)
          .on('start', () => {
            console.log(`[FFmpeg HLS] Proceso iniciado`);
            activeFfmpeg.set(infoHash, ffmpegProcess);
            resolve(ffmpegProcess);
          })
          .on('error', (err) => {
            if (err.message.includes('SIGKILL') || err.message.includes('Output stream closed')) return;
            console.error('[FFmpeg HLS] ❌ Error:', err.message);
            activeFfmpeg.delete(infoHash);
            pendingFfmpeg.delete(infoHash);
          })
          .on('end', () => {
            console.log('[FFmpeg HLS] ✅ Completado');
            activeFfmpeg.delete(infoHash);
          });

        ffmpegProcess.run();
      });

      pendingFfmpeg.set(infoHash, ffmpegPromise);

      try {
        await ffmpegPromise;
      } catch (e) {
        console.error("Fallo al iniciar FFmpeg", e);
      } finally {
        pendingFfmpeg.delete(infoHash);
      }

      // Programar limpieza del torrent
      setTimeout(() => {
        if (torrent.numPeers === 0) {
          console.log(`[HLS] 🗑️ Limpiando torrent inactivo: ${infoHash}`);
          torrent.destroy();
          activeTorrents.delete(infoHash);
        }
      }, 10 * 60 * 1000);
    } else if (pendingFfmpeg.has(infoHash)) {
      console.log(`[HLS] ⏳ Esperando inicio de FFmpeg...`);
      try {
        await pendingFfmpeg.get(infoHash);
      } catch (e) { }
    }

    // --- 3. SERVIR EL ARCHIVO CON POLLING SEGURO ---
    let checks = 0;
    const checkInterval = setInterval(() => {
      if (fs.existsSync(filePath)) {
        clearInterval(checkInterval);
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.sendFile(filePath);
      }
      if (checks > 120) { // 60s
        clearInterval(checkInterval);
        if (!res.headersSent) res.status(500).json({ error: 'Timeout esperando generación de m3u8' });
      }
      checks++;
    }, 500);

    return;
  }

  // --- SERVIR FRAGMENTOS (.ts) u otros archivos ---
  if (fs.existsSync(filePath)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(filePath);
  } else {
    res.status(404).end();
  }
});

/**
 * GET /api/torrent/stream?magnet=...
 */
router.get('/stream', async (req, res) => {
  const { magnet } = req.query;
  if (!magnet || !magnet.startsWith('magnet:')) return res.status(400).json({ error: 'Magnet link inválido' });

  try {
    const infoHashMatch = magnet.match(/urn:btih:([a-f0-9]{40})/i);
    if (!infoHashMatch) return res.status(400).json({ error: 'No se pudo extraer infoHash' });
    const infoHash = infoHashMatch[1].toLowerCase();

    let torrent = activeTorrents.get(infoHash);

    if (!torrent) {
      if (pendingTorrents.has(infoHash)) {
        torrent = await pendingTorrents.get(infoHash);
      } else {
        let optimizedMagnet = magnet;
        SUPER_TRACKERS.forEach(tr => {
          if (!optimizedMagnet.includes(encodeURIComponent(tr))) {
            optimizedMagnet += `&tr=${encodeURIComponent(tr)}`;
          }
        });

        const torrentPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout al conectar con peers (45s)')), 45000);
          client.add(optimizedMagnet, { destroyStoreOnDestroy: false }, (t) => {
            clearTimeout(timeout);
            activeTorrents.set(infoHash, t);
            pendingTorrents.delete(infoHash);
            resolve(t);
          });
        });

        pendingTorrents.set(infoHash, torrentPromise);

        try {
          torrent = await torrentPromise;
        } catch (e) {
          pendingTorrents.delete(infoHash);
          return res.status(500).json({ error: "Fallo descarga", details: e.message });
        }
      }
    }

    const videoFiles = torrent.files.filter(f => /\.(mp4|mkv|avi|webm|mov)$/i.test(f.name));
    const videoFile = videoFiles.find(f => f.name.endsWith('.mp4')) || videoFiles.sort((a, b) => b.length - a.length)[0];

    if (!videoFile) return res.status(404).json({ error: 'No se encontró archivo de video' });

    // Detectar si necesita transcodificación, a menos que el cliente pida el archivo crudo (raw=true)
    const wantsRaw = req.query.raw === 'true';
    const needsTranscoding = /\.(mkv|avi|mov)$/i.test(videoFile.name) && !wantsRaw; // 👈 Si es raw, esto será false y apagará FFmpeg

    if (needsTranscoding) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'none');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Transfer-Encoding', 'chunked');

      const videoStream = videoFile.createReadStream();
      const ffmpegProcess = ffmpeg(videoStream)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset ultrafast',
          '-crf 28',
          '-movflags frag_keyframe+empty_moov',
          '-max_muxing_queue_size 1024',
          '-tune zerolatency'
        ])
        .format('mp4')
        .on('error', (err) => {
          if (err.message.includes('Output stream closed') || err.message.includes('SIGKILL')) return;
          if (!res.headersSent) res.status(500).json({ error: 'Error al transcodificar', details: err.message });
        });

      ffmpegProcess.pipe(res, { end: true });
      res.on('close', () => ffmpegProcess.kill('SIGKILL'));

    } else {
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
        pump(videoFile.createReadStream({ start, end }), res);
      } else {
        pump(videoFile.createReadStream(), res);
      }
    }

  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: 'Error interno', details: error.message });
  }
});

router.get('/info', async (req, res) => {
  // ... (Tu código actual de /info se mantiene igual)
  const { magnet } = req.query;
  if (!magnet || !magnet.startsWith('magnet:')) return res.status(400).json({ error: 'Magnet link inválido' });
  try {
    const infoHashMatch = magnet.match(/urn:btih:([a-f0-9]{40})/i);
    if (!infoHashMatch) return res.status(400).json({ error: 'No infoHash' });
    const infoHash = infoHashMatch[1].toLowerCase();
    let torrent = activeTorrents.get(infoHash);
    if (!torrent) return res.json({ status: "pending" }); // Simplificado para no cargar más
    res.json({ name: torrent.name, progress: torrent.progress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;