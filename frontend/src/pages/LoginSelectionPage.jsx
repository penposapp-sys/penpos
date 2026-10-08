import React, { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'

export default function LoginSelectionPage() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const type = String(searchParams.get('type') || '').trim().toLowerCase()

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    document.title = 'PenPOS - Giriş Seçimi'
  }, [])

  useEffect(() => {
    if (type === 'restaurant') nav('/login/restoran', { replace: true })
    if (type === 'market') nav('/magaza/login', { replace: true })
    if (type === 'anaokulu' || type === 'kres' || type === 'kreş' || type === 'kindergarten') nav('/anaokulu/login', { replace: true })
  }, [nav, type])

  const handleCardKeyDown = (event, target) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    nav(target)
  }

  return (
    <div className="public-auth-page public-auth-page--website">
      <style>{`
        .public-auth-shell--modal .public-auth-grid--selection .public-auth-card {
          cursor: pointer;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
      <div className="public-auth-shell public-auth-shell--modal public-auth-shell--website">
        <div className="public-auth-head">
          <Link to="/landing" className="public-auth-brand" aria-label="PenPOS ana sayfa">
            <img src="/logo-2.png" alt="PenPOS" />
          </Link>
          <div className="public-auth-head-row">
            <div className="marketing-trial-badge login-selection-badge">Giriş seçimi</div>
            <button
              type="button"
              className="public-auth-close public-auth-close--website"
              aria-label="Ana sayfaya dön"
              onClick={() => nav('/landing', { replace: true })}
            >
              x
            </button>
          </div>
          <h1>Giriş yapmak istediğiniz sistemi seçin</h1>
          <p>Mevcut bağlantılar korunur. İşletmeniz için uygun giriş ekranına aynı tema ile devam edin.</p>
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
            <strong>Restoran / Kafe Girişi</strong>
            <p>Masa, adisyon, paket servis, mutfak ve QR menü akışına tek panelden ulaşın.</p>
            <em>Masa takibi, mutfak akışı ve servis operasyonu</em>
          </div>

          <div
            tabIndex={0}
            data-selected="false"
            className="public-auth-card public-auth-card--website public-auth-card--canteen public-touch-card"
            onClick={() => nav('/magaza/login')}
            onKeyDown={(event) => handleCardKeyDown(event, '/magaza/login')}
          >
            <span aria-hidden="true">🛒</span>
            <strong>Mağaza / Market Girişi</strong>
            <p>Barkodlu hızlı satış, stok hareketi ve cari hesap akışına aynı arayüzle bağlanın.</p>
            <em>Hızlı kasa, stok kontrolü ve fiyat listesi yönetimi</em>
          </div>
        </div>
      </div>
    </div>
  )
}
