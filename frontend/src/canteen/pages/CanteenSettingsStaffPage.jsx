import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/apiClient.js'
import Modal from '../../components/Modal.jsx'
import { getPermissionLabel } from '../utils/permissionLabels.js'

const PERMS = [
  { key: 'canteen_pos_access', label: 'Kasa' },
  { key: 'canteen_customers_view', label: 'Cariler Görüntüle' },
  { key: 'canteen_customers_manage', label: 'Cariler Yönet' },
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
  { key: 'canteen_settings_manage', label: 'Ayarlar' }
]

export default function CanteenSettingsStaffPage() {
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
  const emailInputRef = useRef(null)
  const [includeInactive, setIncludeInactive] = useState(false)

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

  const load = async () => {
    setLoading(true)
    setError('')
    const res = await api(`/api/canteen/staff${includeInactive ? '?includeInactive=true' : ''}`, { silent: true })
    const br = await api('/api/canteen/branches', { silent: true })
    setItems(Array.isArray(res?.staff) ? res.staff : [])
    setBranches(Array.isArray(br?.branches) ? br.branches : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [includeInactive])

  const togglePerm = (p) => {
    setPermissions(prev => {
      const set = new Set(prev)
      if (set.has(p)) set.delete(p)
      else set.add(p)
      return Array.from(set)
    })
  }

  const toggleBranch = (id) => {
    const bid = String(id)
    setBranchIds(prev => {
      const set = new Set(prev.map(String))
      if (set.has(bid)) set.delete(bid)
      else set.add(bid)
      return Array.from(set)
    })
  }

  const toggleEditPerm = (p) => {
    setEditPermissions(prev => {
      const set = new Set(prev)
      if (set.has(p)) set.delete(p)
      else set.add(p)
      return Array.from(set)
    })
  }

  const toggleEditBranch = (id) => {
    const bid = String(id)
    setEditBranchIds(prev => {
      const set = new Set(prev.map(String))
      if (set.has(bid)) set.delete(bid)
      else set.add(bid)
      return Array.from(set)
    })
  }

  const openEdit = (u) => {
    setEditing(u)
    setEditName(String(u?.name || ''))
    setEditUsername(String(u?.username || ''))
    setEditEmail(String(u?.email || ''))
    setEditPassword('')
    setEditPermissions(Array.isArray(u?.permissions) ? u.permissions : [])
    setEditBranchIds(Array.isArray(u?.branchIds) ? u.branchIds.map(String) : [])
    setEditIsActive(u?.isActive !== false)
    setEditError('')
    setEditOpen(true)
    setTimeout(() => {
      try {
        editEmailInputRef.current?.focus()
      } catch {
      }
    }, 50)
  }

  const saveEdit = async (e) => {
    e.preventDefault()
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
    const pwd = String(editPassword || '').trim()
    if (pwd) body.password = pwd
    const res = await api(`/api/canteen/staff/${editing.id}`, { method: 'PUT', data: body, silent: true })
    setEditLoading(false)
    if (!res?.ok) {
      const msg = res?.message || (res?.status === 409 && res?.code === 'duplicate_email' ? 'Bu e-posta zaten kayıtlı' : (res?.status === 409 && res?.code === 'duplicate_username' ? 'Bu kullanıcı adı zaten kayıtlı' : 'Kaydedilemedi'))
      setEditError(msg)
      if (res?.status === 409 && (res?.code === 'duplicate_email' || res?.code === 'duplicate_username')) {
        try {
          editEmailInputRef.current?.focus()
        } catch {
        }
      }
      return
    }
    setEditOpen(false)
    setEditing(null)
    await load()
  }

  const quickToggleActive = async (u) => {
    if (!u?.id) return
    const nextActive = !(u?.isActive !== false)
    const res = await api(`/api/canteen/staff/${u.id}`, { method: 'PUT', data: { isActive: nextActive }, silent: true })
    if (!res?.ok) {
      setError(res?.message || 'Güncellenemedi')
      return
    }
    load()
  }

  const create = async (e) => {
    e.preventDefault()
    setError('')
    const res = await api('/api/canteen/staff', {
      method: 'POST',
      data: { name, username, email, password, permissions, branchIds },
      silent: true
    })
    if (!res?.ok) {
      const msg = res?.message || (res?.status === 409 && res?.code === 'duplicate_email' ? 'Bu e-posta zaten kayıtlı' : (res?.status === 409 && res?.code === 'duplicate_username' ? 'Bu kullanıcı adı zaten kayıtlı' : 'Personel eklenemedi'))
      setError(msg)
      if (res?.status === 409 && (res?.code === 'duplicate_email' || res?.code === 'duplicate_username')) {
        try {
          emailInputRef.current?.focus()
        } catch {
        }
      }
      return
    }
    setName('')
    setUsername('')
    setEmail('')
    setPassword('')
    setPermissions([])
    setBranchIds([])
    load()
  }

  const remove = async (id) => {
    if (!window.confirm('Personeli devre dışı bırakmak istiyor musun?')) return
    setError('')
    const res = await api(`/api/canteen/staff/${id}`, { method: 'DELETE', silent: true })
    if (!res?.ok) {
      setError(res?.message || 'Silinemedi')
      return
    }
    load()
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Personel Ayarları</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Yetkiler ve görebileceği şubeler.</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Pasif personelleri göster</span>
          </label>
        </div>
        <button className="btn btn--compact" type="button" onClick={load} disabled={loading}>{loading ? '...' : 'Yenile'}</button>
      </div>

      {!!error && <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}

      <form className="card" onSubmit={create}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Yeni Personel</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kullanıcı Adı</div>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ornek: kantin1" />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta</div>
            <input ref={emailInputRef} className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şifre</div>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </div>

        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {PERMS.map(p => (
            <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 999 }}>
              <input type="checkbox" checked={permSet.has(p.key)} onChange={() => togglePerm(p.key)} />
              <span style={{ fontSize: 13 }}>{p.label}</span>
            </label>
          ))}
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Görebileceği şubeler</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {branches.map(b => (
              <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 999 }}>
                <input type="checkbox" checked={branchSet.has(String(b.id))} onChange={() => toggleBranch(b.id)} />
                <span style={{ fontSize: 13 }}>{b.name}</span>
              </label>
            ))}
            {branches.length === 0 && <div style={{ color: 'var(--muted)' }}>Önce şube oluştur</div>}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="btn" disabled={!name.trim() || !email.trim() || !password.trim()}>Ekle</button>
        </div>
      </form>

      <div className="card">
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map(u => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 10, opacity: u.isActive === false ? 0.6 : 1 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{u.name}</div>
                {u.username ? <div style={{ color: 'var(--muted)', fontSize: 12 }}>{u.username}</div> : null}
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{u.email}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {(Array.isArray(u.permissions) ? u.permissions : []).map(p => (
                    <span key={p} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, border: '1px solid var(--border)', background: '#f9fafb' }}>
                      {getPermissionLabel(p)}
                    </span>
                  ))}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{Array.isArray(u.branchIds) ? `Şubeler: ${u.branchIds.length}` : ''}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{u.isActive === false ? 'Durum: Pasif' : 'Durum: Aktif'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button className="btn btn--compact" type="button" onClick={() => openEdit(u)}>Düzenle</button>
                <button className="btn btn--compact" type="button" onClick={() => quickToggleActive(u)}>{u.isActive === false ? 'Aktifleştir' : 'Pasifleştir'}</button>
                <button className="btn btn--danger btn--compact" type="button" onClick={() => remove(u.id)}>Sil</button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
        </div>
      </div>

      <Modal open={editOpen} onClose={() => { setEditOpen(false); setEditing(null) }} title="Personel Düzenle">
        <form onSubmit={saveEdit} style={{ display: 'grid', gap: 10 }}>
          {!!editError && <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{editError}</div>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" checked={!!editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} />
            <span>Personel Aktif</span>
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kullanıcı Adı</div>
            <input className="input" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="ornek: kantin1" />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta</div>
            <input ref={editEmailInputRef} className="input" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni Şifre (opsiyonel)</div>
            <input className="input" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {PERMS.map(p => (
              <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 999 }}>
                <input type="checkbox" checked={editPermSet.has(p.key)} onChange={() => toggleEditPerm(p.key)} />
                <span style={{ fontSize: 13 }}>{p.label}</span>
              </label>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Görebileceği şubeler</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {branches.map(b => (
                <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 999 }}>
                  <input type="checkbox" checked={editBranchSet.has(String(b.id))} onChange={() => toggleEditBranch(b.id)} />
                  <span style={{ fontSize: 13 }}>{b.name}</span>
                </label>
              ))}
              {branches.length === 0 && <div style={{ color: 'var(--muted)' }}>Önce şube oluştur</div>}
            </div>
          </div>

          <button className="btn" disabled={editLoading}>{editLoading ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </form>
      </Modal>
    </div>
  )
}
