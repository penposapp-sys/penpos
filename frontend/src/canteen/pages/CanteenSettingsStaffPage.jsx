import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/apiClient.js'
import Modal from '../../components/Modal.jsx'
import { getPermissionLabel } from '../utils/permissionLabels.js'
import CanteenSettingsSection, { CanteenSettingsCard } from '../components/CanteenSettingsSection.jsx'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'

const PERMS = [
  { key: 'canteen_pos_access', label: 'Kasa' },
  { key: 'canteen_customers_view', label: 'Carileri Görüntüle' },
  { key: 'canteen_customers_manage', label: 'Carileri Yönet' },
  { key: 'canteen_customers_create', label: 'Cari Oluştur' },
  { key: 'canteen_customers_edit', label: 'Cari Düzenle' },
  { key: 'canteen_customer_payment_delete', label: 'Cari Tahsilat Sil' },
  { key: 'canteen_reports_view', label: 'Raporlar' },
  { key: 'canteen_reports_export', label: 'Raporları Excel İndir' },
  { key: 'canteen_billing_view', label: 'Üyelik Talepleri' },
  { key: 'canteen_billing_manage', label: 'Üyelik Talebi Yönet' },
  { key: 'canteen_stock_manage', label: 'Stok Hareketleri' },
  { key: 'canteen_stock_count', label: 'Stok Sayım' },
  { key: 'canteen_stock_count_view', label: 'Sayım Geçmişi Gör' },
  { key: 'canteen_settings_manage', label: 'Ayarlar' },
]

function SelectionChip({ checked, label, onToggle }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        border: '1px solid var(--app-border, var(--border))',
        borderRadius: 999,
        background: checked ? 'var(--theme-accent-soft)' : 'var(--app-surface)',
        color: checked ? 'var(--theme-accent-text)' : 'var(--app-text)',
        cursor: 'pointer',
      }}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
    </label>
  )
}

export default function CanteenSettingsStaffPage() {
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const [items, setItems] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [permissions, setPermissions] = useState([])
  const [branchIds, setBranchIds] = useState([])
  const [error, setError] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const emailInputRef = useRef(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editPermissions, setEditPermissions] = useState([])
  const [editBranchIds, setEditBranchIds] = useState([])
  const [editIsActive, setEditIsActive] = useState(true)
  const editEmailInputRef = useRef(null)

  const permSet = useMemo(() => new Set(permissions), [permissions])
  const branchSet = useMemo(() => new Set(branchIds), [branchIds])
  const editPermSet = useMemo(() => new Set(editPermissions), [editPermissions])
  const editBranchSet = useMemo(() => new Set(editBranchIds), [editBranchIds])
  const isCompact = isMobilePortrait || isTablet

  const load = async (options = {}) => {
    const background = options?.background === true
    if (!background) setLoading(true)
    if (!background) setError('')
    try {
      const [staffRes, branchRes] = await Promise.all([
        api(`/api/canteen/staff${includeInactive ? '?includeInactive=true' : ''}`, { silent: true }),
        api('/api/canteen/branches', { silent: true }),
      ])
      setItems(Array.isArray(staffRes?.staff) ? staffRes.staff : [])
      setBranches(Array.isArray(branchRes?.branches) ? branchRes.branches : [])
    } finally {
      if (!background) setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [includeInactive])

  const stats = useMemo(() => {
    const activeCount = items.filter((item) => item.isActive !== false).length
    return [
      { label: 'Toplam personel', value: String(items.length) },
      { label: 'Aktif personel', value: String(activeCount) },
      { label: 'Şube erişimi', value: String(branches.length) },
    ]
  }, [items, branches])

  const togglePerm = (permission) => {
    setPermissions((current) => {
      const next = new Set(current)
      if (next.has(permission)) next.delete(permission)
      else next.add(permission)
      return Array.from(next)
    })
  }

  const toggleBranch = (id) => {
    const branchId = String(id)
    setBranchIds((current) => {
      const next = new Set(current.map(String))
      if (next.has(branchId)) next.delete(branchId)
      else next.add(branchId)
      return Array.from(next)
    })
  }

  const toggleEditPerm = (permission) => {
    setEditPermissions((current) => {
      const next = new Set(current)
      if (next.has(permission)) next.delete(permission)
      else next.add(permission)
      return Array.from(next)
    })
  }

  const toggleEditBranch = (id) => {
    const branchId = String(id)
    setEditBranchIds((current) => {
      const next = new Set(current.map(String))
      if (next.has(branchId)) next.delete(branchId)
      else next.add(branchId)
      return Array.from(next)
    })
  }

  const create = async (event) => {
    event.preventDefault()
    setError('')
    const res = await api('/api/canteen/staff', {
      method: 'POST',
      data: { name, username, email, password, permissions, branchIds },
      silent: true,
    })
    if (!res?.ok) {
      const code = res?.code
      if (code === 'duplicate_email') setError('Bu e-posta zaten kayıtlı.')
      else if (code === 'duplicate_username') setError('Bu kullanıcı adı zaten kayıtlı.')
      else setError(res?.message || 'Personel eklenemedi.')
      try { emailInputRef.current?.focus() } catch {}
      return
    }
    setName('')
    setUsername('')
    setEmail('')
    setPassword('')
    setPermissions([])
    setBranchIds([])
    await load()
  }

  const openEdit = (user) => {
    setEditing(user)
    setEditName(String(user?.name || ''))
    setEditUsername(String(user?.username || ''))
    setEditEmail(String(user?.email || ''))
    setEditPassword('')
    setEditPermissions(Array.isArray(user?.permissions) ? user.permissions : [])
    setEditBranchIds(Array.isArray(user?.branchIds) ? user.branchIds.map(String) : [])
    setEditIsActive(user?.isActive !== false)
    setEditError('')
    setEditOpen(true)
    setTimeout(() => {
      try { editEmailInputRef.current?.focus() } catch {}
    }, 50)
  }

  const saveEdit = async (event) => {
    event.preventDefault()
    if (!editing?.id) return
    setEditLoading(true)
    setEditError('')
    const body = {
      name: editName,
      username: editUsername,
      email: editEmail,
      permissions: editPermissions,
      branchIds: editBranchIds,
      isActive: !!editIsActive,
    }
    const nextPassword = String(editPassword || '').trim()
    if (nextPassword) body.password = nextPassword
    const res = await api(`/api/canteen/staff/${editing.id}`, { method: 'PUT', data: body, silent: true })
    setEditLoading(false)
    if (!res?.ok) {
      const code = res?.code
      if (code === 'duplicate_email') setEditError('Bu e-posta zaten kayıtlı.')
      else if (code === 'duplicate_username') setEditError('Bu kullanıcı adı zaten kayıtlı.')
      else setEditError(res?.message || 'Personel kaydedilemedi.')
      return
    }
    setEditOpen(false)
    setEditing(null)
    await load()
  }

  const quickToggleActive = async (user) => {
    if (!user?.id) return
    const nextActive = !(user?.isActive !== false)
    const res = await api(`/api/canteen/staff/${user.id}`, { method: 'PUT', data: { isActive: nextActive }, silent: true })
    if (!res?.ok) {
      setError(res?.message || 'Personel durumu güncellenemedi.')
      return
    }
    await load()
  }

  const remove = async (id) => {
    if (!window.confirm('Personeli devre dışı bırakmak istiyor musunuz?')) return
    setError('')
    const res = await api(`/api/canteen/staff/${id}`, { method: 'DELETE', silent: true })
    if (!res?.ok) {
      setError(res?.message || 'Personel silinemedi.')
      return
    }
    await load()
  }

  return (
    <CanteenSettingsSection
      badge="Personel Yönetimi"
      title="Yetki ve erişimleri modern kart yapısıyla yönetin"
      description="Personel oluşturma, erişim kapsamı belirleme ve aktiflik yönetimini daha düzenli bir arayüzden takip edin."
      stats={stats}
      actions={
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 999, border: '1px solid var(--app-border, var(--border))', background: 'var(--app-surface)' }}>
            <input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Pasifleri göster</span>
          </label>
          <button className="btn" type="button" onClick={load} disabled={loading}>{loading ? 'Yükleniyor...' : 'Yenile'}</button>
        </>
      }
    >
      {error ? <CanteenSettingsCard style={{ padding: 16, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</CanteenSettingsCard> : null}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'minmax(0, 1.05fr) minmax(0, 1fr)' }}>
        <CanteenSettingsCard style={{ padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Yeni Personel</div>
          <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, fontWeight: 700, lineHeight: 1.5, marginBottom: 14 }}>
            Kasa, cari, rapor ve stok yetkileriyle birlikte yeni personel hesabı oluşturun.
          </div>

          <form onSubmit={create} style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad soyad</div>
                <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kullanıcı adı</div>
                <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ornek: magaza1" />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta</div>
                <input ref={emailInputRef} className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şifre</div>
                <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Yetkiler</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {PERMS.map((item) => (
                  <SelectionChip key={item.key} checked={permSet.has(item.key)} label={item.label} onToggle={() => togglePerm(item.key)} />
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Erişebileceği şubeler</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {branches.map((branch) => (
                  <SelectionChip key={branch.id} checked={branchSet.has(String(branch.id))} label={branch.name} onToggle={() => toggleBranch(branch.id)} />
                ))}
                {branches.length === 0 ? <div style={{ color: 'var(--muted)' }}>Önce şube oluşturun.</div> : null}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn--primary" disabled={!name.trim() || !email.trim() || !password.trim()}>Personeli Oluştur</button>
            </div>
          </form>
        </CanteenSettingsCard>

        <CanteenSettingsCard style={{ padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Personel Listesi</div>
          <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, fontWeight: 700, lineHeight: 1.5, marginBottom: 14 }}>
            Mevcut personellerin yetkilerini, bağlı şubelerini ve aktiflik durumunu izleyin.
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {items.map((user) => (
              <div key={user.id} style={{ border: '1px solid var(--app-border, var(--border))', borderRadius: 20, padding: 16, background: user.isActive === false ? 'color-mix(in srgb, var(--app-surface) 76%, transparent)' : 'var(--theme-accent-soft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 900, overflowWrap: 'anywhere' }}>{user.name}</div>
                    <div style={{ marginTop: 4, color: 'var(--app-text-secondary)', fontSize: 13 }}>{user.username || '-'}</div>
                    <div style={{ color: 'var(--app-text-secondary)', fontSize: 13, overflowWrap: 'anywhere' }}>{user.email}</div>
                  </div>
                  <span style={{ borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 900, background: user.isActive === false ? 'rgba(148, 163, 184, 0.18)' : 'var(--app-surface)', color: user.isActive === false ? 'var(--app-text-secondary)' : 'var(--theme-accent-text)' }}>
                    {user.isActive === false ? 'Pasif' : 'Aktif'}
                  </span>
                </div>

                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(Array.isArray(user.permissions) ? user.permissions : []).map((permission) => (
                    <span key={permission} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 999, border: '1px solid var(--app-border, var(--border))', background: 'var(--app-surface)' }}>
                      {getPermissionLabel(permission)}
                    </span>
                  ))}
                </div>

                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--app-text-secondary)' }}>
                  Şube sayısı: {Array.isArray(user.branchIds) ? user.branchIds.length : 0}
                </div>

                <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button className="btn" type="button" onClick={() => openEdit(user)}>Düzenle</button>
                  <button className="btn" type="button" onClick={() => quickToggleActive(user)}>{user.isActive === false ? 'Aktifleştir' : 'Pasifleştir'}</button>
                  <button className="btn btn--danger" type="button" onClick={() => remove(user.id)}>Sil</button>
                </div>
              </div>
            ))}
            {items.length === 0 ? <div style={{ color: 'var(--muted)' }}>Henüz personel kaydı bulunmuyor.</div> : null}
          </div>
        </CanteenSettingsCard>
      </div>

      <Modal open={editOpen} onClose={() => { setEditOpen(false); setEditing(null) }} title="Personel Düzenle">
        <form onSubmit={saveEdit} style={{ display: 'grid', gap: 12 }}>
          {editError ? <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{editError}</div> : null}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" checked={!!editIsActive} onChange={(event) => setEditIsActive(event.target.checked)} />
            <span>Personel aktif</span>
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad soyad</div>
            <input className="input" value={editName} onChange={(event) => setEditName(event.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kullanıcı adı</div>
            <input className="input" value={editUsername} onChange={(event) => setEditUsername(event.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta</div>
            <input ref={editEmailInputRef} className="input" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni şifre</div>
            <input className="input" type="password" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {PERMS.map((item) => (
              <SelectionChip key={item.key} checked={editPermSet.has(item.key)} label={item.label} onToggle={() => toggleEditPerm(item.key)} />
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {branches.map((branch) => (
              <SelectionChip key={branch.id} checked={editBranchSet.has(String(branch.id))} label={branch.name} onToggle={() => toggleEditBranch(branch.id)} />
            ))}
          </div>

          <button className="btn btn--primary" disabled={editLoading}>{editLoading ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </form>
      </Modal>
    </CanteenSettingsSection>
  )
}
