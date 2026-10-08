import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PublicSystemLogin from '../../components/PublicSystemLogin.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useBodyLayoutMode } from '../../hooks/useBodyLayoutMode.js'
import { getFriendlyLoginError } from '../../lib/loginErrors.js'

export default function CanteenLogin() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    document.title = 'PenPOS - Mağaza Girişi'
  }, [])

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login({ identifier, password, portal: 'canteen', rememberMe })
      nav('/magaza', { replace: true })
    } catch (err) {
      setError(getFriendlyLoginError(err, {
        wrongPortalMessage: 'Bu hesap mağaza giriş ekranı için uygun değil.'
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
      systemLabel="MAĞAZA / MARKET YÖNETİMİ"
      welcomeTitle="Hızlı kasa, stok ve cari akışlarınızı tek ekranda toplayın."
      welcomeText="Barkodlu satış, stok hareketleri, cari bakiyeler ve günlük raporlarla operasyonu sade ve hızlı yönetin."
      formTitle="Mağaza Girişi"
      formSubtitle="Mağaza veya market panelinize giriş yapın."
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
      forgotTo="/forgot-password?portal=canteen"
      submitLabel="Giriş Yap"
      loadingLabel="Giriş yapılıyor..."
      registerTo="/register?type=market"
      registerLabel="Yeni İşletme Kaydı"
      registerText="Mağaza veya market hesabınızı açın, ürünlerinizi ve şubelerinizi kolayca yönetin."
      supportTitle="Mağaza desteği"
      supportItems={[
        { label: 'Barkodlu Satış', value: 'Hızlı kasa' },
        { label: 'Stok + Cari', value: 'Tek panel' },
      ]}
      theme="canteen"
      highlights={['Hızlı Kasa', 'Stok Takibi', 'Cari Hesap', 'Şube Yönetimi']}
      panelQuote="Yoğun satış saatlerinde kasayı yavaşlatmadan ürün, stok ve cari akışlarını tek panelden kontrol edin."
      panelCaption="Mağaza paneli"
    />
  )
}
