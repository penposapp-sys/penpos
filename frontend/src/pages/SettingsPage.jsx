import React, { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import Modal from '../components/Modal.jsx'
import BulkProductsExcelCard from '../components/BulkProductsExcelCard.jsx'
import { PERMISSIONS } from '../constants/permissions.js'
import SettingsBranchCards from '../components/SettingsBranchCards.jsx'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'

export default function SettingsPage() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const nav = useNavigate()
  const { isMobilePortrait } = useResponsiveFlags()
  const isActive = (p) => pathname.startsWith(p)
  const perms = Array.isArray(user?.permissions) ? user.permissions : []
  const canManageSettings = user?.role === 'tenant_admin' || user?.role === 'superadmin' || perms.includes(PERMISSIONS.MANAGE_SETTINGS)
  const canManageMenu = user?.role === 'tenant_admin' || user?.role === 'superadmin' || perms.includes(PERMISSIONS.MANAGE_MENU)
  const canSee = !!(canManageSettings || canManageMenu)

  const basePath = '/kermes/settings'
  const isRoot = pathname === basePath || pathname === basePath + '/'

  const menu = useMemo(() => {
    const items = [{ to: '/kermes/settings/me', label: 'Hesabım' }]
    if (canManageSettings) {
      items.push(
        { to: '/kermes/settings/system', label: 'Sistem Ayarları' },
        { to: '/kermes/settings/branches', label: 'Şube Ayarları' },
        { to: '/kermes/settings/staff', label: 'Personel Ayarları' },
        { to: '/kermes/settings/tables', label: 'Masa Ayarları' },
        { to: '/kermes/settings/printers', label: 'Yazıcı Ayarları' },
        { to: '/kermes/settings/payments', label: 'Ödeme Seçenekleri' },
        { to: '/kermes/settings/delivery', label: 'Paket Servis' }
      )
      if (user?.role === 'tenant_admin') items.push({ to: '/kermes/settings/billing', label: 'Paket & Satın Alma' })
    }
    if (canManageMenu) {
      items.push(
        { to: '/kermes/settings/catalog', label: 'Ürün & Kategori' },
        { to: '/kermes/settings/qr', label: 'QR Menü' }
      )
    }
    return items
  }, [canManageMenu, canManageSettings, user?.role])

  const current = useMemo(() => {
    return menu
      .filter(i => pathname === i.to || pathname.startsWith(i.to + '/'))
      .sort((a, b) => b.to.length - a.to.length)[0]
  }, [menu, pathname])

  if (isMobilePortrait) {
    if (isRoot) {
      return (
        <div className="main pageMobile settings-scope">
          <div style={{ fontWeight: 900, fontSize: 18 }}>Ayarlar</div>
          {!canSee ? (
            <div className="card">Bu sayfaya yetkin yok</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {menu.map((i) => (
                <Link
                  key={i.to}
                  to={i.to}
                  className="card"
                  style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
                >
                  <div style={{ fontWeight: 800 }}>{i.label}</div>
                  <div style={{ color: 'var(--muted)', fontWeight: 900 }}>›</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="main pageMobile settings-scope">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <button className="btn" type="button" onClick={() => nav('/kermes/settings')}>← Ayarlara Dön</button>
          <div style={{ fontWeight: 900 }}>{current?.label || 'Ayarlar'}</div>
        </div>
        <Outlet />
      </div>
    )
  }

  return (
    <div className="settingsLayout" style={{ gridTemplateColumns: '220px 1fr' }}>
      <div className="card" style={{ padding: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Ayarlar</div>
        {canSee && (
          <div style={{ display: 'grid', gap: 6 }}>
            {menu.map((i) => (
              <Link key={i.to} to={i.to} className="btn btn--left btn--full" data-active={isActive(i.to) ? 'true' : 'false'}>{i.label}</Link>
            ))}
          </div>
        )}
      </div>
      <div className="card settings-scope">
        {isRoot ? <div style={{ color: 'var(--muted)' }}>Bir ayar seçiniz</div> : <Outlet />}
      </div>
    </div>
  )
}

export const SettingsSystemContent = () => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [logoLoading, setLogoLoading] = useState(false)
  const [branches, setBranches] = useState([])
  const [allowedBranchIds, setAllowedBranchIdsLocal] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { refresh, setAllowedBranchIds } = useAuth()

  const apiOrigin = React.useMemo(() => {
    const fallback = '/api'
    try {
      const u = new URL(import.meta.env.VITE_API_URL || fallback)
      u.port = '4000'
      return u.origin
    } catch {
      return fallback
    }
  }, [])

  const logoPreviewSrc = React.useMemo(() => {
    const raw = String(logoUrl || '').trim()
    if (!raw) return ''
    if (/^https?:\/\//i.test(raw)) return raw
    return `${apiOrigin}${raw.startsWith('/') ? '' : '/'}${raw}`
  }, [logoUrl, apiOrigin])

  const load = async () => {
    setError('')
    const profileRes = await api('/api/tenant/profile', { silent: true, skipBranchHeader: true })
    if (profileRes?.success === false) {
      setName('')
      setDescription('')
      setAllowedBranchIds([])
      setBranches([])
      setError(profileRes.message || 'Bu işlem için yetkiniz yok')
      return
    }
    const t = profileRes?.tenant || null
    setName(t?.name || '')
    setDescription(t?.description || '')
    setLogoUrl(t?.logoUrl || '')
    setAllowedBranchIdsLocal(Array.isArray(t?.allowedBranchIds) ? t.allowedBranchIds : [])

    const branchesRes = await api('/api/branches', { silent: true, skipBranchHeader: true })
    if (branchesRes?.success === false) {
      setBranches([])
      return
    }
    setBranches(Array.isArray(branchesRes?.branches) ? branchesRes.branches : [])
  }
  useEffect(() => { load() }, [])

  const toggleAllowedBranch = (branchId, checked) => {
    const set = new Set(Array.isArray(allowedBranchIds) ? allowedBranchIds : [])
    if (checked) set.add(String(branchId))
    else set.delete(String(branchId))
    setAllowedBranchIdsLocal(Array.from(set))
  }

  const onSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await api('/api/tenant/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, description, allowedBranchIds }),
        silent: true,
        skipBranchHeader: true
      })
      if (res?.success === false) {
        setError(res.message || 'Bu işlem için yetkiniz yok')
        return
      }
      try {
        setAllowedBranchIds(Array.isArray(res?.tenant?.allowedBranchIds) ? res.tenant.allowedBranchIds.map(String) : [])
        window.dispatchEvent(new CustomEvent('allowed_branches_changed', { detail: { allowedBranchIds: Array.isArray(res?.tenant?.allowedBranchIds) ? res.tenant.allowedBranchIds : [] } }))
      } catch {}
      setSuccess('Kaydedildi')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const uploadLogo = async () => {
    if (!logoFile) return
    setLogoLoading(true)
    setError('')
    setSuccess('')
    try {
      const fd = new FormData()
      fd.append('file', logoFile)
      const res = await api('/api/settings/logo', { method: 'POST', body: fd, silent: true, skipBranchHeader: true })
      if (res?.success === false) {
        setError(res.message || 'Logo yüklenemedi')
        return
      }
      setLogoUrl(res?.logoUrl || '')
      setLogoFile(null)
      setSuccess('Logo yüklendi')
    } catch (err) {
      setError(err.message || 'Logo yüklenemedi')
    } finally {
      setLogoLoading(false)
    }
  }

  const removeLogo = async () => {
    setLogoLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await api('/api/settings/logo', { method: 'DELETE', silent: true, skipBranchHeader: true })
      if (res?.success === false) {
        setError(res.message || 'Logo kaldırılamadı')
        return
      }
      setLogoUrl('')
      setLogoFile(null)
      setSuccess('Logo kaldırıldı')
    } catch (err) {
      setError(err.message || 'Logo kaldırılamadı')
    } finally {
      setLogoLoading(false)
    }
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Sistem Ayarları</h3>
      <form onSubmit={onSave} style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
        <div className="card" style={{ borderColor: 'var(--border)' }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Genel</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>İşletme Adı</div>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Açıklama</div>
              <textarea className="input" rows="4" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="card" style={{ borderColor: 'var(--border)' }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Restoran Logosu</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 64, height: 64, borderRadius: 12, border: '1px solid var(--border)', background: '#ffffff', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
              {logoPreviewSrc ? (
                <img src={logoPreviewSrc} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Logo yok</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 8 }}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              />
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>PNG/JPG/WebP, max 2MB</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" className="btn" disabled={!logoFile || logoLoading} onClick={uploadLogo}>
                {logoLoading ? 'Yükleniyor...' : 'Logo Yükle'}
              </button>
              <button type="button" className="btn" disabled={!logoUrl || logoLoading} onClick={removeLogo}>
                Kaldır
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ borderColor: 'var(--border)' }}>
          <div style={{ fontWeight: 800 }}>Yetkili Şubeler</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            POS/Walk-in/Delivery için şube seçimi altyapısı. Birden fazla şube seçilebilir.
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {(branches || []).length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Şube bulunamadı</div>
            ) : (
              (branches || []).map((b) => (
                <label key={b._id || b.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allowedBranchIds.includes(String(b._id || b.id))}
                    onChange={(e) => toggleAllowedBranch((b._id || b.id), e.target.checked)}
                  />
                  <div style={{ display: 'grid' }}>
                    <div style={{ fontWeight: 700 }}>{b.name}</div>
                    {!!(b.description || '') && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{b.description}</div>}
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
        {success && <div style={{ color: '#22c55e', fontSize: 13 }}>{success}</div>}
        <button className="btn" disabled={loading}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</button>
      </form>
    </div>
  )
}

export const SettingsMenuHub = () => {
  const { user } = useAuth()
  const canBulk = user?.role === 'tenant_admin' || (Array.isArray(user?.permissions) && user.permissions.includes(PERMISSIONS.MANAGE_MENU))
  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Ürün ve Kategori Ayarları</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>Kategoriler</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kategori ekleme/düzenleme/pasifleştirme</div>
          </div>
          <Link className="btn" to="/kermes/settings/menu/categories">Kategorileri Yönet</Link>
        </div>
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>Ürünler</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ürün ekleme/düzenleme/pasifleştirme</div>
          </div>
          <Link className="btn" to="/kermes/settings/menu/items">Ürünleri Yönet</Link>
        </div>
        {canBulk && <BulkProductsExcelCard />}
      </div>
    </div>
  )
}

export const SettingsTablesContent = () => {
  const nav = useNavigate()
  const { search } = useLocation()
  const [tablesByBranchId, setTablesByBranchId] = useState({})
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [createForm, setCreateForm] = useState({ baseName: 'Masa', count: 1 })
  const [editForm, setEditForm] = useState({ name: '' })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const { user, tenantCtx } = useAuth()
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const isExpired = tenantCtx?.tenant?.plan?.status === 'expired'
  const [createErrors, setCreateErrors] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState('')

  const branchNameById = React.useMemo(() => {
    const m = new Map()
    for (const b of (Array.isArray(branches) ? branches : [])) {
      const id = String(b?.id || b?._id || '').trim()
      if (id) m.set(id, b?.name || '')
    }
    return m
  }, [branches])

  const parseBranchIdFromSearch = () => {
    try {
      const params = new URLSearchParams(String(search || ''))
      const v = params.get('branchId')
      return v ? String(v) : ''
    } catch {
      return ''
    }
  }

  const syncUrl = (next) => {
    try {
      const params = new URLSearchParams(String(search || ''))
      if (!next) params.delete('branchId')
      else params.set('branchId', String(next))
      const qs = params.toString()
      nav({ pathname: '/kermes/settings/tables', search: qs ? `?${qs}` : '' }, { replace: true })
    } catch {}
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const branchesRes = await api('/api/tenant/branches', { silent: true, skipBranchHeader: true })
      const list = Array.isArray(branchesRes?.branches) ? branchesRes.branches : []
      setBranches(list)

      const localBranchNameById = new Map()
      for (const b of list) {
        const id = String(b?.id || b?._id || '').trim()
        if (id) localBranchNameById.set(id, b?.name || '')
      }

      const byBranch = {}
      const results = await Promise.allSettled(
        list.map(async (b) => {
          const id = String(b?.id || b?._id || '').trim()
          if (!id) return
          const res = await api('/api/tenant/tables', { silent: true, skipBranchHeader: true, headers: { 'x-branch-id': id } })
          byBranch[id] = Array.isArray(res?.tables) ? res.tables : []
        })
      )
      const failed = results.some(r => r.status === 'rejected')
      setTablesByBranchId(byBranch)

      const fromUrl = parseBranchIdFromSearch()
      const validIds = list.map(b => String(b?.id || b?._id || '').trim()).filter(Boolean)
      const nextSelected = fromUrl && (fromUrl === 'all' || validIds.includes(fromUrl))
        ? fromUrl
        : (validIds[0] || '')

      setSelectedBranchId(nextSelected)
      if (nextSelected && nextSelected !== fromUrl) syncUrl(nextSelected)

      if (!nextSelected) {
        setItems([])
      } else if (nextSelected === 'all') {
        const merged = Object.values(byBranch).flat().sort((a, b) => {
          const aBid = String(a?.branchId || '')
          const bBid = String(b?.branchId || '')
          const aBn = localBranchNameById.get(aBid) || ''
          const bBn = localBranchNameById.get(bBid) || ''
          const byBranch = aBn.localeCompare(bBn, 'tr')
          if (byBranch !== 0) return byBranch
          return String(a?.name || '').localeCompare(String(b?.name || ''), 'tr')
        })
        setItems(merged)
      } else {
        setItems(Array.isArray(byBranch[nextSelected]) ? byBranch[nextSelected] : [])
      }

      if (failed) {
        setError('Bazı şubelerin masaları alınamadı. Tekrar deneyin.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    const fromUrl = parseBranchIdFromSearch()
    if (!fromUrl) return
    if (fromUrl === selectedBranchId) return
    const ids = (branches || []).map(b => String(b?.id || b?._id || '').trim()).filter(Boolean)
    if (fromUrl === 'all' || ids.includes(fromUrl)) {
      setSelectedBranchId(fromUrl)
      if (fromUrl === 'all') {
        const merged = Object.values(tablesByBranchId || {}).flat().sort((a, b) => {
          const aBid = String(a?.branchId || '')
          const bBid = String(b?.branchId || '')
          const aBn = branchNameById.get(aBid) || ''
          const bBn = branchNameById.get(bBid) || ''
          const byBranch = aBn.localeCompare(bBn, 'tr')
          if (byBranch !== 0) return byBranch
          return String(a?.name || '').localeCompare(String(b?.name || ''), 'tr')
        })
        setItems(merged)
      } else {
        setItems(Array.isArray(tablesByBranchId?.[fromUrl]) ? tablesByBranchId[fromUrl] : [])
      }
    }
  }, [search, branches, tablesByBranchId, selectedBranchId])

  const onSelectBranch = (id) => {
    const next = String(id || '').trim()
    setSelectedBranchId(next)
    syncUrl(next)
    if (!next) {
      setItems([])
      return
    }
    if (next === 'all') {
      const merged = Object.values(tablesByBranchId || {}).flat().sort((a, b) => {
        const aBid = String(a?.branchId || '')
        const bBid = String(b?.branchId || '')
        const aBn = branchNameById.get(aBid) || ''
        const bBn = branchNameById.get(bBid) || ''
        const byBranch = aBn.localeCompare(bBn, 'tr')
        if (byBranch !== 0) return byBranch
        return String(a?.name || '').localeCompare(String(b?.name || ''), 'tr')
      })
      setItems(merged)
      return
    }
    setItems(Array.isArray(tablesByBranchId?.[next]) ? tablesByBranchId[next] : [])
  }

  const openCreate = () => {
    setCreateForm({ baseName: 'Masa', count: 1 })
    setFormError('')
    const next = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : ''
    setBranchId(next)
    setCreateErrors([])
    setCreateOpen(true)
  }
  const onCreate = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const base = String(createForm.baseName || '').trim()
      const cnt = Math.max(1, Number(createForm.count) || 1)
      if (!branchId) {
        setFormError('Şube seçiniz')
        setFormLoading(false)
        return
      }
      const names = Array(cnt).fill(0).map((_, i) => `${base} ${i + 1}`)
      const created = []
      const errors = []
      for (let i = 0; i < names.length; i++) {
        try {
          const body = user?.role === 'tenant_admin' ? { name: names[i], branchId } : { name: names[i] }
          const { table } = await api('/api/tenant/tables', { method: 'POST', body: JSON.stringify(body) })
          created.push(table)
        } catch (err) {
          errors.push({ name: names[i], message: err.message })
        }
      }
      if (created.length > 0) {
        await load()
        try {
          await api('/api/tenant/audit', { method: 'POST', body: JSON.stringify({ action: 'masa_toplu_eklendi', entityType: 'Table', entityId: created[0]?.id || '', meta: { count: created.length, baseName: base } }) })
        } catch {}
      }
      setCreateErrors(errors)
      if (errors.length === 0) {
        setCreateOpen(false)
      }
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openEdit = (t) => {
    setSelected(t)
    setEditForm({ name: t.name })
    setFormError('')
    setEditOpen(true)
  }
  const onEdit = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const { table } = await api(`/api/tenant/tables/${selected.id}`, { method: 'PUT', body: JSON.stringify(editForm) })
      await load()
      setEditOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const onDisable = async (t) => {
    try {
      await api(`/api/tenant/tables/${t.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Masa Ayarları</h3>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
            Bu ekran yalnızca masa tanımı yönetimi içindir (ekle/düzenle/sil). Sipariş ekranı değildir.
          </div>
        </div>
        <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
          <button className="btn" onClick={openCreate} disabled={isExpired} title={isExpired ? 'Paket süreniz doldu. Plan yükseltin.' : undefined}>Masa Ekle</button>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni masa tanımı oluştur</div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <SettingsBranchCards
          branches={branches}
          tablesByBranchId={tablesByBranchId}
          selectedBranchId={selectedBranchId}
          onSelectBranchId={onSelectBranch}
          showAll
        />
      </div>

      {!selectedBranchId && (
        <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: '#b91c1c' }}>Şube seçilmedi. Lütfen yukarıdan şube seçin.</div>
        </div>
      )}
      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
      {loading ? 'Yükleniyor...' : (
        items.length === 0 ? (
          <div style={{ color: 'var(--muted)' }}>{selectedBranchId === 'all' ? 'Henüz masa tanımı yok.' : 'Bu şube için masa bulunamadı.'}</div>
        ) : (
          <>
            <div className="desktop-only">
              <table className="table">
                <thead>
                  <tr><th>Ad</th><th>Şube</th><th>Durum</th><th className="actions" style={{ width: 240 }}>Aksiyonlar</th></tr>
                </thead>
                <tbody>
                  {items.map(t => {
                    const branchLabel = branchNameById.get(String(t.branchId || '')) || '-'
                    const statusLabel = t.isActive === false ? 'Pasif' : 'Aktif'
                    const disableDisabled = t.status === 'occupied'
                    const disableTitle = disableDisabled ? 'Kullanımda masa silinemez' : undefined
                    return (
                      <tr key={t.id}>
                        <td>{t.name}</td>
                        <td>{branchLabel}</td>
                        <td>{statusLabel}</td>
                        <td className="actions">
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn" onClick={() => openEdit(t)}>Düzenle</button>
                            <button className="btn" onClick={() => onDisable(t)} disabled={disableDisabled} title={disableTitle}>Sil</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-only settings-mobile">
              {(items || []).map(t => {
                const branchLabel = branchNameById.get(String(t.branchId || '')) || '-'
                const statusLabel = t.isActive === false ? 'Pasif' : 'Aktif'
                const disableDisabled = t.status === 'occupied'
                const disableTitle = disableDisabled ? 'Kullanımda masa silinemez' : undefined
                return (
                  <div key={t.id} className="mobile-list-item">
                    <div className="mobile-item-title breakAny">{t.name}</div>
                    <div className="mobile-item-meta">
                      <span className="breakAny">Şube: {branchLabel}</span>
                      <span>Durum: {statusLabel}</span>
                    </div>
                    <div className="mobile-actions-row">
                      <button className="btn" type="button" onClick={() => openEdit(t)}>Düzenle</button>
                      <button className="btn" type="button" onClick={() => onDisable(t)} disabled={disableDisabled} title={disableTitle}>Sil</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Masa Ekle">
        <form onSubmit={onCreate} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Başlangıç Masa Adı</div>
            <input className="input" value={createForm.baseName} onChange={(e) => setCreateForm({ ...createForm, baseName: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Masa Adedi</div>
            <input className="input" type="number" min="1" value={createForm.count} onChange={(e) => setCreateForm({ ...createForm, count: Number(e.target.value) })} />
          </label>
          {(selectedBranchId && selectedBranchId !== 'all') ? (
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şube</div>
              <input className="input" value={branchNameById.get(String(selectedBranchId)) || ''} disabled />
            </label>
          ) : (
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şube</div>
              <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Şube seçiniz</option>
                {(branches || []).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          )}
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          {createErrors.length > 0 && (
            <div style={{ fontSize: 13 }}>
              {createErrors.map((er, idx) => (
                <div key={idx} style={{ color: '#ef4444' }}>{er.name}: {er.message}</div>
              ))}
            </div>
          )}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Kaydediliyor...' : 'Oluştur'}</button>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Masa Düzenle">
        <form onSubmit={onEdit} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </label>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Kaydet'}</button>
        </form>
      </Modal>
    </div>
  )
}

export const SettingsPaymentsContent = () => {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [newMethod, setNewMethod] = useState({ label: '', bucket: 'other' })
  const makeKey = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const load = async () => {
    setError('')
    try {
      const result = await api('/api/tenant/payment-settings', { silent: true })
      setData(result && Array.isArray(result.methods) ? result : { methods: [] })
    } catch (err) {
      setError(err.message)
      setData({ methods: [] })
    }
  }
  useEffect(() => { load() }, [])
  const toggle = (key) => {
    setData(prev => {
      const methods = (prev?.methods || []).map(m => m.key === key ? { ...m, isEnabled: !m.isEnabled } : m)
      return { ...(prev || {}), methods }
    })
  }
  const setDefault = (key) => {
    setData(prev => {
      const methods = (prev?.methods || []).map(m => ({ ...m, isDefault: m.key === key }))
      return { ...(prev || {}), methods }
    })
  }
  const updateLabel = (key, label) => {
    setData(prev => {
      const methods = (prev?.methods || []).map(m => m.key === key ? { ...m, label } : m)
      return { ...(prev || {}), methods }
    })
  }
  const updateBucket = (key, bucket) => {
    setData(prev => {
      const methods = (prev?.methods || []).map(m => m.key === key ? { ...m, bucket } : m)
      return { ...(prev || {}), methods }
    })
  }
  const removeMethod = (key) => {
    setData(prev => {
      const current = Array.isArray(prev?.methods) ? prev.methods : []
      const filtered = current.filter(m => m.key !== key)
      const hasDefault = filtered.some(m => m.isDefault)
      const methods = hasDefault ? filtered : filtered.map((m, index) => ({ ...m, isDefault: index === 0 }))
      return { ...(prev || {}), methods }
    })
  }
  const addMethod = () => {
    const label = String(newMethod.label || '').trim()
    const key = makeKey(label)
    if (!label || !key) {
      setError('Yeni odeme secenegi icin isim girin')
      return
    }
    if ((data?.methods || []).some(m => m.key === key)) {
      setError('Ayni isimde bir odeme secenegi zaten var')
      return
    }
    setError('')
    setData(prev => ({
      ...(prev || {}),
      methods: [
        ...(prev?.methods || []),
        { key, label, bucket: newMethod.bucket || 'other', isEnabled: true, isDefault: !(prev?.methods || []).some(m => m.isDefault) }
      ]
    }))
    setNewMethod({ label: '', bucket: 'other' })
  }
  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api('/api/tenant/payment-settings', { method: 'PUT', body: JSON.stringify({ methods: data?.methods || [] }), silent: true })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
  if (!data || !Array.isArray(data.methods)) {
    return <div>Yükleniyor...</div>
  }
  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Ödeme Seçenekleri Ayarları</h3>
      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        {(data.methods || []).map(m => (
          <div key={m.key} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="checkbox" checked={!!m.isEnabled} onChange={() => toggle(m.key)} />
              <div>{m.label}</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="radio" name="default" checked={!!m.isDefault} onChange={() => setDefault(m.key)} />
              Varsayılan
            </label>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn" onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
      </div>
    </div>
  )
}
