# Scraper de AnimeAV1 - Guía de Uso

## 📖 Descripción

Servicio de scraping para AnimeAV1 que extrae información de anime, episodios y enlaces de reproducción desde animeav1.com. Este scraper reemplaza el sistema anterior que estaba fallando.

## 🚀 Endpoints Disponibles

### 1. **Buscar Anime**
```
GET /api/anime/search?q=naruto
```

**Parámetros:**
- `q` (requerido): Término de búsqueda
- `domain` (opcional): Dominio alternativo (default: animeav1.com)

**Respuesta de ejemplo:**
```json
{
  "success": true,
  "data": {
    "query": "naruto",
    "results": [
      {
        "id": 123,
        "title": "Naruto",
        "slug": "naruto",
        "url": "https://animeav1.com/media/naruto",
        "image": "https://animeav1.com/poster.jpg",
        "backdrop": "https://animeav1.com/backdrop.jpg",
        "type": "Serie",
        "score": 8.5,
        "status": "Finalizado",
        "year": "2002"
      }
    ],
    "count": 1
  },
  "source": "json"
}
```

### 2. **Información del Anime**
```
GET /api/anime/info?url=https://animeav1.com/media/naruto
```

**Parámetros:**
- `url` (requerido): URL completa del anime en AnimeAV1

**Respuesta de ejemplo:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "title": "Naruto",
    "titleJapanese": "ナルト",
    "description": "Descripción del anime...",
    "image": "https://animeav1.com/poster.jpg",
    "backdrop": "https://animeav1.com/backdrop.jpg",
    "status": "Finalizado",
    "type": "Serie",
    "year": "2002",
    "startDate": "2002-10-03",
    "endDate": "2007-02-08",
    "score": 8.5,
    "votes": 50000,
    "totalEpisodes": 220,
    "malId": 20,
    "trailer": "https://youtube.com/...",
    "genres": [
      {
        "id": 1,
        "name": "Acción",
        "slug": "accion",
        "malId": 1
      }
    ],
    "episodes": [
      {
        "id": 1,
        "number": 1,
        "title": "Episodio 1",
        "url": "https://animeav1.com/media/naruto/1"
      }
    ]
  },
  "source": "json"
}
```

### 3. **Enlaces del Episodio**
```
GET /api/anime/episode?url=https://animeav1.com/media/naruto/1&includeMega=false&excludeServers=pdrain
```

**Parámetros:**
- `url` (requerido): URL completa del episodio
- `includeMega` (opcional): Incluir enlaces de Mega (default: false)
- `excludeServers` (opcional): Lista separada por comas de servidores a excluir

**Respuesta de ejemplo:**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "episode": 1,
    "title": "Episodio 1",
    "season": null,
    "variants": {
      "SUB": 1,
      "DUB": 0
    },
    "publishedAt": "2024-01-01T00:00:00.000Z",
    "servers": {
      "sub": [
        {
          "server": "HLS",
          "url": "https://player.example.com/embed/123"
        }
      ],
      "dub": []
    },
    "streamLinks": {
      "SUB": [
        {
          "server": "HLS",
          "url": "https://player.example.com/embed/123"
        }
      ],
      "DUB": []
    },
    "downloadLinks": {
      "SUB": [
        {
          "server": "PDrain",
          "url": "https://pixeldrain.com/u/abc123",
          "quality": "1080p"
        }
      ],
      "DUB": []
    }
  },
  "source": "json"
}
```

## 🔧 Configuración

### Variables de Entorno (.env)
```env
DEFAULT_ANIME_DOMAIN=animeav1.com
REQUEST_TIMEOUT_MS=15000
```

## 📝 Servidores Soportados

El scraper reconoce automáticamente estos servidores:
- **PDrain** (Pixeldrain)
- **HLS** (M3U8, Zilla, Player)
- **UPNShare** (uns.bio)
- **Mega** (mega.nz)
- **MP4Upload**
- **1Fichier**
- **Fembed**

## 🎯 Características

### ✅ Funcionalidades Implementadas
- Búsqueda de anime por nombre
- Extracción de información completa del anime
- Obtención de enlaces de episodios (SUB/DUB)
- Filtrado de servidores
- Normalización automática de URLs
- Soporte para dominios alternativos
- Extracción de datos desde JSON de SvelteKit
- Fallback a scraping HTML si JSON no está disponible

### 🛡️ Manejo de Errores
- Validación de parámetros requeridos
- Timeouts configurables
- Manejo de redirecciones
- Mensajes de error descriptivos

## 🧪 Pruebas de Ejemplo

### Buscar anime:
```bash
curl "http://localhost:3000/api/anime/search?q=one+piece"
```

### Obtener información:
```bash
curl "http://localhost:3000/api/anime/info?url=https://animeav1.com/media/one-piece"
```

### Obtener enlaces de episodio:
```bash
curl "http://localhost:3000/api/anime/episode?url=https://animeav1.com/media/one-piece/1&includeMega=false"
```

## 📚 Dependencias

- `axios` - Para peticiones HTTP
- `cheerio` - Para parsing de HTML
- `node:vm` - Para evaluación segura de código JavaScript
- `node:url` - Para manejo de URLs

## 🔒 Seguridad

- Evaluación de código JavaScript en contexto aislado (VM)
- Timeout de 1 segundo para evaluaciones
- Validación de URLs
- Headers HTTP seguros
- Sin ejecución de código malicioso

## 🚀 Integración con el Frontend

Ejemplo de uso desde React:

```javascript
import { api } from './lib/api';

// Buscar anime
const searchAnime = async (query) => {
  const response = await api.get(`/anime/search?q=${encodeURIComponent(query)}`);
  return response.data;
};

// Obtener información
const getAnimeInfo = async (url) => {
  const response = await api.get(`/anime/info?url=${encodeURIComponent(url)}`);
  return response.data;
};

// Obtener enlaces
const getEpisodeLinks = async (url) => {
  const response = await api.get(`/anime/episode?url=${encodeURIComponent(url)}`);
  return response.data;
};
```

## 📄 Créditos

API Engine creado y mantenido por **FxxMorgan** (https://github.com/FxxMorgan)
