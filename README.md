# 📺 JKTV - Streaming App

App de streaming con películas, series, anime y K-dramas para Android móvil y Smart TV.

## 🚀 Stack Tecnológico

- **Frontend**: React 19 + Vite + Capacitor (Android)
- **Backend**: Node.js + Express + Cheerio
- **Scrapers**: AnimeAV1, Cuevana, DoramasFlix, TMDB
- **Deploy**: Render.com (backend), APK local (frontend)

---

## 📦 Instalación

### **Backend:**
```bash
cd backend
npm install
cp .env.example .env
# Editar .env con tu TMDB_API_KEY
npm run dev
```

### **Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## 🔧 Configuración DEV/PROD

### **Cambiar entre Local (DEV) y Nube (PROD):**

Edita `frontend/src/config.js`:

```javascript
// Para desarrollo local (backend en tu PC):
const MODE = 'dev';

// Para producción (backend en Render):
const MODE = 'prod';
```

Después de cambiar, regenera el APK:
```bash
cd frontend
npm run build
npx cap sync android
npm run android:build
```

---

## 🌐 Deploy a Render.com

### **Paso 1: Subir a GitHub**
```bash
git init
git add .
git commit -m "Initial commit - JKTV"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/jktv-streaming.git
git push -u origin main
```

### **Paso 2: Configurar Render**
1. Ir a https://render.com → Sign Up con GitHub
2. New → Web Service
3. Conectar repositorio `jktv-streaming`
4. Configuración:
   - **Name**: `jktv-backend`
   - **Region**: Oregon (más cercano)
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`

5. Variables de entorno (Environment):
   ```
   NODE_ENV=production
   TMDB_API_KEY=tu_api_key
   ALLOWED_ORIGINS=capacitor://localhost,https://localhost
   PORT=3001
   ```

6. Create Web Service → Esperar 3-5 min

### **Paso 3: Actualizar Frontend**
Copia la URL de Render (ej: `https://jktv-backend.onrender.com`)

Edita `frontend/src/config.js`:
```javascript
prod: {
  backendURL: 'https://jktv-backend.onrender.com/api',
  description: 'Producción - Backend en Render',
},
```

Cambia MODE a 'prod' y regenera APK.

---

## 📱 Generar APK

```bash
cd frontend
npm run build
npx cap sync android
npm run android:build
```

En Android Studio:
**Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**

APK ubicado en: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔄 Actualizar App

### **Backend (con Render):**
```bash
# Hacer cambios en backend/
git add .
git commit -m "Actualización backend"
git push
# Render auto-deploy en 2-3 min
```

### **Frontend:**
```bash
# Hacer cambios en frontend/
npm run build
npx cap sync android
# Regenerar APK
```

---

## 📝 Notas

- **Plan Gratuito Render**: Backend se duerme tras 15 min sin uso, despierta en 30s
- **Backend Local**: Más rápido pero requiere PC encendida
- **Smart TV**: Mismo APK funciona en móvil y Android TV
- **IP Local**: Si cambia tu IP, actualizar en `frontend/src/config.js`

---

## 🔑 Configuración Requerida

### **TMDB API Key:**
1. Crear cuenta en https://www.themoviedb.org
2. Ir a Settings → API → Request API Key
3. Agregar a `backend/.env`:
   ```
   TMDB_API_KEY=tu_key_aqui
   ```

---

## 📄 Licencia

Uso personal únicamente.
