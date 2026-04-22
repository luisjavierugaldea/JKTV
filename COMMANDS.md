# 🚀 Comandos Rápidos - JKTV

## 📦 **Deploy Inicial**

```powershell
# 1. Inicializar Git
cd C:\Users\Equipo\Documents\canal
git init
git add .
git commit -m "Initial commit - JKTV"

# 2. Subir a GitHub (reemplaza TU-USUARIO)
git branch -M main
git remote add origin https://github.com/TU-USUARIO/jktv-streaming.git
git push -u origin main
```

**Luego:** Sigue la guía de Render en [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)

---

## 🔄 **Actualizar Backend (Después del Deploy)**

```powershell
# Hacer cambios en backend/
cd C:\Users\Equipo\Documents\canal
git add .
git commit -m "Descripción del cambio"
git push

# Render auto-deploy en 2-3 min ✅
```

---

## 📱 **Generar APK (Desarrollo - Local)**

```powershell
# 1. Configurar para DEV
# Editar: frontend/src/config.js → const MODE = 'dev';

# 2. Build y Sync
cd C:\Users\Equipo\Documents\canal\frontend
npm run build
npx cap sync android

# 3. Abrir Android Studio
npm run android:build

# 4. En Android Studio:
# Build → Build APK(s)
```

**APK:** `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🌐 **Generar APK (Producción - Render)**

```powershell
# 1. Configurar para PROD
# Editar: frontend/src/config.js → const MODE = 'prod';

# 2. Build y Sync
cd C:\Users\Equipo\Documents\canal\frontend
npm run build
npx cap sync android

# 3. Abrir Android Studio
npm run android:build

# 4. En Android Studio:
# Build → Build APK(s)
```

---

## 🔧 **Desarrollo Local (Hot-Reload)**

```powershell
# Terminal 1 - Backend
cd C:\Users\Equipo\Documents\canal\backend
npm run dev

# Terminal 2 - Frontend
cd C:\Users\Equipo\Documents\canal\frontend
npm run dev

# Abrir: http://localhost:3000
```

---

## 🔄 **Cambiar entre DEV y PROD**

### **Opción 1: Editar Config (Recomendado)**

```javascript
// frontend/src/config.js
const MODE = 'dev';  // Para backend local
// o
const MODE = 'prod'; // Para backend Render
```

Después: Regenerar APK

### **Opción 2: Tener 2 APKs**

```powershell
# APK Dev
# MODE = 'dev' → Build → Renombrar a: jktv-dev.apk

# APK Prod
# MODE = 'prod' → Build → Renombrar a: jktv-prod.apk
```

---

## 📊 **Ver Logs de Render**

1. Ir a: https://dashboard.render.com
2. Click en tu servicio: `jktv-backend`
3. Tab: **Logs**

---

## 🔍 **Verificar IP Local (Si Cambia)**

```powershell
ipconfig | Select-String "IPv4"
```

**Actualizar en:**
- `frontend/src/config.js` → `dev.backendURL`

---

## 🧹 **Limpiar Cache (Si hay Problemas)**

```powershell
# Backend
cd C:\Users\Equipo\Documents\canal\backend
rm -r node_modules
npm install

# Frontend
cd C:\Users\Equipo\Documents\canal\frontend
rm -r node_modules, dist
npm install
```

---

## 🎯 **One-Liner para Deploy Rápido**

```powershell
cd C:\Users\Equipo\Documents\canal; git add .; git commit -m "Update"; git push
```

Render auto-deploy en 2-3 min ✅

---

## 📱 **Instalar APK en Android**

### **Método 1: USB**
```powershell
# Conectar celular con depuración USB
adb install -r frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

### **Método 2: Compartir**
1. Subir APK a Google Drive / Dropbox
2. Descargar desde el celular/TV
3. Instalar (habilitar "Fuentes desconocidas")

---

## 🔐 **Obtener Nueva TMDB API Key**

1. https://www.themoviedb.org/signup
2. Settings → API → Request API Key
3. Agregar a `backend/.env` y Render Environment Variables

---

## ⚡ **Tips de Productividad**

### **Alias de PowerShell (Opcional)**

Agrega a tu `$PROFILE`:

```powershell
function jktv-dev {
  cd C:\Users\Equipo\Documents\canal\backend
  npm run dev
}

function jktv-front {
  cd C:\Users\Equipo\Documents\canal\frontend
  npm run dev
}

function jktv-push {
  cd C:\Users\Equipo\Documents\canal
  git add .
  git commit -m "Update"
  git push
}
```

Uso:
```powershell
jktv-dev    # Inicia backend
jktv-front  # Inicia frontend
jktv-push   # Commit y push rápido
```

---

**🎬 Happy Streaming!** 📺
