# 📲 Sistema de Actualización de APK - JKTV

## 🎯 **Descripción**

Sistema automático de notificación de actualizaciones para tu APK de Android. Los usuarios serán notificados cuando haya una nueva versión disponible con **descarga automática directa del APK**.

---

## 🏆 **Opciones de Alojamiento del APK**

### **OPCIÓN 1: GitHub Releases (⭐ RECOMENDADA)**

**✅ Ventajas:**
- Gratis e ilimitado
- Descarga directa automática del APK
- Versionado automático
- URLs permanentes
- Ya tienes el repositorio

**📝 Cómo usar:**

#### 1. Crear Release en GitHub:
```bash
cd "c:\Users\Equipo\Documents\mis proyectos\canal"
git add .
git commit -m "Release v1.0.0"
git push origin main

# Crear tag
git tag v1.0.0
git push origin v1.0.0
```

#### 2. En GitHub Web:
1. Ve a: `https://github.com/luisjavierugaldea/JKTV`
2. Click **"Releases"** → **"Create a new release"**
3. **Tag:** `v1.0.0`
4. **Title:** `JKTV v1.0.0`
5. **Description:** Escribe novedades
6. **Attach files:** Arrastra `app-release.apk`
7. Click **"Publish release"**

#### 3. Copiar URL:
Tu APK estará en:
```
https://github.com/luisjavierugaldea/JKTV/releases/download/v1.0.0/app-release.apk
```

#### 4. Actualizar backend:
```javascript
// backend/routes/appVersion.js
downloadUrl: 'https://github.com/luisjavierugaldea/JKTV/releases/download/v1.0.0/app-release.apk',
```

---

### **OPCIÓN 2: Tu Propio Servidor (Railway/Backend)**

**✅ Ventajas:**
- Control total
- Sin dependencias externas
- Descarga directa

**⚠️ Desventajas:**
- Consume ancho de banda de tu plan
- Archivos grandes (~50MB por descarga)

**📝 Cómo usar:**

#### 1. Colocar APK en backend:
```bash
# Crea carpeta
mkdir backend/apk

# Copia tu APK ahí (manualmente o con comando)
copy "ruta\a\tu\app-release.apk" "backend\apk\app-release.apk"
```

#### 2. Actualizar .gitignore:
Ya está configurado en `/backend/apk/.gitignore` para no subir APKs a GitHub.

#### 3. Subir a Railway:
```bash
git add backend/apk/.gitignore
git commit -m "Add APK hosting"
git push
```

Luego sube el APK manualmente por FTP/SFTP a Railway, o usa Railway CLI.

#### 4. Actualizar URL en backend:
```javascript
// backend/routes/appVersion.js
downloadUrl: 'https://tu-backend.railway.app/api/app-version/download',
```

**Ruta implementada:** `/api/app-version/download` (ya está lista)

---

### **OPCIÓN 3: Firebase Storage**

**✅ Ventajas:**
- 5GB gratis
- CDN global rápido
- Descarga directa

**📝 Cómo usar:**

#### 1. Crear proyecto Firebase:
1. Ve a: https://console.firebase.google.com
2. **Create Project**
3. Nombre: `jktv-updates`

#### 2. Subir APK:
1. En Firebase Console: **Storage** → **Get Started**
2. Crea carpeta `apk/`
3. Sube `app-release.apk`
4. Click en el archivo → **Copy download URL**

#### 3. Hacer público:
Firebase Rules:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /apk/{allPaths=**} {
      allow read: if true; // Público solo para carpeta apk
    }
  }
}
```

#### 4. Actualizar backend:
```javascript
// backend/routes/appVersion.js
downloadUrl: 'https://firebasestorage.googleapis.com/v0/b/jktv-updates.appspot.com/o/apk%2Fapp-release.apk?alt=media',
```

---

## 📊 **Comparación de Opciones**

| Característica | GitHub Releases | Propio Servidor | Firebase |
|---|---|---|---|
| **Costo** | ✅ Gratis ilimitado | ⚠️ Limitado por plan | ✅ 5GB gratis |
| **Velocidad** | ⚡ Rápido | 🐌 Depende del plan | ⚡ CDN global |
| **Facilidad** | ✅ Muy fácil | ⚠️ Requiere setup | ⚠️ Requiere Firebase |
| **Descarga directa** | ✅ Sí | ✅ Sí | ✅ Sí |
| **Versionado** | ✅ Automático | ❌ Manual | ❌ Manual |

**🏆 Recomendación: GitHub Releases**

---

## 🏗️ **Componentes Implementados**

### 1️⃣ **Backend** (`/backend/routes/appVersion.js`)
Endpoint que devuelve información sobre la versión más reciente:

```javascript
GET /api/app-version
```

**Respuesta:**
```json
{
  "version": "1.0.0",
  "buildNumber": 1,
  "downloadUrl": "https://drive.google.com/file/d/TU_ID/view",
  "releaseDate": "2026-04-29",
  "releaseNotes": [
    "✨ Nueva funcionalidad X",
    "🐛 Corrección de bug Y"
  ],
  "forceUpdate": false,
  "minVersion": "0.9.0"
}
```

### 2️⃣ **Frontend** (`/frontend/src/components/UpdateNotifier.jsx`)
Componente React que:
- ✅ Verifica automáticamente si hay actualizaciones al iniciar la app
- ✅ Compara versiones (instalada vs disponible)
- ✅ Muestra modal elegante con notas de versión
- ✅ Link directo a Drive para descargar
- ✅ Verificación cada 6 horas mientras la app está abierta

### 3️⃣ **Integración** (`/frontend/src/App.jsx`)
El componente `UpdateNotifier` está integrado en la app principal.

---

## 🚀 **Cómo Usar (Paso a Paso con GitHub Releases)**

### **Paso 1: Actualizar Versión en Backend** 📝

Edita `/backend/routes/appVersion.js`:

```javascript
const versionInfo = {
  version: '1.1.0', // 👈 CAMBIA ESTO (incrementa la versión)
  buildNumber: 2,   // 👈 INCREMENTA con cada build
  downloadUrl: 'https://github.com/luisjavierugaldea/JKTV/releases/download/v1.1.0/app-release.apk', // 👈 Nueva URL
  releaseDate: '2026-05-01', // 👈 Fecha de lanzamiento
  releaseNotes: [
    '✨ Agregado MultiView para ver 4 canales',
    '🎨 Rediseño de sección TV tipo Netflix',
    '🎮 Soporte para control remoto Android TV',
  ],
  forceUpdate: false, // false = opcional | true = obligatoria
  minVersion: '1.0.0', // Versión mínima que todavía funciona
};
```

### **Paso 2: Actualizar Versión en Frontend** 📝

#### **A) En `package.json`:**
```json
{
  "version": "1.1.0" // 👈 SINCRONIZA con backend
}
```

#### **B) En `UpdateNotifier.jsx` (línea ~67):**
```javascript
return '1.1.0'; // 👈 SINCRONIZA con backend
```

### **Paso 3: Generar Nuevo APK** 📦

```bash
cd frontend
npm run android:build
```

Esto abrirá Android Studio. Luego:
1. **Build → Generate Signed Bundle/APK**
2. Selecciona **APK**
3. Firma con tu keystore
4. Espera a que termine
5. El APK estará en: `frontend/android/app/build/outputs/apk/release/app-release.apk`

### **Paso 4: Crear Release en GitHub** 🏷️

```bash
cd "c:\Users\Equipo\Documents\mis proyectos\canal"

# Commitear cambios
git add .
git commit -m "Release v1.1.0 - MultiView y diseño Netflix"
git push origin main

# Crear tag de versión
git tag v1.1.0
git push origin v1.1.0
```

### **Paso 5: Subir APK a GitHub Releases** ⬆️

1. Ve a: `https://github.com/luisjavierugaldea/JKTV/releases`
2. Click **"Draft a new release"**
3. **Choose a tag:** Selecciona `v1.1.0`
4. **Release title:** `JKTV v1.1.0 - MultiView y Netflix UI`
5. **Description:** Escribe las novedades (copiar de releaseNotes)
6. **Attach files:** 
   - Click en "Attach binaries"
   - Arrastra `app-release.apk` desde `frontend/android/app/build/outputs/apk/release/`
7. Click **"Publish release"** ✅

### **Paso 6: Copiar URL del APK** 🔗

Después de publicar, verás el APK en la página del release. Haz clic derecho sobre el nombre del archivo → **"Copiar dirección del enlace"**.

La URL será algo como:
```
https://github.com/luisjavierugaldea/JKTV/releases/download/v1.1.0/app-release.apk
```

### **Paso 7: Actualizar URL en Backend** 📝

Edita `/backend/routes/appVersion.js`:

```javascript
downloadUrl: 'https://github.com/luisjavierugaldea/JKTV/releases/download/v1.1.0/app-release.apk', // 👈 Pega aquí
```

Commitear y subir:
```bash
git add backend/routes/appVersion.js
git commit -m "Update download URL to v1.1.0"
git push origin main
```

### **Paso 8: ¡Listo!** 🎉

Los usuarios con versión vieja verán automáticamente el modal de actualización con descarga directa del APK.

---

```
🚀

✨ Nueva Versión Disponible

Actual: v1.0.0    Nueva: v1.1.0

📋 Novedades:
• ✨ Agregado MultiView para ver 4 canales
• 🎨 Rediseño de sección TV tipo Netflix
• 🎮 Soporte para control remoto Android TV

[⬇️ Descargar Actualización]  [⏭️ Más Tarde]
```

---

## ⚙️ **Configuraciones Avanzadas**

### **Actualización Obligatoria** 🔒

Si necesitas forzar que todos actualicen (por ejemplo, si hay un bug crítico):

```javascript
forceUpdate: true, // 👈 Cambia a true
```

El modal cambiará a:
- ❌ NO tendrá botón "Más Tarde"
- ⚠️ Mostrará advertencia: "Esta actualización es necesaria para continuar"
- 🔒 Solo botón: "🔒 Actualizar Ahora (Obligatorio)"

### **Versión Mínima Soportada**

```javascript
minVersion: '1.0.0', // 👈 Versiones menores NO funcionarán
```

Puedes usar esto para descontinuar versiones muy viejas.

### **Frecuencia de Verificación**

Por defecto verifica cada **6 horas**. Para cambiar:

Edita `UpdateNotifier.jsx` (línea ~27):

```javascript
6 * 60 * 60 * 1000  // 6 horas (en milisegundos)
// Ejemplos:
// 1 hora:  1 * 60 * 60 * 1000
// 12 horas: 12 * 60 * 60 * 1000
// 24 horas: 24 * 60 * 60 * 1000
```

---

## 📊 **Flujo de Actualización**

```
[Usuario abre app] 
    ↓
[App consulta: /api/app-version]
    ↓
[Compara: versión instalada vs disponible]
    ↓
    ├─→ [Misma versión] → No hace nada ✅
    │
    └─→ [Nueva versión] 
          ↓
      [Muestra modal con notas de versión]
          ↓
      [Usuario click "Descargar"]
          ↓
      [Abre Drive en navegador]
          ↓
      [Usuario descarga e instala APK manualmente]
```

---

## 🔍 **Testing**

### **Probar en Desarrollo:**

1. **Simula versión vieja en frontend:**
   ```javascript
   // UpdateNotifier.jsx línea ~67
   return '0.9.0'; // 👈 Versión menor a la del backend
   ```

2. **Reinicia la app**

3. **Deberías ver el modal de actualización** ✅

### **Probar actualización obligatoria:**

```javascript
// Backend: appVersion.js
forceUpdate: true, // 👈 Cambia a true
```

Reinicia backend y frontend. El modal NO tendrá botón "Más Tarde".

---

## 🛠️ **Troubleshooting**

### **El modal no aparece:**

1. ✅ Verifica que el backend esté corriendo
2. ✅ Verifica que la ruta `/api/app-version` funcione:
   ```bash
   curl http://localhost:3001/api/app-version
   ```
3. ✅ Revisa la consola del navegador (F12) por errores
4. ✅ Verifica que la versión en backend sea MAYOR que la del frontend

### **El link del APK no funciona:**

1. ✅ Verifica que el Release esté público (no draft)
2. ✅ URL debe ser: `https://github.com/usuario/repo/releases/download/vX.X.X/archivo.apk`
3. ✅ Prueba la URL en navegador (debe descargar directamente el APK)
4. ✅ NO uses URLs acortadas

### **Modal aparece cada vez que recargo:**

Esto es normal en desarrollo. En producción (APK):
- Solo verifica al iniciar la app
- Guarda en `sessionStorage` si el usuario cerró el modal
- Verifica cada 6 horas

---

## 📝 **Checklist para Cada Actualización**

- [ ] 1. Incrementar `version` en `/backend/routes/appVersion.js`
- [ ] 2. Incrementar `buildNumber` en backend
- [ ] 3. Actualizar `releaseNotes` con nuevas funcionalidades
- [ ] 4. Actualizar `version` en `/frontend/package.json`
- [ ] 5. Actualizar `version` en `UpdateNotifier.jsx` (línea ~67)
- [ ] 6. Generar nuevo APK (`npm run android:build`)
- [ ] 7. Commitear cambios y push a GitHub
- [ ] 8. Crear tag de versión (`git tag v1.x.x` y `git push origin v1.x.x`)
- [ ] 9. Crear Release en GitHub (con descripción de cambios)
- [ ] 10. Subir APK al Release de GitHub
- [ ] 11. Copiar URL directa del APK
- [ ] 12. Actualizar `downloadUrl` en backend con nueva URL
- [ ] 13. Commitear y push cambios del backend
- [ ] 14. Probar en app vieja para verificar que aparezca modal

---

## 💡 **Consejos**

1. **Mantén un documento con historial de versiones** (changelog.md)
2. **Usa versionado semántico:** `MAJOR.MINOR.PATCH`
   - `MAJOR`: Cambios incompatibles (2.0.0)
   - `MINOR`: Nuevas funcionalidades compatibles (1.1.0)
   - `PATCH`: Corrección de bugs (1.0.1)
3. **Escribe notas de versión claras y atractivas** (con emojis ✨)
4. **Guarda los APKs viejos** por si necesitas rollback
5. **Prueba siempre antes de distribuir**

---

## 🎨 **Personalización del Modal**

El modal es completamente personalizable. Edita `UpdateNotifier.jsx` para cambiar:
- 🎨 Colores (borders, backgrounds, shadows)
- 📐 Tamaños (padding, font-size, width)
- ✨ Animaciones (transitions, transforms)
- 📝 Textos (títulos, botones, warnings)

---

## 🚀 **Resultado Final**

Tu app ahora tiene:
- ✅ Sistema profesional de actualizaciones
- ✅ Notificación automática a usuarios
- ✅ UI elegante tipo Play Store
- ✅ Notas de versión visibles
- ✅ Control total sobre actualizaciones (opcionales/obligatorias)
- ✅ Sin necesidad de Google Play Store

**¡Los usuarios siempre tendrán la última versión!** 🎉
