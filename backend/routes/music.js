import { Router } from 'express';
import ytSearch from 'yt-search';
import youtubedl from 'youtube-dl-exec';
import axios from 'axios';

const router = Router();

// 1. Ruta para BUSCAR música
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Query es requerido' });

        console.log(`[Music] 🔍 Buscando: "${query}"`);
        const result = await ytSearch(query);

        const songs = result.videos.slice(0, 20).map(video => ({
            id: video.videoId,
            title: video.title,
            artist: video.author.name,
            duration: video.timestamp,
            durationSeconds: video.seconds,
            thumbnail: video.thumbnail,
        }));

        console.log(`[Music] ✅ ${songs.length} resultados para "${query}"`);
        res.json({ success: true, songs });
    } catch (error) {
        console.error('[Music] ❌ Search error:', error.message);
        res.status(500).json({ success: false, error: 'Error buscando música: ' + error.message });
    }
});

// 2. STREAM de audio — extraemos la URL real con yt-dlp y la proxeamos
router.get('/stream/:videoId', async (req, res) => {
    try {
        const videoId = req.params.videoId;
        if (!videoId) return res.status(400).json({ error: 'videoId requerido' });

        console.log(`[Music] 🎵 Resolviendo stream: ${videoId}`);
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // Obtener metadatos en JSON usando yt-dlp (la herramienta más robusta del mercado)
        const info = await youtubedl(videoUrl, {
            dumpJson: true,
            noWarnings: true,
            format: 'bestaudio/best', // Pedir explícitamente el mejor audio
        });

        if (!info || !info.url) {
            return res.status(404).json({ success: false, error: 'No se encontró audio.' });
        }

        console.log(`[Music] ✅ URL extraída. Iniciando proxy...`);

        const rangeHeader = req.headers['range'];
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
            'Referer': 'https://www.youtube.com/',
        };
        if (rangeHeader) headers['Range'] = rangeHeader;

        // Proxeamos el stream a través de nuestro backend
        const upstreamRes = await axios.get(info.url, {
            headers,
            responseType: 'stream',
            timeout: 30000,
        });

        res.setHeader('Content-Type', upstreamRes.headers['content-type'] || 'audio/webm');
        if (upstreamRes.headers['content-length']) res.setHeader('Content-Length', upstreamRes.headers['content-length']);
        if (upstreamRes.headers['content-range']) res.setHeader('Content-Range', upstreamRes.headers['content-range']);
        if (upstreamRes.headers['accept-ranges']) res.setHeader('Accept-Ranges', upstreamRes.headers['accept-ranges']);

        res.status(upstreamRes.status);
        upstreamRes.data.pipe(res);

        upstreamRes.data.on('error', (err) => {
            console.error(`[Music] ❌ Stream error: ${err.message}`);
        });

    } catch (error) {
        console.error('[Music] ❌ Error en el stream:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Error procesando audio: ' + error.message });
        }
    }
});

export default router;
