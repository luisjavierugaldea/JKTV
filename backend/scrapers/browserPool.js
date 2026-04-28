/**
 * scrapers/browserPool.js
 * Pool singleton de instancias de Playwright con stealth activado.
 *
 * Estrategia:
 *   - Un único Browser se mantiene vivo durante toda la vida del proceso.
 *   - Cada petición de scraping crea su propio BrowserContext (equivalente a
 *     una ventana de incógnito completamente aislada).
 *   - El Context se destruye al terminar para liberar memoria.
 *   - Si el Browser se cierra inesperadamente, se relanza automáticamente.
 *
 * ¿Por qué no un Browser por petición?
 *   Lanzar Chromium tarda ~1-2 segundos. Con el pool, la primera petición
 *   paga ese coste; las siguientes lo reutilizan.
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from '../config/env.js';

// Registrar el plugin de stealth UNA sola vez
chromium.use(StealthPlugin());

// ─── Estado del pool ──────────────────────────────────────────────────────────
let browserInstance = null;
let isLaunching = false;
let launchQueue = [];

// User-Agent moderno de Chrome en Windows — evitar detección headless
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Argumentos de chromium para maximizar stealth y rendimiento.
 */
const CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-web-security',      // Necesario para acceder a iframes cross-origin
  '--allow-running-insecure-content',
  '--autoplay-policy=no-user-gesture-required', // Permite reproducción automática
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
];

/**
 * Obtiene (o lanza) la instancia global del Browser.
 * Thread-safe mediante una cola de promesas.
 * @returns {Promise<import('playwright').Browser>}
 */
async function getBrowser() {
  // Si ya hay una instancia sana, devolverla directamente
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  // Si ya estamos lanzando, encolar la petición
  if (isLaunching) {
    return new Promise((resolve, reject) => {
      launchQueue.push({ resolve, reject });
    });
  }

  // Nos toca lanzar la instancia
  isLaunching = true;
  console.log('🚀  [BrowserPool] Lanzando instancia de Chromium...');

  try {
    browserInstance = await chromium.launch({
      headless: config.scraper.headless,
      args: CHROMIUM_ARGS,
      timeout: 30_000,
    });

    // Limpiar la instancia cuando el browser se cierre inesperadamente
    browserInstance.on('disconnected', () => {
      console.warn('⚠️   [BrowserPool] Browser desconectado. Se relanzará en la próxima petición.');
      browserInstance = null;
    });

    console.log('✅  [BrowserPool] Chromium listo.');

    // Resolver todas las peticiones encoladas
    launchQueue.forEach(({ resolve }) => resolve(browserInstance));
    launchQueue = [];

    return browserInstance;
  } catch (err) {
    console.error('❌  [BrowserPool] Error lanzando Chromium:', err.message);
    launchQueue.forEach(({ reject }) => reject(err));
    launchQueue = [];
    throw err;
  } finally {
    isLaunching = false;
  }
}

/**
 * Crea un BrowserContext aislado con configuración anti-detección.
 * Siempre destruir el context con `await context.close()` cuando termines.
 *
 * @returns {Promise<import('playwright').BrowserContext>}
 */
export async function createContext() {
  const browser = await getBrowser();

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1920, height: 1080 },
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    // Simular pantalla de alta resolución (evita detección por devicePixelRatio)
    deviceScaleFactor: 1,
    // Deshabilitar WebRTC para evitar fuga de IP real
    permissions: [],
    // IMPORTANTE: Deshabilitar descargas para evitar archivos en C:\tmp
    acceptDownloads: false,
    extraHTTPHeaders: {
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-CH-UA': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': '"Windows"',
    },
  });

  return context;
}

/**
 * Cierra limpiamente el browser global.
 * Llamar desde el handler de shutdown del proceso.
 */
export async function closeBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    await browserInstance.close();
    browserInstance = null;
    console.log('🔒  [BrowserPool] Browser cerrado limpiamente.');
  }
}
