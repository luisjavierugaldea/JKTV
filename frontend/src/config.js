/**
 * config.js
 * Configuración del entorno de JKTV
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  MODE = 'dev'    → Pruebas en tu PC (navegador)            │
 * │  MODE = 'apk'    → APK de celular (WiFi local)             │
 * │  MODE = 'prod'   → Producción (backend en Render.com)      │
 * └─────────────────────────────────────────────────────────────┘
 */

// 🎯 CAMBIA AQUÍ ANTES DE COMPILAR
const MODE = 'prod';

// IP de tu PC en la red WiFi (solo necesaria para MODE='apk')
// Mírala con: ipconfig → Adaptador WiFi → Dirección IPv4
const PC_IP = '192.168.10.209'; // 👈 actualizar si cambia

const config = {
  dev: {
    // Detecta automáticamente el hostname desde el navegador
    // Funciona en localhost y en la simulación de Chrome DevTools
    backendURL: `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3001/api`,
    description: 'Desarrollo Local — Auto-detect',
  },
  apk: {
    // IP fija de tu PC para cuando el APK corre en el celular real
    // El celular necesita conectarse al mismo WiFi que tu PC
    backendURL: `http://${PC_IP}:3001/api`,
    description: `APK Local — Backend en ${PC_IP}`,
  },
  prod: {
    // Backend desplegado en Railway (accesible desde internet)
    backendURL: 'https://jktv-production.up.railway.app/api',
    description: 'Producción — Backend',
  },
};

export const API_BASE_URL = config[MODE].backendURL;
export const ENV_MODE = MODE;
export const ENV_DESCRIPTION = config[MODE].description;

// Log visible en consola del navegador/APK para depuración
console.log(`🌐 JKTV - Modo: ${MODE.toUpperCase()} | Backend: ${API_BASE_URL}`);
