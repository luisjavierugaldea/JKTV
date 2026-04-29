import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * GET /api/app-version
 * Devuelve información sobre la última versión disponible de la app
 */
router.get('/', (req, res) => {
  try {
    const versionInfo = {
      version: '1.0.2', // 👈 ACTUALIZA ESTO cuando subas nueva versión
      buildNumber: 2, // Incrementa con cada build
      
      // 🎯 OPCIÓN 1 (RECOMENDADA): GitHub Releases - Descarga directa automática
      downloadUrl: 'https://github.com/luisjavierugaldea/JKTV/releases/download/v1.0.1/app-debug.apk', // 👈 Temporalmente apunta a v1.0.1 para probar
      
      // 🎯 OPCIÓN 2: Firebase Storage
      // downloadUrl: 'https://firebasestorage.googleapis.com/v0/b/tu-proyecto.appspot.com/o/apk%2Fapp-release.apk?alt=media',
      
      // 🎯 OPCIÓN 3: Tu propio servidor (ver ruta /api/app-version/download)
      // downloadUrl: 'https://tu-backend.railway.app/api/app-version/download',
      
      releaseDate: '2026-04-29',
      releaseNotes: [
        '✨ MultiView: Ver hasta 4 canales simultáneamente',
        '🎨 Nuevo diseño tipo Netflix en sección TV',
        '🎮 Soporte para control remoto Android TV',
        '⚡ Mejoras de rendimiento y estabilidad',
      ],
      forceUpdate: false, // true = obligatoria, false = opcional
      minVersion: '0.9.0', // Versión mínima soportada
    };

    res.json(versionInfo);
  } catch (error) {
    console.error('Error getting app version:', error);
    res.status(500).json({ error: 'Error obteniendo versión de la app' });
  }
});

/**
 * GET /api/app-version/download
 * Descarga directa del APK desde el servidor (OPCIÓN ALTERNATIVA)
 * 
 * Para usar esta opción:
 * 1. Crea carpeta /backend/apk/
 * 2. Coloca tu APK ahí: /backend/apk/app-release.apk
 * 3. Cambia downloadUrl a: 'https://tu-backend.railway.app/api/app-version/download'
 */
router.get('/download', (req, res) => {
  try {
    const apkPath = path.join(__dirname, '..', 'apk', 'app-release.apk');
    
    // Verificar que el archivo existe
    if (!fs.existsSync(apkPath)) {
      return res.status(404).json({ 
        error: 'APK no encontrado. Coloca el archivo en /backend/apk/app-release.apk' 
      });
    }

    // Headers para forzar descarga
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="JKTV.apk"');
    
    // Stream del archivo
    const fileStream = fs.createReadStream(apkPath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming APK:', error);
      res.status(500).json({ error: 'Error al descargar APK' });
    });
  } catch (error) {
    console.error('Error downloading APK:', error);
    res.status(500).json({ error: 'Error al descargar APK' });
  }
});

export default router;
