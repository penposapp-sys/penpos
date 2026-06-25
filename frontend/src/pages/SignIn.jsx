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
    document.title = `PenPOS - ${portalName} Girisi`
  }, [portalName])

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login({ identifier, password, portal, rememberMe })
      nav(isRestaurant ? '/kermes' : '/', { replace: true })
    } catch (err) {
      setError(getFriendlyLoginError(err, {
        wrongPortalMessage: 'Bu hesap bu giris ekrani icin uygun degil.'
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
      systemLabel="RESTORAN / CAFE YONETIMI"
      welcomeTitle="Adisyon, mutfak ve satis akislarinizi tek panelden yonetin."
      welcomeText="Masa yonetimi, paket servis, raporlar ve personel sureclerini duzenli sekilde yonetin."
      formTitle="Restoran Girisi"
      formSubtitle="Uye bilgilerinizle panelinize giris yapin."
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
      forgotTo="/forgot-password?portal=restaurant"
      submitLabel="Giris Yap"
      loadingLabel="Giris yapiliyor..."
      registerTo="/register?type=restaurant"
      registerLabel="Simdi Kaydolun"
      registerText="Yeni restoran hesabinizi olusturun, subenizi ve menunuzu hizlica yayina alin."
      supportTitle="Restoran destegi"
      supportItems={[
        { label: 'Masa + Paket', value: 'Canli operasyon' },
        { label: 'QR Menu', value: 'Hazir altyapi' },
      ]}
      theme="restaurant"
      highlights={['Masa Takibi', 'Mutfak Akisi', 'Paket Servis', 'QR Menu']}
      panelQuote="Cok subeli yapilarda hizli operasyon, net raporlama ve duzenli siparis akisi icin tek ekrandan kontrol saglayin."
      panelCaption="Restoran paneli"
    />
  )
}
