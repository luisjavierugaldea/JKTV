import play from 'play-dl';

const info = await play.video_info('https://www.youtube.com/watch?v=a1Femq4NPxs');
const fmt = info.format;

console.log('Total formatos:', fmt.length);
if (fmt.length > 0) {
  // Mostrar primeros 3 formatos completos
  for (let i = 0; i < Math.min(3, fmt.length); i++) {
    const f = fmt[i];
    console.log(`\n--- Formato ${i} ---`);
    console.log('Keys:', Object.keys(f).join(', '));
    console.log('hasAudio:', f.hasAudio);
    console.log('hasVideo:', f.hasVideo);
    console.log('audioBitrate:', f.audioBitrate);
    console.log('mimeType:', f.mimeType);
    console.log('qualityLabel:', f.qualityLabel);
    console.log('url:', f.url ? f.url.substring(0, 60) + '...' : 'NONE');
  }
}
