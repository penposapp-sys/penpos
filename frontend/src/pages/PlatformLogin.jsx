import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PublicSystemLogin from '../components/PublicSystemLogin.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getFriendlyLoginError } from '../lib/loginErrors.js'
import { toast } from '../lib/toast.js'
import { useBodyLayoutMode } from '../hooks/useBodyLayoutMode.js'

export default function PlatformLogin() {
  const { login, logout } = useAuth()
  const nav = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  useBodyLayoutMode('public-site-layout')

  useEffect(() => {
    document.title = 'PenPOS - Platform Yonetimi Girisi'
  }, [])

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await login({ identifier, password, portal: 'platform', rememberMe })
      const allowed = ['platform_admin', 'superadmin']
      if (!allowed.includes(res?.role)) {
        logout()
        const message = 'Bu giris yalnizca Platform Yonetimi icindir.'
        setError(message)
        toast.error(message)
        return
      }
      nav('/platform/kermes-tenants', { replace: true })
    } catch (err) {
      const message = getFriendlyLoginError(err, {
        accountDisabledMessage: 'Hesabiniz devre disi. Lutfen sistem yoneticinizle iletisime gecin.',
        wrongPortalMessage: 'Bu hesap platform yonetimi giris ekrani icin uygun degil.'
      })
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicSystemLogin
      backTo="/login"
      backLabel="Sistem secimine don"
      brand="PenPOS"
      systemLabel="PLATFORM YONETIMI"
      welcomeTitle="Tenant, paket ve ana site yonetimini tek merkezden kontrol edin."
      welcomeText="Bu alan yalnizca PenPOS platform yoneticileri icindir. Uyeler, paketler, talepler ve ana tanitim sitesi ayni panelden yonetilir."
      formTitle="Platform Girisi"
      formSubtitle="Platform admin veya superadmin bilgilerinizle giris yapin."
      identifierLabel="E-posta / Kullanici Adi"
      identifierPlaceholder="e-posta veya kullanici adi"
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
      forgotTo="/forgot-password?portal=platform"
      submitLabel="Giris Yap"
      loadingLabel="Giris yapiliyor..."
      showRegister={false}
      supportTitle="Platform kapsami"
      supportItems={[
        { label: 'Tenant Yonetimi', value: 'Restoran + Magaza' },
        { label: 'Ana Site', value: 'Builder kontrolu' },
      ]}
      theme="platform"
      highlights={['Tenant Kontrolu', 'Plan Yonetimi', 'Ana Site', 'Billing Talepleri']}
      panelQuote="Platform gorunumunde tum PenPOS agini tek panelden yonetmek icin daha net, daha kurumsal ve ayni marka diliyle uyumlu bir giris deneyimi."
      panelCaption="Platform paneli"
    />
  )
}
