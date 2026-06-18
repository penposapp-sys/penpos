import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

export default function PublicSystemLogin({
  backTo = '/login',
  backLabel = 'Sistem seçimine dön',
  brand,
  systemLabel,
  welcomeTitle,
  welcomeText,
  formTitle = 'Giriş Yap',
  formSubtitle,
  identifierLabel,
  identifierPlaceholder,
  passwordLabel = 'Şifre',
  passwordPlaceholder = 'Şifrenizi girin',
  identifier,
  password,
  onIdentifierChange,
  onPasswordChange,
  rememberMe = true,
  onRememberMeChange,
  onSubmit,
  error,
  loading,
  forgotTo = '/forgot-password',
  forgotLabel = 'Şifremi Unuttum?',
  submitLabel = 'Giriş Yap',
  loadingLabel = 'Giriş yapılıyor...',
  registerTo = '/register',
  registerLabel = 'Şimdi Kaydolun',
  registerText = 'İşletmenizi hızlıca açın ve kullanmaya başlayın.',
  showRegister = true,
  supportTitle = 'Destek gerekiyorsa bize ulaşın',
  supportItems = [],
  theme = 'restaurant',
  highlights = [],
  panelQuote,
  panelCaption,
  showRememberMe = true,
}) {
  const [showPassword, setShowPassword] = useState(false)

  const themeClass = useMemo(() => (
    theme === 'canteen'
      ? 'system-login system-login--canteen'
      : theme === 'platform'
        ? 'system-login system-login--platform'
        : 'system-login system-login--restaurant'
  ), [theme])

  return (
    <div className={themeClass}>
      <div className="system-login__shell">
        <section className="system-login__visual">
          <div className="system-login__visual-inner">
            <div>
              <div className="system-login__brand">{brand}</div>
              <div className="system-login__eyebrow">{systemLabel}</div>
              <h1 className="system-login__headline">{welcomeTitle}</h1>
              <p className="system-login__lead">{welcomeText}</p>
            </div>

            <div className="system-login__visual-bottom">
              {highlights.length > 0 && (
                <div className="system-login__chips">
                  {highlights.map((item) => (
                    <span key={item} className="system-login__chip">{item}</span>
                  ))}
                </div>
              )}

              {(panelQuote || panelCaption) && (
                <div className="system-login__quote">
                  {panelQuote ? <p>{panelQuote}</p> : null}
                  {panelCaption ? <strong>{panelCaption}</strong> : null}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="system-login__form-side">
          <div className="system-login__form-wrap">
            <Link to={backTo} className="system-login__back">{backLabel}</Link>
            <div className="system-login__logo-row">
              <div className="system-login__logo-badge">
                <img
                  src="/logo-1.png"
                  alt={brand || 'PenPOS'}
                  className="system-login__logo-image"
                  onError={(event) => { event.currentTarget.src = '/penpos%20logo.png' }}
                />
              </div>
              <div>
                <div className="system-login__logo-name">{brand}</div>
                <div className="system-login__logo-sub">{systemLabel}</div>
              </div>
            </div>

            <div className="system-login__form-head">
              <h2>{formTitle}</h2>
              {formSubtitle ? <p>{formSubtitle}</p> : null}
            </div>

            <form className="system-login__form" onSubmit={onSubmit}>
              <label className="system-login__field">
                <span>{identifierLabel}</span>
                <input
                  className="system-login__input"
                  value={identifier}
                  onChange={(event) => onIdentifierChange(event.target.value)}
                  type="text"
                  placeholder={identifierPlaceholder}
                  autoFocus
                />
              </label>

              <label className="system-login__field">
                <span>{passwordLabel}</span>
                <div className="system-login__password-wrap">
                  <input
                    className="system-login__input"
                    value={password}
                    onChange={(event) => onPasswordChange(event.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    placeholder={passwordPlaceholder}
                  />
                  <button
                    type="button"
                    className="system-login__toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  >
                    {showPassword ? 'Gizle' : 'Göster'}
                  </button>
                </div>
              </label>

              <div className="system-login__meta">
                {showRememberMe && typeof onRememberMeChange === 'function' ? (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => onRememberMeChange(event.target.checked)}
                    />
                    <span>Beni hatirla</span>
                  </label>
                ) : <span />}
                <Link to={forgotTo} className="system-login__text-link">{forgotLabel}</Link>
              </div>

              {error ? <div className="system-login__error">{error}</div> : null}

              <button className="system-login__submit" disabled={loading}>
                {loading ? loadingLabel : submitLabel}
              </button>
            </form>

            {showRegister && (
              <div className="system-login__register">
                <div className="system-login__divider" />
                <div className="system-login__register-copy">
                  <span>Üye değil misiniz?</span>
                  <Link to={registerTo}>{registerLabel}</Link>
                </div>
                <p>{registerText}</p>
              </div>
            )}

            {supportItems.length > 0 && (
              <div className="system-login__support">
                <strong>{supportTitle}</strong>
                <div className="system-login__support-list">
                  {supportItems.map((item) => (
                    <div key={item.label} className="system-login__support-item">
                      <span>{item.label}</span>
                      <b>{item.value}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
