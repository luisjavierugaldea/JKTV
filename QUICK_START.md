# 🚀 Inicio Rápido - APK & PWA

## ✅ **Lo que ya está configurado:**

1. ✅ **Capacitor instalado** - Android platform agregada
2. ✅ **PWA configurada** - Service Worker + Manifest.json
3. ✅ **Android TV ready** - Navegación D-Pad + Focus management
4. ✅ **Permisos configurados** - Internet, Network, Wake Lock
5. ✅ **Build scripts** - Comandos npm listos

---

## 📱 **Generar APK en 3 pasos:**

### **Opción 1: APK Debug (Testing rápido)**
```bash
cd frontend
npm run android:build
```
Esto abre Android Studio → **Build > Build APK(s)**

APK generado en: `frontend/android/app/build/outputs/apk/debug/`

### **Opción 2: APK Release (Distribución)**
Ver guía completa en: [ANDROID_TV_GUIDE.md](./ANDROID_TV_GUIDE.md)

---

## 🌐 **Probar PWA (Sin APK):**

### **1. Iniciar servidor de desarrollo:**
```bash
cd frontend
npm run dev
```

### **2. Abrir en navegador:**
- Chrome/Edge en Android: `http://[tu_ip]:3000`
- Desktop: `http://localhost:3000`

### **3. Instalar PWA:**
- **Android**: Menú (⋮) > "Agregar a pantalla de inicio"
- **Desktop**: Ícono de instalación (➕) en barra de direcciones

---

## 📺 **Probar en Android TV:**

### **Via Emulador:**
```bash
cd frontend
npm run android:build
```
En Android Studio:
1. **Tools > Device Manager**
2. **Create Device > TV > Android TV (1080p)**
3. **Run app** en el emulador

### **Via ADB (TV Real):**
```bash
# En la TV: Habilitar "Depuración USB"
# Conectar a misma WiFi

adb connect [IP_TV]:5555
adb install app-debug.apk
```

---

## 🎮 **Controles TV/Móvil:**

### **Android TV (Control Remoto):**
- ⬆️⬇️⬅️➡️ Navegar menú
- **Enter/Select** - Abrir contenido
- **Back** - Volver atrás

### **Móvil/Tablet:**
- **Touch** - Funcionamiento normal

### **Desktop:**
- **Mouse** - Clic normal
- **Teclado** - Flechas para navegar (opcional)

---

## 🔧 **Scripts NPM Disponibles:**

```bash
# Desarrollo
npm run dev                 # Servidor Vite (puerto 3000)

# Build
npm run build              # Build producción

# Android
npm run cap:sync           # Build + sync con Android
npm run android:build      # Build + abrir Android Studio
npm run android:dev        # Build + correr en dispositivo conectado

# PWA
npm run pwa:build          # Build para PWA (igual que npm run build)
```

---

## 📦 **Archivos Importantes:**

```
frontend/
├── capacitor.config.ts              # Config Capacitor
├── public/
│   ├── manifest.json                # PWA manifest
│   ├── sw.js                        # Service Worker
│   └── icon-*.png                   # Íconos app
├── android/                         # Proyecto Android nativo
│   └── app/
│       └── src/main/
│           └── AndroidManifest.xml  # Config Android
└── src/
    ├── hooks/
    │   └── useDPadNavigation.js     # Hook D-Pad para TV
    └── components/
        └── TVFocusable.jsx          # Componente focusable TV
```

---

## 🎨 **Personalizar:**

### **Cambiar nombre app:**
`capacitor.config.ts`:
```typescript
appName: 'Tu Nombre',
```

### **Cambiar íconos:**
Reemplazar en `frontend/public/`:
- `icon-192.png`
- `icon-512.png`

### **Cambiar colores:**
`manifest.json`:
```json
"theme_color": "#tu_color",
```

---

## ❓ **Problemas Comunes:**

### **"Cannot find Android SDK"**
```bash
# Windows
setx ANDROID_HOME "C:\Users\TuUsuario\AppData\Local\Android\Sdk"
```

### **"Cannot find Java"**
```bash
# Instalar JDK 17+
# https://adoptium.net/
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.x.x"
```

### **APK no instala**
1. Habilitar "Orígenes desconocidos" en Android
2. Verificar espacio disponible
3. Probar con: `adb install -r app-debug.apk` (fuerza reinstall)

### **PWA no se instala**
1. Requiere HTTPS (o localhost)
2. Verificar manifest.json válido
3. Chrome DevTools > Application > Manifest (ver errores)

---

## 📖 **Más Info:**

Ver guía completa con instrucciones detalladas:
👉 [ANDROID_TV_GUIDE.md](./ANDROID_TV_GUIDE.md)

---

## 🎉 **¡Todo Listo!**

Tu app está configurada para:
- ✅ APK Android (móviles/tablets)
- ✅ PWA (installable desde navegador)
- ✅ Android TV (con navegación D-Pad)

**Próximos pasos sugeridos:**
1. Generar APK debug para probar en tu dispositivo
2. Probar PWA en tu móvil/desktop
3. Crear íconos personalizados
4. (Opcional) Generar APK release firmado
