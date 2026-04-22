# 🎌 Integración de AnimeAV1 en Frontend

## ✅ Cambios Implementados

### 1. **Backend**
- ✅ Creado `backend/utils/api-error.js` - Clase de error personalizada
- ✅ Creado `backend/scrapers/animeav1.service.js` - Servicio completo de scraping de anime
- ✅ Creado `backend/routes/anime.js` - Rutas REST para anime
- ✅ Modificado `backend/server.js` - Agregado router de anime
- ✅ Instalado `cheerio` - Dependencia para parsing HTML

### 2. **Frontend**
- ✅ Modificado `frontend/src/lib/api.js` - Agregadas funciones para API de anime
- ✅ Creado `frontend/src/components/AnimeEpisodeSelector.jsx` - Selector visual de episodios
- ✅ Creado `frontend/src/components/AnimeModal.jsx` - Modal especializado para anime
- ✅ Modificado `frontend/src/App.jsx` - Integrado búsqueda y modal de anime

---

## 🚀 Cómo Funciona

### **Flujo de Usuario para Anime:**

1. **Usuario hace clic en tab "🎌 Anime"**
   - Muestra filas de categorías de anime (aún usa TMDB como antes)

2. **Usuario busca un anime (ej: "Naruto")**
   - ✨ **NUEVO**: Usa API de AnimeAV1 (base de datos especializada)
   - Muestra resultados con posters, scores, año, estado

3. **Usuario hace clic en un resultado**
   - ✨ **NUEVO**: Abre `AnimeModal` (modal especializado)
   - Carga información completa del anime desde AnimeAV1
   - Muestra: sinopsis, géneros, puntuación, título japonés, etc.

4. **Modal carga lista de episodios**
   - ✨ **NUEVO**: Muestra grid visual de todos los episodios disponibles
   - Episodios en formato: EP 1, EP 2, EP 3...
   - Usuario puede ver todos o solo primeros 24

5. **Usuario selecciona un episodio**
   - ✨ **NUEVO**: Carga servidores disponibles para ese episodio
   - Muestra opciones SUB y DUB si están disponibles
   - Auto-selecciona primer servidor SUB

6. **Usuario hace clic en servidor**
   - ✨ **NUEVO**: Reproduce el episodio con VideoPlayer existente
   - Puede cambiar de servidor sin cerrar el player
   - Muestra información del episodio actual

---

## 📡 Endpoints de API Disponibles

### **Backend (ya funcionando):**

```bash
# Buscar anime
GET /api/anime/search?q=naruto

# Información completa del anime
GET /api/anime/info?url=https://animeav1.com/media/naruto

# Enlaces de episodio específico
GET /api/anime/episode?url=https://animeav1.com/media/naruto/1
```

### **Frontend (funciones disponibles):**

```javascript
import { anime } from './lib/api';

// Buscar
const { data } = await anime.search('naruto');

// Info completa con episodios
const { data } = await anime.getInfo('https://animeav1.com/media/naruto');

// Enlaces de un episodio
const { data } = await anime.getEpisode('https://animeav1.com/media/naruto/1');
```

---

## 🎨 Componentes Nuevos

### **1. AnimeEpisodeSelector**
- Grid responsive de episodios
- Scroll automático para muchos episodios
- Botón "Ver todos" / "Mostrar menos"
- Resalta episodio actualmente seleccionado
- Tooltip con título del episodio

### **2. AnimeModal**
- Especializado para anime con episodios
- Muestra toda la metadata de anime (géneros, score, estado, etc.)
- Selector de episodios integrado
- Selector de servidores (SUB/DUB)
- Reproductor de video integrado
- Navegación fluida entre episodios

---

## 🔄 Diferencias con Sistema Anterior

### **Antes (TMDB + Scrapers):**
```
TMDB → Usuario busca → Selecciona → MovieModal → 
  Busca streams con scrapers de AnimeFLV/JKAnime
```

### **Ahora (AnimeAV1):**
```
AnimeAV1 → Usuario busca → Selecciona → AnimeModal →
  Muestra episodios → Selecciona episodio →
    Carga servidores → Reproduce
```

---

## 🎯 Ventajas del Nuevo Sistema

### ✅ **Mejor Catálogo**
- Base de datos especializada en anime
- Información más completa (título japonés, MAL ID, etc.)
- Géneros específicos de anime
- Estado de emisión (En emisión, Finalizado)

### ✅ **Episodios Estructurados**
- Lista completa de episodios disponibles
- Navegación visual entre episodios
- No necesita adivinar número de episodios

### ✅ **Más Servidores**
- Múltiples opciones por episodio
- SUB y DUB separados
- Servidores: HLS, PDrain, UPNShare, Mega, MP4Upload, etc.

### ✅ **Mejor UX**
- Modal especializado con diseño enfocado en anime
- Grid visual de episodios (estilo Crunchyroll)
- Auto-selección de primer servidor
- Cambio rápido entre episodios

---

## 🔧 Configuración

### **Variables de Entorno (opcional):**

```env
# Backend (.env)
DEFAULT_ANIME_DOMAIN=animeav1.com
REQUEST_TIMEOUT_MS=15000
```

---

## 🧪 Pruebas

### **1. Probar Búsqueda:**
1. Abrir aplicación
2. Hacer clic en tab "🎌 Anime"
3. Buscar "Naruto" o "One Piece"
4. Verificar que aparecen resultados con posters

### **2. Probar Modal de Anime:**
1. Hacer clic en un resultado de búsqueda
2. Verificar que se abre AnimeModal
3. Verificar que muestra sinopsis, géneros, score
4. Verificar que aparece grid de episodios

### **3. Probar Reproducción:**
1. Hacer clic en episodio 1
2. Esperar carga de servidores
3. Verificar que aparecen opciones SUB/DUB
4. Hacer clic en un servidor
5. Verificar que el video se reproduce

### **4. Probar Navegación:**
1. Con video reproduciéndose, hacer clic en "Cambiar servidor"
2. Seleccionar otro servidor
3. Verificar que cambia correctamente
4. Hacer scroll en grid de episodios
5. Seleccionar otro episodio

---

## 🐛 Posibles Problemas y Soluciones

### **Problema: "No se encontraron servidores"**
- **Causa**: El anime no está disponible en AnimeAV1
- **Solución**: Probar con otro anime popular

### **Problema: "Error al cargar episodios"**
- **Causa**: URL del anime inválida o cambió
- **Solución**: Backend lo maneja automáticamente, reintentar

### **Problema: Video no reproduce**
- **Causa**: Servidor temporalmente caído
- **Solución**: Usuario puede cambiar a otro servidor sin cerrar modal

### **Problema: Búsqueda no devuelve resultados**
- **Causa**: Backend no está corriendo o anime no existe
- **Solución**: Verificar que backend esté en ejecución

---

## 🚀 Futuras Mejoras (Opcional)

### **Posibles Expansiones:**

1. **Catálogo de anime sin búsqueda**
   - Crear `AnimeRow` que use API de AnimeAV1 directamente
   - Reemplazar filas de TMDB con categorías de AnimeAV1

2. **Historial de episodios vistos**
   - Guardar progreso en localStorage
   - Marcar episodios vistos en el grid
   - Auto-resumir desde último episodio

3. **Favoritos de anime**
   - Sistema de favoritos específico para anime
   - Notificaciones de nuevos episodios

4. **Descarga de episodios**
   - Mostrar enlaces de descarga (ya disponibles en API)
   - Botón "Descargar" por episodio

5. **Filtros avanzados**
   - Filtrar por género específico de anime
   - Filtrar por estado (En emisión, Finalizado)
   - Ordenar por popularidad, score, año

---

## 📚 Referencias de Código

### **Archivos Clave:**

- `backend/scrapers/animeav1.service.js` - Lógica de scraping
- `frontend/src/components/AnimeModal.jsx` - Modal de anime
- `frontend/src/components/AnimeEpisodeSelector.jsx` - Grid de episodios
- `frontend/src/lib/api.js` - Cliente HTTP con funciones de anime

---

## ✨ Créditos

API Engine creado y mantenido por **FxxMorgan** (https://github.com/FxxMorgan)
Integración en CanalStream por GitHub Copilot
