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
    orderedChannels.forEach((channel, index) => {
      const video = videoRefs.current[index]
      if (!video || channel.isEmbed) return

      const url = getUrl(channel.url)

      // destruir si ya existía
      if (hlsInstances.current[index]) {
        hlsInstances.current[index].destroy()
        hlsInstances.current[index] = null
      }

      if ((url.includes('.m3u8') || url.includes('m3u8')) && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          maxBufferLength: 30,
        })

        hls.loadSource(url)
        hls.attachMedia(video)

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const isActive = index === activeIndex

          video.muted = !isActive

          video.oncanplay = () => {
            if (isActive) {
              video.play().catch(() => {})
            }
          }
        })

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
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
        video.src = url
        video.muted = true

        video.oncanplay = () => {
          if (index === activeIndex) {
            video.play().catch(() => {})
          }
        }
      }
    })

    return () => {
      hlsInstances.current.forEach(h => h && h.destroy())
      hlsInstances.current = []
    }
  }, [orderedChannels])

  // 🔥 AUDIO CONTROL FIX
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return

      const isActive = i === activeIndex

      video.muted = true

      if (isActive) {
        video.muted = false
        video.volume = 1

        if (video.paused) {
          video.play().catch(() => {})
        }
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
        key={index}
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
          playsInline
          muted
          controls={isMain}
          preload="metadata"
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

  // PRINCIPAL
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
      gap: '5px',
      padding: '5px'
    }}>
      {renderHeader()}

      <div style={{ flex: 3, width: '100%' }}>
        {renderVideo(orderedChannels[activeIndex], activeIndex, true)}
      </div>

      <div style={{
        flex: 1,
        width: '100%',
        display: 'grid',
        gridTemplateColumns: `repeat(${orderedChannels.length - 1}, 1fr)`,
        gap: '5px'
      }}>
        {orderedChannels.map((c, i) =>
          i !== activeIndex && renderVideo(c, i)
        )}
      </div>
    </div>
  )
}

export default MultiPlayer