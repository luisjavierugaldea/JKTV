import { Router } from 'express';
import ytSearch from 'yt-search';
import play from 'play-dl';

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

// 2. Ruta para OBTENER el audio directo
router.get('/play/:videoId', async (req, res) => {
    try {
        const videoId = req.params.videoId;
        if (!videoId) return res.status(400).json({ error: 'videoId requerido' });

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        console.log(`[Music] 🎵 Obteniendo audio para: ${videoId}`);

        const info = await play.video_info(videoUrl);
        const allFormats = info.format || [];
        console.log(`[Music] 📦 Formatos disponibles: ${allFormats.length}`);

        // Los formatos de audio puro tienen mimeType = "audio/..." y NO tienen qualityLabel
        const audioOnly = allFormats.filter(f =>
            f.mimeType && f.mimeType.startsWith('audio/') && f.url
        );

        // Fallback: formatos combinados video+audio (tienen qualityLabel y bitrate de audio)
        const combined = allFormats.filter(f =>
            f.mimeType && f.mimeType.startsWith('video/') && 
            f.audioQuality && f.url  // audioQuality = "AUDIO_QUALITY_LOW/MEDIUM/HIGH"
        );

        const candidates = audioOnly.length > 0 ? audioOnly : combined;

        if (!candidates.length) {
            console.warn(`[Music] ⚠️ Sin formatos de audio para: ${videoId}`);
            return res.status(404).json({ success: false, error: 'No se encontró audio para este video.' });
        }

        // Para audio puro: ordenar por bitrate mayor primero
        // Para combinados: los 360p suelen tener mejor compatibilidad
        const best = audioOnly.length > 0
            ? candidates.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]
            : candidates.find(f => f.qualityLabel === '360p') || candidates[0];

        console.log(`[Music] ✅ Audio listo — bitrate: ${best.audioBitrate || '?'}kbps, tipo: ${best.mimeType || '?'}`);
        res.json({ success: true, audioUrl: best.url, bitrate: best.audioBitrate, mime: best.mimeType });

    } catch (error) {
        console.error('[Music] ❌ Play error:', error.message);
        res.status(500).json({ success: false, error: 'Error extrayendo audio: ' + error.message });
    }
});

export default router;
