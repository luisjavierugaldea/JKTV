# Guía de Integración Frontend - TVView Component

## 📝 Pasos para Integrar TVView en App.jsx

### Paso 1: Importar el componente

Agregar al inicio de `frontend/src/App.jsx`:

```javascript
import TVView from './components/TVView';
```

### Paso 2: Agregar estado para canal de TV seleccionado

Dentro del componente App, agregar:

```javascript
// Agregar junto a los otros estados de canales
const [selectedTVChannel, setSelectedTVChannel] = useState(null);
```

### Paso 3: Modificar la sección 'tv' en el renderizado

Buscar la sección donde se renderiza el contenido para `type === 'tv'` y reemplazar con:

```jsx
{section === 'trending' && type === 'tv' && (
  <>
    {selectedTVChannel ? (
      // Mostrar reproductor cuando hay canal seleccionado
      <>
        <button
          onClick={() => setSelectedTVChannel(null)}
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            zIndex: 1000,
            padding: '0.75rem 1.5rem',
            background: '#3b82f6',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '1rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          }}
        >
          ⬅️ Volver a Canales
        </button>
        
        <P2PPlayer
          streamUrl={selectedTVChannel.url}
          channelName={selectedTVChannel.name}
          isEmbed={selectedTVChannel.isEmbed}
        />
      </>
    ) : (
      // Mostrar lista de canales cuando no hay selección
      <TVView onSelectChannel={setSelectedTVChannel} />
    )}
  </>
)}
```

### Paso 4: (Opcional) Consultar configuración OTA al iniciar la app

Agregar un useEffect para verificar la configuración del servidor:

```javascript
useEffect(() => {
  // Consultar configuración OTA
  fetch(`${API_BASE_URL}/../app/config`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        console.log('📱 App Version:', data.data.version);
        console.log('🎯 Features:', data.data.features);
        
        // Opcional: Verificar si se requiere actualización
        if (data.data.updateRequired) {
          alert('Hay una actualización disponible. Por favor, actualiza la app.');
        }
      }
    })
    .catch(err => {
      console.log('⚠️ No se pudo conectar al servidor OTA');
    });
}, []);
```

---

## 🎨 Personalización del Componente TVView

### Cambiar colores del tema

Editar `frontend/src/components/TVView.jsx`:

```javascript
// Header gradient
background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
// Cambiar a tu color preferido

// Botones de categoría activos
background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'

// Botones de país activos
background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'

// Tarjetas de canales
background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)'
```

### Agregar más categorías

```javascript
const categories = [
  { id: 'all', label: '📺 Todos', icon: '📺' },
  { id: 'sports', label: '⚽ Deportes', icon: '⚽' },
  { id: 'entertainment', label: '🎬 Entretenimiento', icon: '🎬' },
  { id: 'news', label: '📰 Noticias', icon: '📰' },
  { id: 'movies', label: '🎥 Películas', icon: '🎥' }, // Nueva categoría
  { id: 'series', label: '📺 Series', icon: '📺' },   // Nueva categoría
  { id: 'other', label: '🎭 Otros', icon: '🎭' },
];
```

### Cambiar orden de países

```javascript
const countries = [
  { id: 'all', label: '🌎 Todos', flag: '🌎' },
  { id: 'mexico', label: 'México', flag: '🇲🇽' },
  // Reordenar según tu preferencia
];
```

---

## 🔧 Configuración Avanzada

### Habilitar/Deshabilitar Fuentes M3U

Editar `backend/config/sources.config.js`:

```javascript
export const M3U_SOURCES = [
  {
    id: 'iptv-org-latam',
    name: 'IPTV.org LATAM',
    url: 'https://iptv-org.github.io/iptv/countries/mx.m3u',
    enabled: true,  // Cambiar a false para deshabilitar
    priority: 1,
  },
  // ...
];
```

### Cambiar Intervalos de Actualización

Editar `backend/config/sources.config.js`:

```javascript
export const UPDATE_INTERVALS = {
  M3U: 30 * 60 * 1000,        // 30 minutos (cambiar según necesidad)
  EVENTS: 5 * 60 * 1000,       // 5 minutos
  CHANNELS: 30 * 60 * 1000,    // 30 minutos
  HEALTH_CHECK: 60 * 60 * 1000, // 1 hora
};
```

### Agregar Nuevos Países al Filtro

Editar `backend/config/filters.config.js`:

```javascript
export const ALLOWED_COUNTRIES = [
  'mexico',
  'colombia',
  // Agregar más...
  'bolivia',
  'paraguay',
  'costa rica',
];
```

---

## 📊 Verificar que Todo Funciona

### 1. Iniciar Backend

```bash
cd backend
node server.js
```

Deberías ver:

```
[Aggregator] 🚀 Inicializando sistema de agregación...
[M3U] 🚀 Iniciando descarga de 6 fuentes M3U...
[M3U] ✅ IPTV.org LATAM: 45 canales LATAM encontrados
[TVTVHD] ✅ 107 canales scrapeados
[Aggregator] ✅ Actualización completa exitosa
```

### 2. Probar Endpoints

```bash
# Ver todos los canales
curl http://localhost:3001/api/tv/channels

# Ver estadísticas
curl http://localhost:3001/api/tv/stats

# Ver configuración OTA
curl http://localhost:3001/app/config
```

### 3. Iniciar Frontend

```bash
cd frontend
npm run dev
```

### 4. Verificar en el navegador

1. Abrir `http://localhost:3000`
2. Ir a la pestaña **TV**
3. Deberías ver:
   - Header con "📺 TV en Vivo"
   - Barra de búsqueda
   - Filtros por categoría (Todos, Deportes, Entretenimiento, Noticias)
   - Filtros por país (banderas)
   - Grid de canales

---

## 🐛 Solución de Problemas Comunes

### Problema: No aparece la sección TV

**Solución:**
Verificar que en `App.jsx` el tab 'tv' esté en el array de tabs:

```javascript
const tabs = ['movie', 'tv', 'anime', 'kdrama', 'iptv', 'events', 'music'];
```

### Problema: No se cargan canales

**Solución 1:** Verificar que el backend esté corriendo
```bash
curl http://localhost:3001/api/tv/channels
```

**Solución 2:** Forzar actualización
```bash
curl -X POST http://localhost:3001/api/tv/refresh
```

**Solución 3:** Verificar consola del navegador (F12) para errores de CORS

### Problema: Error de CORS

**Solución:**
Verificar que el frontend esté configurado correctamente en `config.js`:

```javascript
export const API_BASE_URL = 'http://localhost:3001/api';
```

Y que el backend tenga CORS habilitado en `backend/config/cors.js`

### Problema: Canales no se reproducen

**Solución:**
1. Verificar que `P2PPlayer.jsx` esté importado correctamente
2. Verificar que `isEmbed` se pase correctamente al reproductor
3. Algunos streams pueden estar caídos (normal en IPTV)

---

## 📝 Ejemplo de Integración Completa en App.jsx

```jsx
import React, { useState, useEffect } from 'react';
import TVView from './components/TVView';
import P2PPlayer from './components/P2PPlayer';
import { API_BASE_URL } from './config';

function App() {
  const [selectedTVChannel, setSelectedTVChannel] = useState(null);
  const [section, setSection] = useState('trending');
  const [type, setType] = useState('movie');

  // Consultar configuración OTA al iniciar
  useEffect(() => {
    fetch(`${API_BASE_URL}/../app/config`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log('📱 App Version:', data.data.version);
          console.log('🎯 Features:', data.data.features);
        }
      })
      .catch(err => console.log('⚠️ OTA config not available'));
  }, []);

  return (
    <div>
      {/* ... otros componentes ... */}
      
      {/* Sección TV */}
      {section === 'trending' && type === 'tv' && (
        <>
          {selectedTVChannel ? (
            <>
              <button
                onClick={() => setSelectedTVChannel(null)}
                style={{
                  position: 'fixed',
                  top: '80px',
                  right: '20px',
                  zIndex: 1000,
                  padding: '0.75rem 1.5rem',
                  background: '#3b82f6',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                }}
              >
                ⬅️ Volver a Canales
              </button>
              
              <P2PPlayer
                streamUrl={selectedTVChannel.url}
                channelName={selectedTVChannel.name}
                isEmbed={selectedTVChannel.isEmbed}
              />
            </>
          ) : (
            <TVView onSelectChannel={setSelectedTVChannel} />
          )}
        </>
      )}
    </div>
  );
}

export default App;
```

---

## ✅ Checklist de Integración

- [ ] Backend corriendo sin errores
- [ ] `node-cron` instalado
- [ ] Agregador inicializado correctamente
- [ ] Endpoints `/api/tv/*` responden
- [ ] Endpoints `/app/*` (OTA) responden
- [ ] Frontend corre sin errores
- [ ] `TVView.jsx` importado en `App.jsx`
- [ ] Estado `selectedTVChannel` creado
- [ ] Sección TV renderiza correctamente
- [ ] Canales se cargan en la UI
- [ ] Filtros funcionan (categoría, país, búsqueda)
- [ ] Click en canal abre reproductor
- [ ] Botón "Volver" funciona
- [ ] P2PPlayer reproduce correctamente

---

## 🎉 ¡Listo!

Una vez completados todos los pasos, tu app tendrá:

✅ Sistema IPTV inteligente funcionando  
✅ Agregación automática de múltiples fuentes  
✅ Filtros LATAM aplicados  
✅ Health check automático  
✅ Sistema OTA para configuración remota  
✅ UI moderna y responsive  

**¡Tu app ahora es un IPTV inteligente de nivel profesional! 🚀**
