import React, { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'

export default function LoginSelectionPage() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const type = String(searchParams.get('type') || '').trim().toLowerCase()

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    document.title = 'PenPOS - Giris Secimi'
  }, [])

  useEffect(() => {
    if (type === 'restaurant') nav('/login/restoran', { replace: true })
    if (type === 'market') nav('/canteen/login', { replace: true })
  }, [nav, type])

  const handleCardKeyDown = (event, target) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    nav(target)
  }

  return (
    <div className="public-auth-page public-auth-page--website">
      <style>{`
        .public-auth-shell--modal .public-auth-grid--selection .public-auth-card,
        html[data-theme="light"].theme-white body.public-site-layout .public-auth-shell--modal .public-auth-grid--selection .public-auth-card,
        body.mobile-performance-mode.public-site-layout .public-auth-shell--modal .public-auth-grid--selection .public-auth-card {
          background: linear-gradient(180deg, rgba(52, 42, 36, 0.96) 0%, rgba(39, 31, 27, 0.99) 100%) !important;
          border: 1px solid rgba(208, 138, 89, 0.2) !important;
          color: #fff8ef !important;
          box-shadow: 0 20px 38px rgba(24, 15, 11, 0.28) !important;
        }

        .public-auth-shell--modal .public-auth-grid--selection .public-auth-card:hover,
        html[data-theme="light"].theme-white body.public-site-layout .public-auth-shell--modal .public-auth-grid--selection .public-auth-card:hover,
        body.mobile-performance-mode.public-site-layout .public-auth-shell--modal .public-auth-grid--selection .public-auth-card:hover {
          background: linear-gradient(180deg, rgba(60, 47, 40, 0.98) 0%, rgba(44, 34, 29, 1) 100%) !important;
          border-color: rgba(208, 138, 89, 0.34) !important;
        }

        .public-auth-shell--modal .public-auth-grid--selection .public-auth-card :is(strong, p, em, span, svg, svg *, i),
        html[data-theme="light"].theme-white body.public-site-layout .public-auth-shell--modal .public-auth-grid--selection .public-auth-card :is(strong, p, em, span, svg, svg *, i),
        body.mobile-performance-mode.public-site-layout .public-auth-shell--modal .public-auth-grid--selection .public-auth-card :is(strong, p, em, span, svg, svg *, i) {
          color: inherit !important;
          fill: currentColor !important;
          stroke: currentColor !important;
        }

        .public-auth-shell--modal .public-auth-grid--selection .public-auth-card p,
        .public-auth-shell--modal .public-auth-grid--selection .public-auth-card em {
          color: rgba(255, 248, 239, 0.8) !important;
        }

        .public-auth-shell--modal .public-auth-grid--selection .public-auth-card {
          cursor: pointer;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
      <div className="public-auth-shell public-auth-shell--modal public-auth-shell--website">
        <div className="public-auth-head">
          <div className="public-auth-head-row">
            <div className="marketing-trial-badge login-selection-badge">Giris secimi</div>
            <Link to="/" className="public-auth-close public-auth-close--website" aria-label="Ana sayfaya don">
              x
            </Link>
          </div>
          <h1>Giris yapmak istediginiz sistemi secin</h1>
          <p>Mevcut baglantilar korunur. Isletmeniz icin uygun giris ekranina ayni tema ile devam edin.</p>
        </div>

        <div className="public-auth-grid public-auth-grid--selection">
          <div
            tabIndex={0}
            data-selected="false"
            className="public-auth-card public-auth-card--website public-auth-card--restaurant public-touch-card"
            onClick={() => nav('/login/restoran')}
            onKeyDown={(event) => handleCardKeyDown(event, '/login/restoran')}
          >
            <span aria-hidden="true">🍽️</span>
            <strong>Restoran / Cafe Girisi</strong>
            <p>Masa, adisyon, paket servis, mutfak ve QR menu akisina tek panelden ulasin.</p>
            <em>Masa takibi, mutfak akisi ve servis operasyonu</em>
          </div>

          <div
            tabIndex={0}
            data-selected="false"
            className="public-auth-card public-auth-card--website public-auth-card--canteen public-touch-card"
            onClick={() => nav('/canteen/login')}
            onKeyDown={(event) => handleCardKeyDown(event, '/canteen/login')}
          >
            <span aria-hidden="true">🛒</span>
            <strong>Magaza / Market Girisi</strong>
            <p>Barkodlu hizli satis, stok hareketi ve cari hesap akisina ayni premium ekranla baglanin.</p>
            <em>Hizli kasa, stok kontrolu ve fiyat listesi yonetimi</em>
          </div>
        </div>
      </div>
    </div>
  )
}
