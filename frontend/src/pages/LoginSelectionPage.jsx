import React, { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'

export default function LoginSelectionPage() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const type = String(searchParams.get('type') || '').trim().toLowerCase()

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    document.title = 'PenPOS - GiriÅŸ SeÃ§imi'
  }, [])

  useEffect(() => {
    if (type === 'restaurant') nav('/login/restoran', { replace: true })
    if (type === 'market') nav('/canteen/login', { replace: true })
  }, [nav, type])

  return (
    <div className="public-auth-page public-auth-page--website">
      <div className="public-auth-shell public-auth-shell--modal public-auth-shell--website">
        <div className="public-auth-head">
          <div className="public-auth-head-row">
            <div className="marketing-trial-badge login-selection-badge">GiriÅŸ seÃ§imi</div>
            <Link to="/" className="public-auth-close public-auth-close--website" aria-label="Ana sayfaya dÃ¶n">
              Ã—
            </Link>
          </div>
          <h1>GiriÅŸ yapmak istediÄŸiniz sistemi seÃ§in</h1>
          <p>Mevcut baÄŸlantÄ±lar korunur. Ä°ÅŸletmeniz iÃ§in uygun giriÅŸ ekranÄ±na aynÄ± web sitesi temasÄ± ile devam edin.</p>
        </div>

        <div className="public-auth-grid public-auth-grid--selection">
          <button type="button" className="public-auth-card public-auth-card--website public-auth-card--restaurant public-touch-card" onClick={() => nav('/login/restoran')}>
            <span aria-hidden="true">ğŸ½</span>
            <strong>Restoran / Cafe GiriÅŸi</strong>
            <p>Masa, adisyon, paket servis, mutfak ve QR menÃ¼ akÄ±ÅŸÄ±na tek panelden ulaÅŸÄ±n.</p>
            <em>Masa takibi, mutfak akÄ±ÅŸÄ± ve servis operasyonu</em>
          </button>

          <button type="button" className="public-auth-card public-auth-card--website public-auth-card--canteen public-touch-card" onClick={() => nav('/canteen/login')}>
            <span aria-hidden="true">ğŸ›’</span>
            <strong>MaÄŸaza / Market GiriÅŸi</strong>
            <p>Barkodlu hÄ±zlÄ± satÄ±ÅŸ, stok hareketi ve cari hesap akÄ±ÅŸÄ±na aynÄ± premium ekranla baÄŸlanÄ±n.</p>
            <em>HÄ±zlÄ± kasa, stok kontrolÃ¼ ve fiyat listesi yÃ¶netimi</em>
          </button>
        </div>
      </div>
    </div>
  )
}
