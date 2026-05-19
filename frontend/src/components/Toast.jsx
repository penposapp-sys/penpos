import React, { useEffect, useState } from 'react'

export default function Toast() {
  const [toasts, setToasts] = useState([])
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 768
  })

  useEffect(() => {
    const handler = (e) => {
      const id = Date.now() + Math.random()
      setToasts(prev => [...prev, { ...e.detail, id }])
      const duration = Math.max(1000, Number(e?.detail?.duration || 3000))
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }
    window.addEventListener('toast', handler)
    return () => window.removeEventListener('toast', handler)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const sync = () => setIsMobile(window.innerWidth <= 768)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        top: isMobile ? 'auto' : 20,
        right: isMobile ? 12 : 20,
        bottom: isMobile ? 84 : 'auto',
        left: isMobile ? 12 : 'auto',
        alignItems: isMobile ? 'stretch' : 'flex-end',
        pointerEvents: 'none'
      }}
    >
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === 'error' ? '#ef4444' : t.type === 'success' ? '#10b981' : '#3b82f6',
          color: 'white',
          padding: '12px 20px',
          borderRadius: 14,
          minWidth: isMobile ? 0 : 220,
          maxWidth: isMobile ? '100%' : 360,
          boxShadow: '0 14px 32px rgba(15,23,42,0.24)',
          fontSize: 14,
          fontWeight: 700,
          pointerEvents: 'auto'
        }}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
