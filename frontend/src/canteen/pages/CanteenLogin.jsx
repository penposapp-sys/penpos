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
    document.title = 'PenPOS - Magaza Girisi'
  }, [])

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login({ identifier, password, portal: 'canteen', rememberMe })
      nav('/canteen', { replace: true })
    } catch (err) {
      setError(getFriendlyLoginError(err, {
        wrongPortalMessage: 'Bu hesap magaza giris ekrani icin uygun degil.'
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
      systemLabel="KANTIN / MARKET YONETIMI"
      welcomeTitle="Hizli kasa, stok ve cari akislarinizi tek ekranda toplayin."
      welcomeText="Barkodlu satis, stok hareketleri, cari bakiyeler ve gunluk raporlar ile operasyonu sade ve hizli yonetin."
      formTitle="Magaza Girisi"
      formSubtitle="Magaza veya market panelinize giris yapin."
      identifierLabel="E-posta / Kullanici Adi"
      identifierPlaceholder="eposta veya kullanici adi"
      passwordLabel="Sifre"
      passwordPlaceholder="sifrenizi girin"
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
      submitLabel="Giris Yap"
      loadingLabel="Giris yapiliyor..."
      registerTo="/register?type=market"
      registerLabel="Yeni Isletme Kaydi"
      registerText="Magaza veya market hesabinizi acin, urunlerinizi ve subelerinizi kolayca yonetin."
      supportTitle="Magaza destegi"
      supportItems={[
        { label: 'Barkodlu Satis', value: 'Hizli kasa' },
        { label: 'Stok + Cari', value: 'Tek panel' },
      ]}
      theme="canteen"
      highlights={['Hizli Kasa', 'Stok Takibi', 'Cari Hesap', 'Sube Yonetimi']}
      panelQuote="Yogun satis saatlerinde kasayi yavaslatmadan urun, stok ve cari akislarini tek panelden kontrol edin."
      panelCaption="Magaza paneli"
    />
  )
}
