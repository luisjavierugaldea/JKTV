# 📱 Canal Streaming - APK Android & Smart TV

Guía completa para generar APKs y configurar la aplicación.

---

## 📋 **Requisitos Previos**

### **Para APK Android:**
- ✅ Node.js 18+ instalado
- ✅ Java JDK 17+ ([Descargar](https://adoptium.net/))
- ✅ Android Studio ([Descargar](https://developer.android.com/studio))
- ✅ Android SDK instalado (automático con Android Studio)

### **Variables de Entorno:**
Agregar al PATH:
```
JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.x.x
ANDROID_HOME=C:\Users\TuUsuario\AppData\Local\Android\Sdk
```

---

## 🚀 **Fase 1: Generar APK Android (Móviles/Tablets)**

### **1. Build del Frontend:**
```bash
cd frontend
npm run build
```

### **2. Sincronizar con Capacitor:**
```bash
npx cap sync android
```

### **3. Abrir Android Studio:**
```bash
npx cap open android
```

### **4. Generar APK en Android Studio:**

#### **APK Debug (Para Testing):**
1. En Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
2. Esperar compilación (~2-3 minutos)
3. APK generado en: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`

#### **APK Release (Para Distribución):**

**A. Crear Keystore (Solo primera vez):**
```bash
cd frontend/android/app
keytool -genkey -v -keystore canal-release.keystore -alias canal -keyalg RSA -keysize 2048 -validity 10000

# Responder preguntas:
# Password: [tu_password_seguro]
# Nombre: Canal Streaming
# Organización: Tu Nombre/Empresa
# Ciudad/Estado/País: [tus datos]
```

**B. Configurar firma en `android/app/build.gradle`:**
```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file('canal-release.keystore')
            storePassword 'tu_password'
            keyAlias 'canal'
            keyPassword 'tu_password'
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

**C. Build Release:**
```bash
cd frontend/android
./gradlew assembleRelease
```

**D. APK generado en:**
```
frontend/android/app/build/outputs/apk/release/app-release.apk
```

### **5. Instalar APK en Dispositivo:**

#### **Via ADB (Cable USB):**
```bash
# Habilitar "Depuración USB" en el dispositivo Android
# Conectar por USB

adb install app-release.apk
```

#### **Via Transferencia Manual:**
1. Copiar APK al teléfono (USB/Email/Drive)
2. Abrir archivo APK en el teléfono
3. Permitir "Instalar apps de origen desconocido"
4. Confirmar instalación

---

## 🌐 **Fase 2: PWA (Progressive Web App)**

### **¿Qué es?**
App installable desde el navegador SIN necesidad de APK.

### **Funciona en:**
- ✅ Android (Chrome, Edge, Samsung Internet)
- ✅ iOS/iPadOS 16.4+ (Safari)
- ✅ Windows 11 (Edge)
- ✅ macOS (Safari, Chrome)
- ⚠️ Algunos Smart TVs (depende del navegador)

### **Cómo Instalar:**

#### **En Android/iOS:**
1. Abrir la web en Chrome/Safari: `https://tu-dominio.com`
2. Tocar menú (⋮) > **"Agregar a pantalla de inicio"** o **"Instalar app"**
3. ¡Listo! Ícono en el launcher como app nativa

#### **En Windows/Mac:**
1. Abrir en Edge/Chrome
2. Ver ícono de instalación (➕) en barra de direcciones
3. Clic en **"Instalar Canal Streaming"**

### **Ventajas PWA:**
- ✅ Sin compilar APK
- ✅ Actualizaciones instantáneas (solo rebuild frontend)
- ✅ Funciona offline (cache básico)
- ✅ Notificaciones push (opcional)
- ✅ Menos espacio que APK

---

## 📺 **Fase 3: Android TV / Smart TV**

### **Características Implementadas:**
- ✅ Navegación con D-Pad (flechas del control remoto)
- ✅ Focus states visibles (borde rojo)
- ✅ Layouts optimizados para 10-foot UI
- ✅ Intent filter para TV launcher
- ✅ Hardware acceleration habilitado

### **Generar APK para TV:**

#### **1. Build y Sync:**
```bash
cd frontend
npm run build
npx cap sync android
```

#### **2. Configurar TV en Android Studio:**
Ya configurado en `AndroidManifest.xml`:
- ✅ `LEANBACK_LAUNCHER` category
- ✅ Hardware features opcionales (touchscreen=false)
- ✅ Orientación landscape

#### **3. Probar en Emulador de TV:**
En Android Studio:
1. **Tools > Device Manager**
2. **Create Device > TV > [Seleccionar perfil]**
3. **Next > [Seleccionar API 33+] > Finish**
4. Ejecutar app en emulador TV

#### **4. Generar APK TV Release:**
```bash
cd frontend/android
./gradlew assembleRelease
```

El mismo APK funciona para móvil Y TV.

### **Instalar en Android TV Real:**

#### **Via ADB WiFi:**
```bash
# En la TV: Habilitar "Depuración USB" y "Depuración ADB por red"
# Conectar PC y TV a la misma WiFi

adb connect [IP_DE_LA_TV]:5555
adb install app-release.apk
```

#### **Via USB:**
```bash
# Conectar TV por USB (si tiene puerto)
adb install app-release.apk
```

#### **Via Descarga Directa:**
1. Instalar **"Downloader"** app en TV (desde Play Store)
2. Abrir Downloader
3. Poner URL del APK (ej: Google Drive, Dropbox)
4. Instalar

---

## 🎨 **Personalización**

### **Cambiar Íconos:**
Reemplazar archivos en `frontend/public/`:
- `icon-192.png` (192x192px)
- `icon-512.png` (512x512px)

Herramienta recomendada: [PWA Asset Generator](https://www.pwabuilder.com/)

### **Cambiar Nombre:**
Editar `capacitor.config.ts`:
```typescript
appName: 'Tu Nombre App',
```

### **Cambiar Package ID:**
Editar `capacitor.config.ts`:
```typescript
appId: 'com.tuempresa.tuapp',
```
Luego: `npx cap sync android`

### **Cambiar Colores:**
Editar `manifest.json`:
```json
"theme_color": "#tu_color",
"background_color": "#tu_color"
```

---

## 🐛 **Troubleshooting**

### **Error: JAVA_HOME not set**
```bash
# Windows
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.x.x"

# Verificar
echo %JAVA_HOME%
```

### **Error: Android SDK not found**
1. Abrir Android Studio
2. **File > Settings > Appearance & Behavior > System Settings > Android SDK**
3. Anotar "Android SDK Location"
4. Agregar al PATH:
```bash
setx ANDROID_HOME "C:\Users\TuUsuario\AppData\Local\Android\Sdk"
```

### **APK no instala en TV:**
- Verificar que "Instalar apps de origen desconocido" esté habilitado
- Probar con ADB: `adb logcat` para ver errores

### **PWA no muestra "Instalar":**
- Verificar HTTPS (localhost funciona sin HTTPS)
- Abrir DevTools > Application > Manifest (ver errores)
- Verificar que `manifest.json` sea válido

---

## 📦 **Distribución**

### **Opciones:**
1. **Play Store** (requiere cuenta desarrollador $25 USD)
2. **APKPure / APKMirror** (stores alternativos)
3. **Descarga directa** (tu propio servidor/CDN)
4. **PWA** (desde tu dominio web)

### **Recomendación:**
Para uso personal/privado: **PWA + APK directo**

---

## 🔄 **Actualizar App**

### **APK:**
1. Incrementar versión en `android/app/build.gradle`:
```gradle
versionCode 2
versionName "1.1.0"
```
2. Rebuild: `./gradlew assembleRelease`
3. Redistribuir nuevo APK

### **PWA:**
1. Build frontend: `npm run build`
2. Subir a servidor
3. ¡Automático! Los usuarios recibirán update al recargar

---

## ✅ **Checklist Final**

Antes de distribuir:

- [ ] APK compilado sin errores
- [ ] App probada en móvil físico
- [ ] App probada en Android TV/emulador
- [ ] PWA installable desde navegador
- [ ] Service Worker funcionando (offline)
- [ ] Videos reproducen correctamente
- [ ] Navegación D-Pad funciona en TV
- [ ] Focus states visibles
- [ ] Keystore respaldado (si release)
- [ ] Versión incrementada

---

## 📞 **Soporte**

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/)
- [PWA Builder](https://www.pwabuilder.com/)
