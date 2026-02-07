import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import QRCode from 'qrcode'

export default function QrMenuSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tenant, setTenant] = useState(null)
  const [enabled, setEnabled] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')

  const link = useMemo(() => {
    const slug = String(tenant?.slug || '').trim()
    if (!slug) return ''
    return `${window.location.origin}/menu/${slug}`
  }, [tenant?.slug])

  useEffect(() => {
    if (link) {
      QRCode.toDataURL(link, { width: 300, margin: 2 }, (err, url) => {
        if (!err) setQrDataUrl(url)
      })
    } else {
      setQrDataUrl('')
    }
  }, [link])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api('/api/tenant/profile', { silent: true })
      if (res?.success === false) {
        setTenant(null)
        setEnabled(false)
        setError(res?.message || 'Bu işlem için yetkiniz yok')
        return
      }
      const t = res?.tenant || null
      setTenant(t)
      const v = t?.settings?.qrMenuEnabled
      setEnabled(Boolean(v))
    } catch (e) {
      setTenant(null)
      setEnabled(false)
      setError(e?.message || 'Yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const save = async (nextEnabled) => {
    setSaving(true)
    setError('')
    try {
      const res = await api('/api/tenant/settings', { method: 'PUT', body: JSON.stringify({ qrMenuEnabled: Boolean(nextEnabled) }), silent: true })
      if (res?.success === false) {
        setError(res?.message || 'Bu işlem için yetkiniz yok')
        return
      }
      setEnabled(Boolean(res?.tenant?.settings?.qrMenuEnabled))
      toast.success('Kaydedildi')
    } catch (e) {
      setError(e?.message || 'Kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const copyLink = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link kopyalandı')
    } catch {
      try {
        const el = document.createElement('textarea')
        el.value = link
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        toast.success('Link kopyalandı')
      } catch {
        toast.error('Kopyalama başarısız')
      }
    }
  }

  const downloadQr = () => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `qr-menu-${tenant?.slug}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>QR Menü</h3>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tek QR ile sadece menü görüntülenir.</div>
        </div>
        <button className="btn" onClick={load} disabled={loading || saving}>{loading ? 'Yükleniyor...' : 'Yenile'}</button>
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}

      <div className="card" style={{ borderColor: 'var(--border)', display: 'grid', gap: 10 }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 800 }}>QR Menü Aç/Kapat</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{enabled ? 'Açık' : 'Kapalı'}</div>
          </div>
          <input type="checkbox" checked={enabled} onChange={(e) => save(e.target.checked)} disabled={saving} />
        </label>

        <div style={{ display: 'grid', gap: 8 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>İşletme Kodu</div>
            <input className="input" value={String(tenant?.slug || '')} readOnly />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Public Link</div>
            <input className="input" value={link} readOnly />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={copyLink} disabled={!link}>Linki Kopyala</button>
          <button className="btn" onClick={downloadQr} disabled={!qrDataUrl}>QR İndir</button>
        </div>

        {qrDataUrl && (
          <div style={{ marginTop: 10 }}>
            <img src={qrDataUrl} alt="QR Code" style={{ width: 150, height: 150, border: '1px solid var(--border)', borderRadius: 8 }} />
          </div>
        )}
      </div>
    </div>
  )
}
