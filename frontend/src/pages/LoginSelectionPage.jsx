import React, { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'

export default function LoginSelectionPage() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const type = String(searchParams.get('type') || '').trim().toLowerCase()

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    document.title = 'PenPOS - Giri\u015f Se\u00e7imi'
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
            <div className="marketing-trial-badge login-selection-badge">Giri\u015f se\u00e7imi</div>
            <Link to="/" className="public-auth-close public-auth-close--website" aria-label="Ana sayfaya d\u00f6n">
              \u00d7
            </Link>
          </div>
          <h1>Giri\u015f yapmak istedi\u011finiz sistemi se\u00e7in</h1>
          <p>Mevcut ba\u011flant\u0131lar korunur. \u0130\u015fletmeniz i\u00e7in uygun giri\u015f ekran\u0131na ayn\u0131 web sitesi temas\u0131 ile devam edin.</p>
        </div>

        <div className="public-auth-grid public-auth-grid--selection">
          <button type="button" className="public-auth-card public-auth-card--website public-auth-card--restaurant public-touch-card" onClick={() => nav('/login/restoran')}>
            <span aria-hidden="true">{'\u{1F37D}\uFE0F'}</span>
            <strong>Restoran / Cafe Giri\u015fi</strong>
            <p>Masa, adisyon, paket servis, mutfak ve QR men\u00fc ak\u0131\u015f\u0131na tek panelden ula\u015f\u0131n.</p>
            <em>Masa takibi, mutfak ak\u0131\u015f\u0131 ve servis operasyonu</em>
          </button>

          <button type="button" className="public-auth-card public-auth-card--website public-auth-card--canteen public-touch-card" onClick={() => nav('/canteen/login')}>
            <span aria-hidden="true">{'\u{1F6D2}'}</span>
            <strong>Ma\u011faza / Market Giri\u015fi</strong>
            <p>Barkodlu h\u0131zl\u0131 sat\u0131\u015f, stok hareketi ve cari hesap ak\u0131\u015f\u0131na ayn\u0131 premium ekranla ba\u011flan\u0131n.</p>
            <em>H\u0131zl\u0131 kasa, stok kontrol\u00fc ve fiyat listesi y\u00f6netimi</em>
          </button>
        </div>
      </div>
    </div>
  )
}
