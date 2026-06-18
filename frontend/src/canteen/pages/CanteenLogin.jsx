import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PublicSystemLogin from '../../components/PublicSystemLogin.jsx'
import { useBodyLayoutMode } from '../../hooks/useBodyLayoutMode.js'
import { api } from '../../lib/apiClient.js'

const getFriendlyLoginError = (error) => {
  const code = String(error?.code || error?.response?.data?.code || error?.response?.data?.error || '').trim()
  if (code === 'account_disabled') return 'Hesabınız devre dışı. Lütfen yetkilinizle iletişime geçin.'
  if (code === 'wrong_portal') return 'Bu hesap mağaza giriş ekranı için uygun değil.'
  return 'Giriş başarısız. E-posta/kullanıcı adı veya şifre hatalı.'
}

export default function CanteenLogin() {
  const nav = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    document.title = 'PenPOS - Mağaza Girişi'
  }, [])

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const payload = { identifier, password, portal: 'canteen' }

    try {
      console.log('LOGIN REQUEST', payload)
      const loginRes = await api('/api/auth/login', {
        method: 'POST',
        data: payload,
        silent: true,
        suppressAuthRedirect: true,
        portalOverride: 'canteen',
      })
      console.log('LOGIN RESPONSE', loginRes?.data)
      if (loginRes?.ok === false || !loginRes?.token) {
        const err = new Error(loginRes?.message || 'Giriş başarısız')
        err.code = loginRes?.code || null
        err.response = { data: loginRes?.data }
        throw err
      }

      localStorage.setItem('token_canteen', loginRes.token)
      nav('/canteen', { replace: true })
    } catch (err) {
      console.error(err)
      setError(getFriendlyLoginError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicSystemLogin
      backTo="/login"
      backLabel="Sistem seçimine dön"
      brand="PenPOS"
      systemLabel="KANTİN / MARKET YÖNETİMİ"
      welcomeTitle="Hızlı kasa, stok ve cari akışlarınızı tek ekranda toplayın."
      welcomeText="Barkodlu satış, stok hareketleri, cari bakiyeler ve günlük raporlar ile operasyonu sade ve hızlı yönetin."
      formTitle="Mağaza Girişi"
      formSubtitle="Mağaza veya market panelinize giriş yapın."
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
