import axios from 'axios'

// KEYWORDS
const SPORTS = ['sport','espn','fox','tnt','dazn','bein','setanta','sky']
const LATAM = ['mx','mexico','latino','es','esp','col','arg','peru','chile']
const MOVIES = ['cine','movie','pelicula','films','cinema','24/7']

// CACHE SIMPLE EN MEMORIA
let cache = {
  data: [],
  timestamp: 0
}

const CACHE_TTL = 30 * 60 * 1000 // 30 min

// DETECTAR CALIDAD
function detectQuality(name) {
  const n = name.toLowerCase()
  if (n.includes('4k') || n.includes('uhd')) return 4
  if (n.includes('1080')) return 3
  if (n.includes('720')) return 2
  return 1
}

// TIPO
function detectType(name) {
  const n = name.toLowerCase()
  if (SPORTS.some(k => n.includes(k))) return 'sports'
  if (MOVIES.some(k => n.includes(k))) return 'movies'
  return 'tv'
}

// FILTRO
function isRelevant(name, group = '') {
  const n = name.toLowerCase()
  const g = group.toLowerCase()

  // Deportes sin filtro idioma
  if (SPORTS.some(k => n.includes(k) || g.includes(k))) return true

  // Películas
  if (MOVIES.some(k => n.includes(k))) return true

  // LATAM general
  if (LATAM.some(k => n.includes(k) || g.includes(k))) return true

  return false
}

// PARSE M3U
async function parseM3U(url) {
  const res = await axios.get(url, { timeout: 10000 })
  const lines = res.data.split('\n')

  const channels = []
  let current = {}

  for (let line of lines) {
    line = line.trim()

    if (line.startsWith('#EXTINF')) {
      const nameMatch = line.match(/,(.*)$/)
      const groupMatch = line.match(/group-title="([^"]+)"/)

      current = {
        name: nameMatch ? nameMatch[1] : 'Unknown',
        group: groupMatch ? groupMatch[1] : ''
      }
    }

    if (line.startsWith('http')) {
      if (isRelevant(current.name, current.group)) {
        channels.push({
  id: `${current.name}-${Math.random()}`,
  name: current.name,
  group: current.group,
  url: line,
  quality: detectQuality(current.name),

  // 🔥 AÑADE ESTO (CRÍTICO)
  category: detectCategory(current.name),
  country: detectCountry(current.name),
  language: 'es',

  source: 'm3u',
  logo: '📺'
})
      }
    }
  }

  return channels
}

// HEALTH CHECK
async function checkStream(url) {
  try {
    const res = await axios.head(url, { timeout: 5000 })
    return res.status < 400
  } catch {
    return false
  }
}

function detectCategory(name) {
  const n = name.toLowerCase()

  if (SPORTS.some(k => n.includes(k))) return 'sports'
  if (MOVIES.some(k => n.includes(k))) return 'entertainment'
  if (n.includes('news')) return 'news'

  return 'other'
}

function detectCountry(name) {
  const n = name.toLowerCase()

  if (n.includes('mex') || n.includes('mx')) return 'mexico'
  if (n.includes('col')) return 'colombia'
  if (n.includes('arg')) return 'argentina'
  if (n.includes('peru')) return 'peru'
  if (n.includes('chile')) return 'chile'
  if (n.includes('esp')) return 'españa'

  return 'latam'
}

// RANKING
function rankChannels(channels) {
  return channels.map(c => {
    let score = 0

    score += c.quality * 10

    if (c.type === 'sports') score += 15
    if (c.type === 'movies') score += 10

    if (c.isAlive) score += 20

    return { ...c, score }
  })
  .sort((a, b) => b.score - a.score)
}

// MAIN ENGINE
export async function getChannels(sources) {
  const now = Date.now()

  if (cache.data.length && (now - cache.timestamp) < CACHE_TTL) {
    return cache.data
  }

  const results = await Promise.allSettled(
    sources.map(s => parseM3U(s.url))
  )

  let channels = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)

  // deduplicar
  const seen = new Set()
  channels = channels.filter(c => {
    if (seen.has(c.url)) return false
    seen.add(c.url)
    return true
  })

  // health check básico (batch pequeño)
  const sample = channels.slice(0, 50)
  await Promise.all(sample.map(async c => {
    c.isAlive = await checkStream(c.url)
    c.lastChecked = Date.now()
  }))

  channels = rankChannels(channels)

  cache = {
    data: channels,
    timestamp: now
  }

  return channels
}