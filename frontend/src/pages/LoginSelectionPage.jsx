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
    if (type === 'market') nav('/canteen/login', { replace: true })
  }, [nav, type])

  return (
    <div className="public-auth-page public-auth-page--website">
      <div className="public-auth-shell public-auth-shell--modal public-auth-shell--website">
        <div className="public-auth-head">
          <div className="public-auth-head-row">
            <div className="marketing-trial-badge login-selection-badge">Giriş seçimi</div>
            <Link to="/" className="public-auth-close public-auth-close--website" aria-label="Ana sayfaya dön">
              ×
            </Link>
          </div>
          <h1>Giriş yapmak istediğiniz sistemi seçin</h1>
          <p>Mevcut bağlantılar korunur. İşletmeniz için uygun giriş ekranına aynı web sitesi teması ile devam edin.</p>
        </div>

        <div className="public-auth-grid public-auth-grid--selection">
          <Link to="/login/restoran" className="public-auth-card public-auth-card--website public-auth-card--restaurant">
            <span aria-hidden="true">🍽</span>
            <strong>Restoran / Cafe Girişi</strong>
            <p>Masa, adisyon, paket servis, mutfak ve QR menü akışına tek panelden ulaşın.</p>
            <em>Masa takibi, mutfak akışı ve servis operasyonu</em>
          </Link>

          <Link to="/canteen/login" className="public-auth-card public-auth-card--website public-auth-card--canteen">
            <span aria-hidden="true">🛒</span>
            <strong>Mağaza / Market Girişi</strong>
            <p>Barkodlu hızlı satış, stok hareketi ve cari hesap akışına aynı premium ekranla bağlanın.</p>
            <em>Hızlı kasa, stok kontrolü ve fiyat listesi yönetimi</em>
          </Link>
        </div>
      </div>
    </div>
  )
}
