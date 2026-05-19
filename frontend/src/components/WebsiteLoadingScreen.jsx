import React from 'react'

export default function WebsiteLoadingScreen({
  badge = 'PenPOS',
  title = 'Ekran hazirlaniyor',
  message = 'Web sitesi temasina uygun arayuz ve oturum bilgileri yukleniyor.',
  compact = false,
}) {
  const shellClassName = compact
    ? 'public-auth-shell public-auth-shell--modal public-auth-shell--website website-loading-shell website-loading-shell--compact'
    : 'public-auth-shell public-auth-shell--modal public-auth-shell--website website-loading-shell'

  return (
    <div className="public-auth-page public-auth-page--website website-loading-page">
      <div className={shellClassName}>
        <div className="website-loading-badge">{badge}</div>
        <div className="website-loading-spinner" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="website-loading-copy">
          <h1>{title}</h1>
          <p>{message}</p>
        </div>
      </div>
    </div>
  )
}
