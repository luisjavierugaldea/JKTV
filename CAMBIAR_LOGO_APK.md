# 📱 Cómo Cambiar el Logo del APK de JKTV

## 📂 Ubicación de los Íconos

Los íconos del APK están en:
```
frontend/android/app/src/main/res/
```

Tienes que reemplazar archivos en estas carpetas:

### **Carpetas principales:**
```
mipmap-mdpi/       (48x48px)
mipmap-hdpi/       (72x72px)
mipmap-xhdpi/      (96x96px)
mipmap-xxhdpi/     (144x144px)
mipmap-xxxhdpi/    (192x192px)
```

### **Archivos a reemplazar en CADA carpeta:**
- `ic_launcher.png`         ← Ícono cuadrado
- `ic_launcher_round.png`   ← Ícono redondo
- `ic_launcher_foreground.png` ← Solo la parte frontal (para adaptive icon)

---

## 🎨 Preparar tu Logo

### **Opción 1: Generador Automático (Recomendado)**

1. Ve a: **https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html**

2. Sube tu PNG (preferible 512x512px o mayor)

3. Configura:
   - **Name**: `ic_launcher`
   - **Trim**: Sí (recorta espacios blancos)
   - **Padding**: 10-15% (espacio alrededor)
   - **Background**: Elige color de fondo

4. Click **Download .zip**

5. Descomprime y copia todas las carpetas a:
   ```
   frontend/android/app/src/main/res/
   ```
   (Sobrescribe los archivos existentes)

---

### **Opción 2: Manual (Si solo tienes 1 imagen)**

Si tienes un solo PNG grande (ej: 512x512px):

#### **Paso 1: Redimensionar tu imagen a múltiples tamaños**

Usa herramientas online o Photoshop:

| Carpeta | Tamaño | Ejemplo |
|---------|--------|---------|
| `mipmap-mdpi/` | 48x48px | ![](https://via.placeholder.com/48) |
| `mipmap-hdpi/` | 72x72px | ![](https://via.placeholder.com/72) |
| `mipmap-xhdpi/` | 96x96px | ![](https://via.placeholder.com/96) |
| `mipmap-xxhdpi/` | 144x144px | ![](https://via.placeholder.com/144) |
| `mipmap-xxxhdpi/` | 192x192px | ![](https://via.placeholder.com/192) |

#### **Paso 2: Renombrar archivos**

Cada imagen redimensionada debe llamarse:
- `ic_launcher.png`
- `ic_launcher_round.png` (misma imagen, versión circular)

#### **Paso 3: Copiar a carpetas correspondientes**

```
frontend/android/app/src/main/res/
├── mipmap-mdpi/
│   ├── ic_launcher.png (48x48)
│   └── ic_launcher_round.png (48x48)
├── mipmap-hdpi/
│   ├── ic_launcher.png (72x72)
│   └── ic_launcher_round.png (72x72)
├── mipmap-xhdpi/
│   ├── ic_launcher.png (96x96)
│   └── ic_launcher_round.png (96x96)
├── mipmap-xxhdpi/
│   ├── ic_launcher.png (144x144)
│   └── ic_launcher_round.png (144x144)
└── mipmap-xxxhdpi/
    ├── ic_launcher.png (192x192)
    └── ic_launcher_round.png (192x192)
```

---

## 🔧 Aplicar los Cambios

### **1. Sincronizar con Capacitor:**
```powershell
cd frontend
npx cap sync android
```

### **2. Abrir Android Studio:**
```powershell
npx cap open android
```

### **3. Limpiar y Recompilar:**

En Android Studio:
```
Build → Clean Project
Build → Rebuild Project
```

### **4. Generar APK:**
```
Build → Build Bundle(s) / APK(s) → Build APK(s)
```

---

## 🎯 Recomendaciones de Diseño

### **Formato ideal:**
- **Tamaño fuente**: 512x512px o 1024x1024px
- **Formato**: PNG con transparencia
- **Padding**: Deja 10-15% de margen alrededor del logo
- **Colores**: Usa colores sólidos y contraste alto

### **Ejemplo de estructura de logo:**
```
┌─────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░ │  ← Padding 15%
│ ░░┌─────────────────┐░░ │
│ ░░│                 │░░ │
│ ░░│   🎬 TU LOGO    │░░ │  ← Área visible
│ ░░│                 │░░ │
│ ░░└─────────────────┘░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░ │  ← Padding 15%
└─────────────────────────┘
```

### **Colores del tema JKTV actual:**
- **Primario**: `#e50914` (Rojo Netflix)
- **Fondo oscuro**: `#0a0a0f`
- **Acento**: `#ff6b6b`

---

## 🚀 Ejemplo Rápido con PowerShell

```powershell
# 1. Ir a tu carpeta
cd C:\Users\Equipo\Documents\canal\frontend

# 2. Copiar tu logo (asumiendo que tienes logo.png en Descargas)
# Usa el generador web para crear todas las versiones

# 3. Sincronizar
npx cap sync android

# 4. Abrir Android Studio
npx cap open android

# 5. En Android Studio:
#    Build → Clean Project
#    Build → Build APK(s)
```

---

## ❓ Solución de Problemas

### **El logo no cambia después de reinstalar:**
- Android cachea íconos. Solución:
  1. Desinstala completamente la app
  2. Reinicia el dispositivo
  3. Instala el nuevo APK

### **El logo se ve pixelado:**
- Usa un PNG de mayor resolución (512x512 o 1024x1024)
- Asegúrate de generar TODAS las versiones (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)

### **El logo tiene fondo blanco en lugar de transparente:**
- Verifica que tu PNG tenga canal alfa (transparencia)
- Usa Photoshop/GIMP para eliminar el fondo

---

## 📌 Recursos Útiles

- **Android Asset Studio**: https://romannurik.github.io/AndroidAssetStudio/
- **Generador de íconos online**: https://icon.kitchen/
- **Editor PNG online**: https://www.photopea.com/

---

## ✅ Checklist Final

- [ ] Logo preparado en PNG con transparencia
- [ ] Generadas todas las versiones de tamaño (mdpi a xxxhdpi)
- [ ] Archivos copiados a carpetas correctas
- [ ] `npx cap sync android` ejecutado
- [ ] Proyecto limpiado en Android Studio
- [ ] APK compilado y probado en dispositivo

---

**¡Listo!** Tu APK ahora tendrá tu logo personalizado. 🎉
