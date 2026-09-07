import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PublicSystemLogin from '../components/PublicSystemLogin.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'
import { getFriendlyLoginError } from '../lib/loginErrors.js'

export default function AnaokuluLogin() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    document.title = 'PenPOS - Anaokulu Girisi'
  }, [])

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const loggedUser = await login({ identifier, password, portal: 'anaokulu', rememberMe })
      const isRegion = loggedUser?.role === 'anaokulu_region_admin' || loggedUser?.regionSystemType === 'anaokulu'
      const isPlatform = loggedUser?.role === 'platform_admin' || loggedUser?.role === 'superadmin'

      if (isRegion || isPlatform) {
        nav('/anaokulu/okullarim', { replace: true })
      } else {
        nav('/anaokulu', { replace: true })
      }
    } catch (err) {
      setError(getFriendlyLoginError(err, {
        wrongPortalMessage: 'Bu hesap bu giris ekrani icin uygun degil. Anaokulu hesabinizla girin.'
      }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicSystemLogin
      backTo="/login"
      backLabel="Sistem secimine don"
      brand="PenPOS"
      systemLabel="ANAOKULU / KREŞ YÖNETİMİ"
      welcomeTitle="Hoş geldiniz"
      welcomeText="Okul yönetim paneline giriş yapın. Öğrenci takibi, ücret planları, tahsilat ve raporlamayı tek panelden yönetin."
      formTitle="Giriş Yap"
      formSubtitle="Üye bilgilerinizle panelinize giriş yapın."
      identifierLabel="E-posta / Kullanıcı Adı"
      identifierPlaceholder="eposta veya kullanıcı adı"
      passwordLabel="Şifre"
      passwordPlaceholder="Şifrenizi girin"
      identifier={identifier}
      password={password}
      rememberMe={rememberMe}
      onRememberMeChange={setRememberMe}
      onIdentifierChange={setIdentifier}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      error={error}
      loading={loading}
      forgotTo="/forgot-password?portal=anaokulu"
      submitLabel="Giriş Yap"
      loadingLabel="Giriş yapılıyor..."
      registerTo="/register?type=anaokulu"
      registerLabel="Şimdi Kaydolun"
      registerText="Okulunuzu hızlıca açın ve öğrenci takibi, ücret planlama, tahsilat süreçlerini düzenli şekilde yönetmeye başlayın."
      theme="anaokulu"
      accentFrom="#5b21b6"
      accentTo="#ec4899"
      highlights={['Öğrenci Takibi', 'Ücret & Taksit Planı', 'Tahsilat & Fatura', 'Raporlama']}
      panelQuote="Okul öncesi eğitim kurumlarında öğrenci, veli, ücret ve tahsilat süreçlerini tek ekrandan, sade ve hızlı şekilde yönetin."
      panelCaption="Anaokulu paneli"
    />
  )
}
