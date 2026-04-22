/**
 * config.js
 * Configuración del entorno - Cambia MODE para alternar entre desarrollo y producción
 */

// 🎯 CAMBIAR AQUÍ: 'dev' o 'prod'
const MODE = 'dev'; // 👈 Cambiar a 'prod' para usar Render

const config = {
  dev: {
    // Backend local (tu PC)
    backendURL: 'http://192.168.0.6:3001/api',
    description: 'Desarrollo Local - Backend en tu PC',
  },
  prod: {
    // Backend en Render (nube) - Actualizar cuando tengas la URL
    backendURL: 'https://TU-APP.onrender.com/api', // ⚠️ Cambiar cuando configures Render
    description: 'Producción - Backend en Render',
  },
};

// Exportar configuración activa
export const API_BASE_URL = config[MODE].backendURL;
export const ENV_MODE = MODE;
export const ENV_DESCRIPTION = config[MODE].description;

// Log para debugging (visible en consola del navegador/APK)
console.log(`🌐 JKTV - Modo: ${MODE.toUpperCase()} | Backend: ${API_BASE_URL}`);
