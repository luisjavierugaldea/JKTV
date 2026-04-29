import { useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '../config'
import Hls from 'hls.js'

const MultiPlayer = ({ channels, onClose }) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const [layout, setLayout] = useState('auto')
  const [orderedChannels, setOrderedChannels] = useState(channels)

  const videoRefs = useRef([])
  const hlsInstances = useRef([])

  const channelCount = orderedChannels.length

  const getLayout = () => {
    if (channelCount === 1) return 'single'
    if (channelCount === 2) return 'split'
    return 'principal'
  }

  const currentLayout = layout === 'auto' ? getLayout() : layout

  const getUrl = (url) => {
    if (!url) return ''
    if (url.includes('.m3u8')) {
      const base64Url = btoa(unescape(encodeURIComponent(url)))
      return `${API_BASE_URL}/iptv-proxy/stream?url=${base64Url}`
    }
    return url
  }

  useEffect(() => {
    setOrderedChannels(channels)
  }, [channels])

  // 🔥 HLS INIT (FIXED)
  useEffect(() => {
    console.log('🚀 Inicializando HLS para', orderedChannels.length, 'canales')
    
    // Pequeño delay para asegurar que los refs están listos
    const timer = setTimeout(() => {
      orderedChannels.forEach((channel, index) => {
        const video = videoRefs.current[index]
        if (!video || channel.isEmbed) {
          console.log(`⏭️ Skip canal ${index}:`, !video ? 'no ref' : 'es embed')
          return
        }

        const url = getUrl(channel.url)
        console.log(`📺 Inicializando canal ${index}: ${channel.name}`)

        // destruir si ya existía
        if (hlsInstances.current[index]) {
          hlsInstances.current[index].destroy()
          hlsInstances.current[index] = null
        }

        if ((url.includes('.m3u8') || url.includes('m3u8')) && Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
          })

          hls.loadSource(url)
          hls.attachMedia(video)

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log(`✅ Canal ${index} listo: ${channel.name}`)
            // Iniciar reproducción de TODOS los canales
            video.play().catch(() => {})
          })

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.error(`❌ Error fatal canal ${index}:`, data.type, data.details)
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                hls.startLoad()
              } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                hls.recoverMediaError()
              } else {
                hls.destroy()
                hlsInstances.current[index] = null
              }
            }
          })

          hlsInstances.current[index] = hls
        } else {
          console.log(`🍎 Usando Safari nativo para canal ${index}`)
          video.src = url
          video.play().catch(() => {})
        }
      })
    }, 300)

    return () => {
      clearTimeout(timer)
      hlsInstances.current.forEach(h => h && h.destroy())
      hlsInstances.current = []
    }
  }, [orderedChannels])

  // 🔥 AUDIO CONTROL FIX
  useEffect(() => {
    console.log('🔊 Control de audio - Canal activo:', activeIndex)
    
    videoRefs.current.forEach((video, i) => {
      if (!video) return

      const isActive = i === activeIndex
      
      // Solo el activo tiene audio
      video.muted = !isActive
      video.volume = isActive ? 1 : 0
      
      // Asegurar que todos están reproduciendo
      if (video.paused) {
        video.play().catch(() => {})
      }
    })
  }, [activeIndex])

  const handleClick = (index) => {
    setActiveIndex(index)
  }

  const renderVideo = (channel, index, isMain = false) => {
    const isActive = index === activeIndex

    return (
      <div
        key={`video-${channel.url}-${index}`}
        onClick={() => handleClick(index)}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background: '#000',
          borderRadius: isMain ? '12px' : '8px',
          overflow: 'hidden',
          border: isActive ? '3px solid #10b981' : '2px solid #333',
          cursor: 'pointer'
        }}
      >
        <video
          ref={(el) => {
            if (el) videoRefs.current[index] = el
          }}
          autoPlay
          playsInline
          muted
          controls={isMain}
          preload="auto"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />

        {isActive && (
          <div style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            background: '#10b981',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: '6px',
            fontWeight: 'bold'
          }}>
            🔊 AUDIO
          </div>
        )}

        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          padding: '5px',
          fontSize: '0.8rem'
        }}>
          {channel.name}
        </div>
      </div>
    )
  }

  const renderHeader = () => (
    <div style={{
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 1000
    }}>
      <button
        onClick={onClose}
        style={{
          background: '#ef4444',
          color: '#fff',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        ❌ Cerrar
      </button>
    </div>
  )

  // SINGLE
  if (currentLayout === 'single') {
    return (
      <div style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: '#000',
        zIndex: 9999
      }}>
        {renderHeader()}
        <div style={{ width: '100%', height: '100%', padding: '5px' }}>
          {renderVideo(orderedChannels[0], 0, true)}
        </div>
      </div>
    )
  }

  // SPLIT
  if (currentLayout === 'split') {
    return (
      <div style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: '#000',
        zIndex: 9999
      }}>
        {renderHeader()}
        <div style={{
          display: 'flex',
          // En móvil: vertical (arriba/abajo)
          // En web/TV: horizontal (izquierda/derecha)
          flexDirection: window.innerWidth < 768 ? 'column' : 'row',
          width: '100%',
          height: '100%',
          gap: '5px',
          padding: '5px'
        }}>
          {orderedChannels.slice(0, 2).map((c, i) =>
            <div key={i} style={{ flex: 1, width: '100%', height: '100%' }}>
              {renderVideo(c, i)}
            </div>
          )}
        </div>
      </div>
    )
  }

  // PRINCIPAL - Layout fijo sin mover videos
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      background: '#000',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {renderHeader()}

      {/* Grid de todos los canales - sin reordenar */}
      <div style={{
        width: '100%',
        height: '100%',
        padding: '5px',
        boxSizing: 'border-box',
        display: 'grid',
        gap: '5px',
        // Layout: el activo es 70% alto, los demás comparten 30%
        gridTemplateRows: orderedChannels.length === 3 
          ? activeIndex === 0 ? '70% 15% 15%' 
            : activeIndex === 1 ? '15% 70% 15%'
            : '15% 15% 70%'
          : orderedChannels.length === 4
          ? activeIndex === 0 ? '70% 10% 10% 10%'
            : activeIndex === 1 ? '10% 70% 10% 10%'
            : activeIndex === 2 ? '10% 10% 70% 10%'
            : '10% 10% 10% 70%'
          : '100%'
      }}>
        {orderedChannels.map((channel, index) =>
          renderVideo(channel, index, index === activeIndex)
        )}
      </div>
    </div>
  )
}

export default MultiPlayer