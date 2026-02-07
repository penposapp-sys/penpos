import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'

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

  useEffect(() => { load() }, [])

  const update = async (patch) => {
    setLoading(true)
    setError('')
    setSuccess('')
    const res = await api('/api/canteen/settings', { method: 'PUT', data: patch, silent: true })
    if (!res?.ok) {
      setError(res?.message || 'Güncellenemedi')
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
    return branches.filter(b => b.isActive !== false)
  }, [branches])

  const allowedSet = useMemo(() => new Set((allowedBranchIds || []).map(String)), [allowedBranchIds])

  if (!settings) return <div className="card">Yükleniyor...</div>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Sistem Ayarları</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Kantin tenant bazlı ayarları.</div>
        </div>
        <button className="btn" type="button" onClick={load} disabled={loading} style={{ padding: '0 10px', height: 34 }}>{loading ? '...' : 'Yenile'}</button>
      </div>

      {!!error && <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}
      {!!success && <div className="card" style={{ borderColor: '#bbf7d0', background: '#ecfdf5', color: '#166534' }}>{success}</div>}
      {Array.isArray(allowedBranchIds) && allowedBranchIds.length === 0 && (
        <div className="card" style={{ borderColor: '#fde68a', background: '#fffbeb', color: '#92400e' }}>
          Henüz yetkili şube seçilmedi. Kaydetmelisin.
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Varsayılan KDV</div>
          <input
            className="input"
            value={String(settings.defaultVatRate ?? 0)}
            onChange={(e) => setSettings(s => ({ ...s, defaultVatRate: e.target.value }))}
            onBlur={() => update({ defaultVatRate: Number(settings.defaultVatRate || 0) })}
          />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fiş Üst Metin</div>
          <input
            className="input"
            value={String(settings.receiptHeader || '')}
            onChange={(e) => setSettings(s => ({ ...s, receiptHeader: e.target.value }))}
            onBlur={() => update({ receiptHeader: settings.receiptHeader })}
          />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fiş Alt Metin</div>
          <input
            className="input"
            value={String(settings.receiptFooter || '')}
            onChange={(e) => setSettings(s => ({ ...s, receiptFooter: e.target.value }))}
            onBlur={() => update({ receiptFooter: settings.receiptFooter })}
          />
        </label>
      </div>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Yetkili Şubeler</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Kantin için erişilebilecek şubeler. Birden fazla şube seçilebilir.</div>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {activeBranches.map(b => {
            const id = String(b.id)
            const checked = allowedSet.has(id)
            return (
              <label key={id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 12 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!isAdmin || loading}
                  onChange={() => {
                    setAllowedBranchIds(prev => {
                      const curr = Array.isArray(prev) ? prev.map(String) : []
                      const next = new Set(curr)
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      const out = Array.from(next)
                      return out
                    })
                  }}
                />
                <div style={{ display: 'grid', gap: 2, flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{b.name}</div>
                  {!!b.description && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{b.description}</div>}
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
              if (import.meta.env.DEV) {
                try { console.debug('[CANTEEN_SETTINGS_SAVE_CLICK]', { allowedBranchIds: nextAllowed }) } catch {}
              }

              const saved = await update({ allowedBranchIds: nextAllowed })
              if (!saved?.ok) {
                if (import.meta.env.DEV) {
                  try { console.debug('[CANTEEN_SETTINGS_SAVE_ERR]', { status: saved?.status, code: saved?.code, message: saved?.message, data: saved?.data }) } catch {}
                }
                return
              }

              if (import.meta.env.DEV) {
                try { console.debug('[CANTEEN_SETTINGS_SAVE_OK]', saved) } catch {}
              }
              setSuccess('Kaydedildi')
            }}
            style={{ padding: '0 12px', height: 36 }}
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}
