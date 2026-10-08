import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PublicSystemLogin from '../components/PublicSystemLogin.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'
import { getFriendlyLoginError } from '../lib/loginErrors.js'

export default function SignIn({ portal }) {
  const { login } = useAuth()
  const nav = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  useBodyLayoutMode('public-site-layout')

  const isRestaurant = portal === 'restaurant' || portal === 'kermes'
  const portalName = isRestaurant ? 'Restoran' : 'Giris'

  useEffect(() => {
    document.title = `PenPOS - ${portalName} Girişi`
  }, [portalName])

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login({ identifier, password, portal, rememberMe })
      nav(isRestaurant ? '/restoran' : '/', { replace: true })
    } catch (err) {
      setError(getFriendlyLoginError(err, {
        wrongPortalMessage: 'Bu hesap bu giriş ekranı için uygun değil.'
      }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicSystemLogin
      backTo="/login"
      backLabel="Sistem seçimine dön"
      brand="PenPOS"
      systemLabel="RESTORAN / KAFE YÖNETİMİ"
      welcomeTitle="Adisyon, mutfak ve satış akışlarınızı tek panelden yönetin."
      welcomeText="Masa yönetimi, paket servis, raporlar ve personel süreçlerini düzenli şekilde yönetin."
      formTitle="Restoran Girişi"
      formSubtitle="Üye bilgilerinizle panelinize giriş yapın."
      identifierLabel="E-posta / Kullanıcı Adı"
      identifierPlaceholder="E-posta veya kullanıcı adı"
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
      forgotTo="/forgot-password?portal=restaurant"
      submitLabel="Giriş Yap"
      loadingLabel="Giriş yapılıyor..."
      registerTo="/register?type=restaurant"
      registerLabel="Şimdi Kaydolun"
      registerText="Yeni restoran hesabınızı oluşturun, şubenizi ve menünüzü hızla yayına alın."
      supportTitle="Restoran desteği"
      supportItems={[
        { label: 'Masa + Paket', value: 'Canlı operasyon' },
        { label: 'QR Menü', value: 'Hazır altyapı' },
      ]}
      theme="restaurant"
      highlights={['Masa Takibi', 'Mutfak Akışı', 'Paket Servis', 'QR Menü']}
      panelQuote="Çok şubeli yapılarda hızlı operasyon, net raporlama ve düzenli sipariş akışı için tek ekrandan kontrol sağlayın."
      panelCaption="Restoran paneli"
    />
  )
}
