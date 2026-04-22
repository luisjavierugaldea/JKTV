# 🚀 Guía Paso a Paso: GitHub + Render Deploy

## 📋 **Pre-requisitos**

- ✅ Tener Git instalado ([descargar](https://git-scm.com/))
- ✅ Cuenta de GitHub ([crear gratis](https://github.com/signup))
- ✅ Cuenta de Render ([crear gratis](https://render.com/))

---

## 🔐 **Paso 1: Configurar Git (Primera Vez)**

Abre PowerShell y configura tu identidad:

```powershell
git config --global user.name "Tu Nombre"
git config --global user.email "tu-email@ejemplo.com"
```

---

## 📦 **Paso 2: Subir Proyecto a GitHub**

### **2.1 - Inicializar Git**

```powershell
cd C:\Users\Equipo\Documents\canal
git init
```

**✅ Resultado esperado:**
```
Initialized empty Git repository in C:/Users/Equipo/Documents/canal/.git/
```

---

### **2.2 - Agregar Archivos**

```powershell
git add .
```

Esto agrega todos los archivos (respetando .gitignore)

---

### **2.3 - Primer Commit**

```powershell
git commit -m "Initial commit - JKTV Streaming App"
```

**✅ Resultado esperado:**
```
[main (root-commit) abc1234] Initial commit - JKTV Streaming App
 XX files changed, XXXX insertions(+)
```

---

### **2.4 - Crear Repositorio en GitHub**

1. Ve a: https://github.com/new
2. **Repository name**: `jktv-streaming`
3. **Description**: "App de streaming para Android y Smart TV"
4. **Public** o **Private** (tu elección)
5. ❌ **NO** marcar: "Add README", "Add .gitignore", "Add license"
6. Click: **Create repository**

---

### **2.5 - Conectar y Subir**

GitHub te mostrará comandos. Usa estos:

```powershell
git branch -M main
git remote add origin https://github.com/TU-USUARIO/jktv-streaming.git
git push -u origin main
```

**Reemplaza** `TU-USUARIO` con tu username de GitHub.

**✅ Resultado esperado:**
```
Enumerating objects: XX, done.
Counting objects: 100% (XX/XX), done.
Writing objects: 100% (XX/XX), XX KiB | XX MiB/s, done.
Total XX (delta 0), reused 0 (delta 0)
To https://github.com/TU-USUARIO/jktv-streaming.git
 * [new branch]      main -> main
```

🎉 **¡Tu código está en GitHub!**

---

## ☁️ **Paso 3: Deploy en Render.com**

### **3.1 - Crear Cuenta**

1. Ve a: https://render.com/
2. Click: **Get Started for Free**
3. Elige: **Sign in with GitHub**
4. Autoriza Render para acceder a tus repos

---

### **3.2 - Crear Web Service**

1. En Dashboard, click: **New +** → **Web Service**

2. **Connect a repository**:
   - Si no ves tu repo, click: **Configure account**
   - Selecciona tu repo: `jktv-streaming`
   - Click: **Connect**

---

### **3.3 - Configuración del Servicio**

Llena el formulario:

| Campo | Valor |
|-------|-------|
| **Name** | `jktv-backend` |
| **Region** | `Oregon (US West)` |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |

---

### **3.4 - Plan (Importante)**

- **Instance Type**: Selecciona **Free** ($0/month)

**⚠️ Limitaciones del plan gratuito:**
- ✅ 750 horas/mes
- ⚠️ Se duerme tras 15 min sin uso
- ⚠️ 30-50s para despertar

---

### **3.5 - Variables de Entorno**

Scroll hasta **Environment Variables** y agrega:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `TMDB_API_KEY` | `7f0281d24c3ce6024b1ab9be5a692112` |
| `ALLOWED_ORIGINS` | `capacitor://localhost,https://localhost` |
| `PORT` | `3001` |
| `SCRAPER_TIMEOUT_MS` | `30000` |

---

### **3.6 - Deploy**

1. Click: **Create Web Service**
2. Espera 3-5 minutos mientras Render:
   - ✅ Clona tu repositorio
   - ✅ Ejecuta `npm install`
   - ✅ Inicia el servidor

**✅ Resultado esperado:**
```
==> Build successful 🎉
==> Deploying...
==> Your service is live 🎉
```

---

### **3.7 - Obtener URL**

En la parte superior verás tu URL:
```
https://jktv-backend-XXXXX.onrender.com
```

**✅ Copia esta URL** - la necesitarás en el siguiente paso.

---

## 🔧 **Paso 4: Configurar Frontend para Producción**

### **4.1 - Actualizar Config**

Abre: `C:\Users\Equipo\Documents\canal\frontend\src\config.js`

Cambia esto:

```javascript
prod: {
  // Pega tu URL de Render aquí (agregar /api al final)
  backendURL: 'https://jktv-backend-XXXXX.onrender.com/api',
  description: 'Producción - Backend en Render',
},
```

---

### **4.2 - Cambiar a Modo PROD**

En el mismo archivo, cambia:

```javascript
// De esto:
const MODE = 'dev';

// A esto:
const MODE = 'prod';
```

**✅ Guarda el archivo** (Ctrl+S)

---

### **4.3 - Rebuild y Generar APK**

```powershell
cd C:\Users\Equipo\Documents\canal\frontend
npm run build
npx cap sync android
npm run android:build
```

Esto abre Android Studio.

En Android Studio:
1. **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Espera 2-3 minutos
3. Cuando termine, click en **locate** en la notificación

**APK ubicado en:**
```
C:\Users\Equipo\Documents\canal\frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

---

## 🎉 **¡Listo! Ahora tu APK usa Render**

### **✅ Ventajas:**
- 📱 APK funciona sin PC encendida
- 🌐 Funciona con datos móviles
- 📺 Funciona en TV sin WiFi local
- 🔄 Backend siempre disponible

---

## 🔄 **Cambiar entre DEV y PROD**

### **Para usar Backend Local (Desarrollo):**

```javascript
// frontend/src/config.js
const MODE = 'dev';
```

Regenera APK.

### **Para usar Backend Render (Producción):**

```javascript
// frontend/src/config.js
const MODE = 'prod';
```

Regenera APK.

---

## 🔄 **Actualizar Backend en Render**

Cada vez que cambies código del backend:

```powershell
cd C:\Users\Equipo\Documents\canal
git add .
git commit -m "Descripción del cambio"
git push
```

**Render detecta el push y auto-deploys en 2-3 minutos** ✅

---

## ❓ **Troubleshooting**

### **"APK no carga nada"**

1. Abre el APK
2. Espera 30-50s (Render despertando)
3. Si sigue fallando, verifica la URL en `config.js`

### **"CORS error"**

En Render dashboard:
1. Ve a **Environment** → **ALLOWED_ORIGINS**
2. Verifica que incluya: `capacitor://localhost,https://localhost`

### **"Backend muy lento"**

Normal en plan gratuito (despierta desde sleep).

**Soluciones:**
- Upgrade a plan pagado ($7/mes = sin sleep)
- Usar [UptimeRobot](https://uptimerobot.com/) para ping cada 10 min

---

## 📞 **Soporte**

Si algo falla:
1. Revisa logs en Render: Dashboard → Logs
2. Verifica variables de entorno
3. Confirma que el repo está actualizado

---

**🎬 ¡Disfruta JKTV en tu Android y Smart TV!** 📺
