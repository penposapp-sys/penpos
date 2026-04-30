import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import { useTheme } from '../../theme/ThemeContext.jsx'
import { themeKeys, themes } from '../../theme/themeConfig.js'

function ThemeSelector() {
  const { themeKey, setThemeKey } = useTheme()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      {themeKeys.map((key) => {
        const item = themes[key]
        const selected = themeKey === key

        return (
          <button
            key={key}
            type="button"
            onClick={() => setThemeKey(key)}
            style={{
              borderRadius: 24,
              border: `1px solid ${selected ? '#0f172a' : '#e2e8f0'}`,
              background: selected ? '#0f172a' : '#f8fafc',
              color: selected ? '#ffffff' : '#334155',
              padding: 16,
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'transform 180ms ease, box-shadow 180ms ease',
              boxShadow: selected ? '0 18px 36px rgba(15, 23, 42, 0.18)' : '0 10px 22px rgba(15, 23, 42, 0.05)'
            }}
          >
            <div style={{ height: 48, borderRadius: 18, background: item.gradient }} />
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontWeight: 900 }}>{item.name}</div>
              {selected && (
                <span style={{ borderRadius: 999, background: '#ffffff', color: '#0f172a', padding: '4px 8px', fontSize: 11, fontWeight: 900 }}>
                  Secili
                </span>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: selected ? 'rgba(255,255,255,0.72)' : '#94a3b8', lineHeight: 1.5 }}>
              Yan bar, ust bar, aktif menu kapsulu ve ana cizgiler secilen temaya gore guncellenir.
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default function CanteenSettingsSystemPage() {
  const { me } = useOutletContext()
  const isAdmin = me?.role === 'tenant_admin'
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState(null)
  const [branches, setBranches] = useState([])
  const [allowedBranchIds, setAllowedBranchIds] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    const [s, b] = await Promise.all([
      api('/api/canteen/settings', { silent: true }),
      api('/api/canteen/branches', { silent: true })
    ])
    setSettings(s?.settings || null)
    setBranches(Array.isArray(b?.branches) ? b.branches : [])
    setAllowedBranchIds(Array.isArray(s?.settings?.allowedBranchIds) ? s.settings.allowedBranchIds.map(String).filter(Boolean) : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const update = async (patch) => {
    setLoading(true)
    setError('')
    setSuccess('')
    const res = await api('/api/canteen/settings', { method: 'PUT', data: patch, silent: true })
    if (!res?.ok) {
      setError(res?.message || 'Guncellenemedi')
      setLoading(false)
      return res
    }
    setSettings(res.settings || null)
    if (Array.isArray(res?.settings?.allowedBranchIds)) {
      setAllowedBranchIds(res.settings.allowedBranchIds.map(String).filter(Boolean))
    }
    setLoading(false)
    return res
  }

  const activeBranches = useMemo(() => {
    return branches.filter((branch) => branch.isActive !== false)
  }, [branches])

  const allowedSet = useMemo(() => new Set((allowedBranchIds || []).map(String)), [allowedBranchIds])

  if (!settings) return <div className="card">Yukleniyor...</div>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Sistem Ayarlari</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Kantin tenant bazli ayarlar burada yonetilir.</div>
        </div>
        <button className="btn" type="button" onClick={load} disabled={loading} style={{ padding: '0 10px', height: 34 }}>
          {loading ? '...' : 'Yenile'}
        </button>
      </div>

      {!!error && <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}
      {!!success && <div className="card" style={{ borderColor: '#bbf7d0', background: '#ecfdf5', color: '#166534' }}>{success}</div>}
      {Array.isArray(allowedBranchIds) && allowedBranchIds.length === 0 && (
        <div className="card" style={{ borderColor: '#fde68a', background: '#fffbeb', color: '#92400e' }}>
          Henuz yetkili sube secilmedi. Kaydetmelisin.
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Varsayilan KDV</div>
          <input
            className="input"
            value={String(settings.defaultVatRate ?? 0)}
            onChange={(event) => setSettings((current) => ({ ...current, defaultVatRate: event.target.value }))}
            onBlur={() => update({ defaultVatRate: Number(settings.defaultVatRate || 0) })}
          />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fis Ust Metin</div>
          <input
            className="input"
            value={String(settings.receiptHeader || '')}
            onChange={(event) => setSettings((current) => ({ ...current, receiptHeader: event.target.value }))}
            onBlur={() => update({ receiptHeader: settings.receiptHeader })}
          />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fis Alt Metin</div>
          <input
            className="input"
            value={String(settings.receiptFooter || '')}
            onChange={(event) => setSettings((current) => ({ ...current, receiptFooter: event.target.value }))}
            onBlur={() => update({ receiptFooter: settings.receiptFooter })}
          />
        </label>
      </div>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Yetkili Subeler</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Kantin icin erisilebilecek subeler. Birden fazla sube secilebilir.</div>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {activeBranches.map((branch) => {
            const id = String(branch.id)
            const checked = allowedSet.has(id)
            return (
              <label key={id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 12 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!isAdmin || loading}
                  onChange={() => {
                    setAllowedBranchIds((current) => {
                      const next = new Set(Array.isArray(current) ? current.map(String) : [])
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      return Array.from(next)
                    })
                  }}
                />
                <div style={{ display: 'grid', gap: 2, flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{branch.name}</div>
                  {!!branch.description && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{branch.description}</div>}
                </div>
              </label>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            className="btn"
            type="button"
            disabled={!isAdmin || loading || !Array.isArray(allowedBranchIds) || allowedBranchIds.length === 0}
            onClick={async () => {
              const nextAllowed = Array.isArray(allowedBranchIds) ? allowedBranchIds.map(String).filter(Boolean) : []
              if (nextAllowed.length === 0) return

              const saved = await update({ allowedBranchIds: nextAllowed })
              if (!saved?.ok) return
              setSuccess('Kaydedildi')
            }}
            style={{ padding: '0 12px', height: 36 }}
          >
            Kaydet
          </button>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Tema Secenekleri</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Kantin arayuzunde restoran tarafinda kullandigimiz yan bar, ust bar ve vurgu yapisini buradan degistirebilirsin.</div>
        </div>
        <ThemeSelector />
      </div>
    </div>
  )
}
