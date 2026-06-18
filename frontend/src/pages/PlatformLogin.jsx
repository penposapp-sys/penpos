import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PublicSystemLogin from '../components/PublicSystemLogin.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { toast } from '../lib/toast.js'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'

const getFriendlyLoginError = (error) => {
  const code = String(error?.code || error?.response?.data?.code || error?.response?.data?.error || '').trim()
  if (code === 'account_disabled') return 'Hesabınız devre dışı. Lütfen sistem yöneticinizle iletişime geçin.'
  if (code === 'wrong_portal') return 'Bu hesap platform yönetimi giriş ekranı için uygun değil.'
  return 'Giriş başarısız. E-posta/kullanıcı adı veya şifre hatalı.'
}

export default function PlatformLogin() {
  const { login, logout } = useAuth()
  const nav = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    document.title = 'PenPOS - Platform Yönetimi Girişi'
  }, [])

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await login({ identifier, password, portal: 'platform' })
      const allowed = ['platform_admin', 'superadmin']
      if (!allowed.includes(res?.role)) {
        logout()
        const message = 'Bu giriş yalnızca Platform Yönetimi içindir.'
        setError(message)
        toast.error(message)
        return
      }
      nav('/platform/kermes-tenants', { replace: true })
    } catch (err) {
      console.error(err)
      const message = getFriendlyLoginError(err)
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicSystemLogin
      backTo="/"
      backLabel="Ana sayfaya dön"
      brand="PenPOS"
      systemLabel="PLATFORM YÖNETİMİ"
      welcomeTitle="Tenant, paket ve ana site yönetimini tek merkezden kontrol edin."
      welcomeText="Bu alan yalnızca PenPOS platform yöneticileri içindir. Üyeler, paketler, talepler ve ana tanıtım sitesi aynı panelden yönetilir."
      formTitle="Platform Girişi"
      formSubtitle="Platform admin veya superadmin bilgilerinizle giriş yapın."
      identifierLabel="E-posta / Kullanıcı Adı"
      identifierPlaceholder="e-posta veya kullanıcı adı"
      passwordLabel="Şifre"
      passwordPlaceholder="şifrenizi girin"
      identifier={identifier}
      password={password}
      onIdentifierChange={setIdentifier}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      error={error}
      loading={loading}
      forgotTo="/forgot-password?portal=platform"
      submitLabel="Giriş Yap"
      loadingLabel="Giriş yapılıyor..."
      showRegister={false}
      supportTitle="Platform kapsamı"
      supportItems={[
        { label: 'Tenant Yönetimi', value: 'Restoran + Mağaza' },
        { label: 'Ana Site', value: 'Builder kontrolü' },
      ]}
      theme="platform"
      highlights={['Tenant Kontrolü', 'Plan Yönetimi', 'Ana Site', 'Billing Talepleri']}
      panelQuote="Platform görünümünde tüm PenPOS ağını tek panelden yönetmek için daha net, daha kurumsal ve aynı marka diliyle uyumlu bir giriş deneyimi."
      panelCaption="Platform paneli"
    />
  )
}
