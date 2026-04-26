/**
 * routes/torrentProxy.js
 * Proxy para convertir magnet links a HTTP streaming
 * WebTorrent solo funciona en Node.js, no en navegadores modernos
 * Con transcodificación FFmpeg (Nativo) para MKV → MP4/HLS
 */
import express from 'express';
import WebTorrent from 'webtorrent';
import pump from 'pump';
import ffmpegStatic from 'ffmpeg-static';
import { execSync } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

let ffmpegPath = ffmpegStatic;
try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
  ffmpegPath = 'ffmpeg';
} catch (e) {
  console.log('[FFmpeg] Binario de sistema no encontrado, usando ffmpeg-static (Modo DEV Local)');
}
ffmpeg.setFfmpegPath(ffmpegPath);

const router = express.Router();

// Cliente WebTorrent global con configuración agresiva para más velocidad
const client = new WebTorrent({
  maxConns: 200,   // Default: 55. Más conexiones = más peers = más velocidad
  dht: true,       // Distributed Hash Table: busca peers sin necesidad de trackers
  tracker: true,
  webSeeds: true,
});

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
  'udp://tracker.moeking.me:6969/announce',
  'udp://tracker.bitsearch.to:1337/announce',
  'udp://explodie.org:6969/announce',
  'udp://tracker.tiny-vps.com:6969/announce',
  'udp://tracker.zerobytes.xyz:1337/announce',
  'wss://tracker.webtorrent.dev',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.files.fm:7073/announce',
  'http://tracker.gbitt.info:80/announce'
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
 * Genera y sirve HLS al vuelo usando FFmpeg para soportar pistas de audio y buffer inteligente
 */
router.get('/hls/:infoHash/:param1/:param2?', async (req, res) => {
  const { infoHash, param1, param2 } = req.params;
  const { magnet } = req.query;

  // Normalizar parámetros para soportar /hls/hash/file y /hls/hash/idx/file
  let fileIdxStr, file;
  if (param2) {
    fileIdxStr = param1;
    file = param2;
  } else {
    file = param1;
    const soMatch = magnet?.match(/[?&]so=(\d+)/i) || req.query.so;
    fileIdxStr = soMatch ? (soMatch[1] || soMatch) : '0';
  }

  const fileIdx = parseInt(fileIdxStr, 10);
  const folderPath = path.join(HLS_DIR, infoHash);
  const filePath = path.join(folderPath, file);

  // Debug State
  console.log(`[HLS] Request: ${file} | Episode: ${fileIdx} | Torrent: ${activeTorrents.has(infoHash)} | FFmpeg: ${activeFfmpeg.has(infoHash)}`);

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
          return res.status(504).json({ error: 'El torrent tardó demasiado en conectar. Prueba otra opción.' });
        }
      } else {
        console.log(`[HLS] 🚀 Creando torrent nuevo: ${infoHash} | Episodio/Archivo: ${fileIdx}`);

        let optimizedMagnet = magnet;
        SUPER_TRACKERS.forEach(tr => {
          if (!optimizedMagnet.includes(encodeURIComponent(tr))) {
            optimizedMagnet += `&tr=${encodeURIComponent(tr)}`;
          }
        });

          const torrentPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            // Limpiar si ya fue agregado pero sin metadata aún
            const existingTorrent = client.get(infoHash);
            if (existingTorrent && !activeTorrents.has(infoHash)) {
              client.remove(infoHash, { destroyStore: true });
            }
            console.error(`[HLS] ⏱️ Timeout 20s para torrent ${infoHash} — Swarm sin peers suficientes.`);
            reject(new Error('Timeout: sin peers en 20 segundos'));
          }, 20000);

          // Verificar si WebTorrent ya tiene este torrent Y ya tiene archivos listos
          const existing = client.get(infoHash);
          if (existing && existing.files && existing.files.length > 0) {
            clearTimeout(timeout);
            activeTorrents.set(infoHash, existing);
            pendingTorrents.delete(infoHash);
            console.log(`[HLS] ♻️ Reutilizando torrent existente: ${infoHash} | Archivos: ${existing.files.length}`);
            // Seleccionar solo el archivo necesario
            existing.files.forEach((f, i) => {
              if (i === fileIdx || fileIdx < 0) f.select();
              else f.deselect();
            });
            return resolve(existing);
          }

          client.add(optimizedMagnet, { destroyStoreOnDestroy: false }, (t) => {
            clearTimeout(timeout);

            // 🎯 CLAVE: Deseleccionar todos los archivos y solo seleccionar el episodio
            // Esto evita que descargue toda la temporada (30-60 GB)
            t.files.forEach((f, i) => {
              if (i === fileIdx || fileIdx < 0) {
                f.select();
                console.log(`[HLS] ✅ Archivo seleccionado [${i}]: ${f.name}`);
              } else {
                f.deselect();
              }
            });

            activeTorrents.set(infoHash, t);
            pendingTorrents.delete(infoHash);

            t.on('wire', (wire) => {
              if (t.numPeers % 5 === 1) { // Log cada 5 peers para no saturar
                console.log(`[HLS] 🔗 Peers: ${t.numPeers}`);
              }
            });

            t.on('destroyed', () => {
              const p = activeFfmpeg.get(infoHash);
              if (p) { p.kill('SIGKILL'); activeFfmpeg.delete(infoHash); }
              if (fs.existsSync(folderPath)) fs.rmSync(folderPath, { recursive: true, force: true });
            });

            console.log(`[HLS] ✅ Torrent listo: ${infoHash} | Peers: ${t.numPeers} | Archivos: ${t.files.length}`);
            resolve(t);
          });
        });

        pendingTorrents.set(infoHash, torrentPromise);

        try {
          torrent = await torrentPromise;
        } catch (err) {
          pendingTorrents.delete(infoHash);
          console.error(`[HLS] ❌ Fallo al inicializar torrent: ${err.message}`);
          return res.status(504).json({ error: 'No se pudo conectar con el Torrent. El enlace puede no tener peers activos. Prueba otra opción de la lista.', details: err.message });
        }
      }
    } else {
      // Torrent ya existe: re-seleccionar el archivo del episodio por si cambió
      if (torrent.files && torrent.files.length > 0) {
        torrent.files.forEach((f, i) => {
          if (i === fileIdx || fileIdx < 0) f.select();
          else f.deselect();
        });
      }
    }


    // --- 2. RESOLVER FFMPEG (Con Lock) ---
    if (!activeFfmpeg.has(infoHash) && !pendingFfmpeg.has(infoHash)) {

      let videoFile;
      if (fileIdx >= 0 && fileIdx < torrent.files.length) {
        videoFile = torrent.files[fileIdx];
        console.log(`[HLS] 🎯 Usando archivo por índice &so=${fileIdx}: ${videoFile.name}`);
      } else {
        // Encontrar el archivo de video MÁS GRANDE (Evitar agarrar trailers o samples)
        const videoFiles = torrent.files
          .filter(f => /\.(mp4|mkv|avi|webm|mov)$/i.test(f.name))
          .sort((a, b) => b.length - a.length);

        videoFile = videoFiles[0]; // El más grande siempre
        console.log(`[HLS] 🔍 Auto-detectando archivo más grande: ${videoFile?.name} (${(videoFile?.length / 1024 / 1024).toFixed(2)} MB)`);
      }

      if (!videoFile) {
        console.error(`[HLS 404] No se encontró video en el torrent ${infoHash}. fileIdx: ${fileIdx}`);
        return res.status(404).json({ error: 'No video file in torrent' });
      }

      if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

      console.log(`[HLS] 🎬 Transcodificando ${videoFile.name} a HLS`);

      // 🎯 TRICK 3: Prioridad crítica al inicio del archivo para que FFmpeg empiece a leer YA
      if (typeof torrent.critical === 'function') {
        const CRITICAL_BYTES = 5 * 1024 * 1024; // 5MB iniciales en prioridad máxima
        torrent.critical(videoFile.offset, videoFile.offset + CRITICAL_BYTES);
        console.log(`[HLS] 🚀 Prioridad crítica en primeros 5MB del episodio`);
      }

      const ffmpegPromise = new Promise((resolve, reject) => {
        const videoStream = videoFile.createReadStream();

        const ffmpegProcess = ffmpeg(videoStream)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-preset ultrafast',
            '-tune zerolatency',       // Minimiza latencia de codificación
            '-crf 28',
            '-map 0:v:0',
            '-map 0:a?',
            '-pix_fmt yuv420p',        // 👈 Asegura compatibilidad de video en todos los navegadores
            '-ac 2',                   // 👈 Forzar audio estéreo (evita cuelgues con 5.1/7.1)
            '-f hls',
            '-hls_time 2',             // Segmentos de 2s (antes 6s) = primer segmento 3x más rápido
            '-hls_init_time 1',        // Primer segmento en 1s
            '-hls_list_size 0',
            '-hls_playlist_type event',
            '-hls_flags independent_segments',
            '-hls_allow_cache 0',
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

    // --- 3. SERVIR EL m3u8 CON POLLING (10 minutos de espera para torrents lentos) ---
    let checks = 0;
    const MAX_CHECKS = 1200; // 10 minutos (500ms * 1200 = 600s)
    const checkInterval = setInterval(() => {
      if (res.destroyed || res.socket?.destroyed) {
        // Cliente cerró la conexión — limpiar sin error
        clearInterval(checkInterval);
        return;
      }
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Asegurarse de que el m3u8 tiene al menos 1 segmento antes de enviarlo
        if (content.includes('.ts')) {
          clearInterval(checkInterval);
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.sendFile(filePath);
        }
      }
      if (checks % 30 === 0 && checks > 0) { // Log cada 15 segundos
        console.log(`[HLS] ⏳ Esperando segmento 1... (${checks / 2}s)`);
      }
      if (checks > MAX_CHECKS) {
        clearInterval(checkInterval);
        if (!res.headersSent) res.status(504).json({ error: 'Timeout: El torrent es demasiado lento. Prueba otra opción.' });
      }
      checks++;
    }, 500);

    return;
  }

  // --- SERVIR FRAGMENTOS (.ts) u otros archivos ---
  if (fs.existsSync(filePath)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (file === 'master.m3u8') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    res.sendFile(filePath);
  } else {
    console.error(`[HLS 404] Archivo no encontrado: ${filePath} (URL: ${req.originalUrl})`);
    res.status(404).end();
  }
});

/**
 * GET /api/torrent/warmup/:infoHash?magnet=...&fileIdx=N
 * Pre-calienta el swarm del torrent en segundo plano.
 * El frontend lo llama en cuanto ve las opciones de stream (antes de que el usuario presione Play).
 */
router.get('/warmup/:infoHash', async (req, res) => {
  const { infoHash } = req.params;
  const { magnet, fileIdx: fileIdxStr } = req.query;
  const fileIdx = fileIdxStr ? parseInt(fileIdxStr, 10) : -1;

  // Responder inmediatamente para no bloquear al cliente
  res.json({ status: 'warming', infoHash });

  // Si ya está en memoria, solo re-seleccionar el archivo
  if (activeTorrents.has(infoHash)) {
    const t = activeTorrents.get(infoHash);
    if (t.files?.length > 0 && fileIdx >= 0) {
      t.files.forEach((f, i) => { if (i === fileIdx) f.select(); else f.deselect(); });
      console.log(`[Warmup] ♻️ Torrent ya caliente: ${infoHash} | Peers: ${t.numPeers}`);
    }
    return;
  }

  if (pendingTorrents.has(infoHash)) return; // Ya está conectando
  if (!magnet) return;

  console.log(`[Warmup] 🔥 Pre-calentando: ${infoHash} | fileIdx: ${fileIdx}`);

  let optimizedMagnet = magnet;
  SUPER_TRACKERS.forEach(tr => {
    if (!optimizedMagnet.includes(encodeURIComponent(tr))) {
      optimizedMagnet += `&tr=${encodeURIComponent(tr)}`;
    }
  });

  const warmupPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.warn(`[Warmup] ⏱️ Sin peers en 90s: ${infoHash}`);
      reject(new Error('Timeout'));
    }, 90000);

    const existing = client.get(infoHash);
    if (existing && existing.files?.length > 0) {
      clearTimeout(timeout);
      activeTorrents.set(infoHash, existing);
      if (fileIdx >= 0) existing.files.forEach((f, i) => { if (i === fileIdx) f.select(); else f.deselect(); });
      return resolve(existing);
    }

    client.add(optimizedMagnet, { destroyStoreOnDestroy: false, announce: SUPER_TRACKERS }, (t) => {
      clearTimeout(timeout);
      activeTorrents.set(infoHash, t);

      // Seleccionar solo el archivo del episodio para no desperdiciar ancho de banda
      if (t.files?.length > 0 && fileIdx >= 0) {
        t.files.forEach((f, i) => { if (i === fileIdx) f.select(); else f.deselect(); });
        console.log(`[Warmup] ✅ Listo: ${t.files[fileIdx]?.name} | Peers: ${t.numPeers}`);
      } else {
        console.log(`[Warmup] ✅ Torrent listo: ${infoHash} | Archivos: ${t.files.length} | Peers: ${t.numPeers}`);
      }

      // Priorizar los primeros 5MB para arranque rápido
      if (typeof t.critical === 'function' && t.files[fileIdx]?.offset !== undefined) {
        const file = t.files[fileIdx] || t.files[0];
        t.critical(file.offset, file.offset + 5 * 1024 * 1024);
      }

      t.on('destroyed', () => {
        activeTorrents.delete(infoHash);
        const p = activeFfmpeg.get(infoHash);
        if (p) { p.kill('SIGKILL'); activeFfmpeg.delete(infoHash); }
      });

      resolve(t);
    });
  });

  pendingTorrents.set(infoHash, warmupPromise);
  try { await warmupPromise; } catch (e) { } finally { pendingTorrents.delete(infoHash); }
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
          // 🎯 TRICK 2: Inyectar announce list directamente en client.add()
          client.add(optimizedMagnet, { destroyStoreOnDestroy: false, announce: SUPER_TRACKERS }, (t) => {
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

    // Parse &so= (Selected Option / File Index) from magnet link
    const soMatch = magnet.match(/[?&]so=(\d+)/i) || req.query.so;
    const fileIdx = soMatch ? parseInt(soMatch[1] || soMatch, 10) : -1;

    let videoFile;
    if (fileIdx >= 0 && fileIdx < torrent.files.length) {
      videoFile = torrent.files[fileIdx];
    } else {
      const videoFiles = torrent.files
        .filter(f => /\.(mp4|mkv|avi|webm|mov)$/i.test(f.name))
        .sort((a, b) => b.length - a.length);
      videoFile = videoFiles[0];
    }

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
        const file_size = videoFile.length;

        // 🔥 TRICK 1: Forzar chunks de 5MB máximo para que WebTorrent priorice piezas pequeñas
        const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
        const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + CHUNK_SIZE, file_size - 1);
        const chunksize = (end - start) + 1;

        // 🎯 TRICK 3: Prioridad crítica en el chunk actual
        if (typeof torrent.critical === 'function') {
          torrent.critical(videoFile.offset + start, videoFile.offset + end);
        }

        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${file_size}`);
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