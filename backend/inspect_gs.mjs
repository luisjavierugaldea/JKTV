import axios from 'axios';

async function run() {
  try {
    const r = await axios.get('https://cuevana.gs/pelicula/shrek-2', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    console.log('HTML Length:', r.data.length);
    console.log('Tiene player.php?', r.data.includes('player.php'));
    console.log('Tiene data-tplayernv?', r.data.includes('data-tplayernv'));
    
    const iframeMatch = r.data.match(/<iframe[^>]*src="([^"]+)"/i);
    console.log('Iframe match:', iframeMatch ? iframeMatch[1] : 'NONE');
    
    const tokenMatch = r.data.match(/player\.php\?t=([a-zA-Z0-9]+)/);
    console.log('Token match:', tokenMatch ? tokenMatch[1] : 'NONE');
    
  } catch (e) {
    console.error(e.message);
  }
}

run();
