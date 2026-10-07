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
            <div className="marketing-trial-badge login-selection-badge">Giris secimi</div>
            <button
              type="button"
              className="public-auth-close public-auth-close--website"
              aria-label="Ana sayfaya don"
              onClick={() => nav('/landing', { replace: true })}
            >
              x
            </button>
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
            onClick={() => nav('/magaza/login')}
            onKeyDown={(event) => handleCardKeyDown(event, '/magaza/login')}
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
