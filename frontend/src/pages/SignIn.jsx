import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PublicSystemLogin from '../components/PublicSystemLogin.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'

const buildLoginErrorMessage = (baseMessage, error) => {
  const responseData = error?.response?.data
  const serializedResponseData = typeof responseData === 'string'
    ? responseData
    : responseData
      ? JSON.stringify(responseData)
      : ''
  const errorMessage = String(error?.message || '').trim()
  const parts = [baseMessage]

  if (serializedResponseData) parts.push(`response.data: ${serializedResponseData}`)
  if (errorMessage) parts.push(`message: ${errorMessage}`)

  return parts.join(' | ')
}

export default function SignIn({ portal }) {
  const { login } = useAuth()
  const nav = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useBodyLayoutMode('public-site-layout')

  const isRestaurant = portal === 'kermes'
  const portalName = isRestaurant ? 'Restoran' : 'Giriş'

  useEffect(() => {
    document.title = `PenPOS - ${portalName} Girişi`
  }, [portalName])

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login({ identifier, password, portal })
      nav(isRestaurant ? '/kermes' : '/', { replace: true })
    } catch (err) {
      console.error(err)
      const code = err?.code || null
      if (code === 'invalid_credentials') setError(buildLoginErrorMessage('E-posta / şifre hatalı', err))
      else if (code === 'account_disabled') setError(buildLoginErrorMessage('Hesap devre dışı', err))
      else if (code === 'wrong_portal') setError(buildLoginErrorMessage('Yanlış giriş ekranı', err))
      else setError(buildLoginErrorMessage('Giriş başarısız', err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicSystemLogin
      backTo="/login"
      backLabel="Sistem seçimine dön"
      brand="PenPOS"
      systemLabel="RESTORAN / CAFE YÖNETİMİ"
      welcomeTitle="Adisyon, mutfak ve satış akışını tek panelden yönetin."
      welcomeText="Masa yönetimi, paket servis, raporlar ve personel süreçlerini düzenli şekilde yönetin."
      formTitle="Restoran Girişi"
      formSubtitle="Üye bilgilerinizle panelinize giriş yapın."
      identifierLabel="E-posta / Kullanıcı Adı"
      identifierPlaceholder="eposta veya kullanıcı adı"
      passwordLabel="Şifre"
      passwordPlaceholder="şifrenizi girin"
      identifier={identifier}
      password={password}
      onIdentifierChange={setIdentifier}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      error={error}
      loading={loading}
      forgotTo="/forgot-password?portal=kermes"
      submitLabel="Giriş Yap"
      loadingLabel="Giriş yapılıyor..."
      registerTo="/register?type=restaurant"
      registerLabel="Şimdi Kaydolun"
      registerText="Yeni restoran hesabınızı oluşturun, şubenizi ve menünüzü hızlıca yayına alın."
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
