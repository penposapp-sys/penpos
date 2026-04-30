import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import Modal from '../components/Modal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { PERMISSION_GROUPS_TR, canonicalizePermissions, normalizePermissions } from '../constants/permissions.js'

export default function StaffPage({ systemType }) {
  const { tenantCtx, user, refresh } = useAuth()
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [createForm, setCreateForm] = useState({ name: '', username: '', email: '', password: '', permissions: [], systemType })
  const [editForm, setEditForm] = useState({ name: '', username: '', email: '', isActive: true, permissions: [], systemType })
  const [pwdForm, setPwdForm] = useState({ password: '' })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const togglePermission = (currentList, perm, checked) => {
    const set = new Set(Array.isArray(currentList) ? currentList : [])
    if (checked) set.add(perm)
    else set.delete(perm)
    return Array.from(set)
  }

  const renderPermissionsEditor = (value, onChange) => {
    const selected = new Set(Array.isArray(value) ? value : [])
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        {(PERMISSION_GROUPS_TR || []).map((group) => (
          <div key={group.title} className="card card--stable" style={{ borderColor: 'var(--border)' }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>{group.title}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {(group.items || []).map((it) => (
                <label key={it.permission} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'start' }}>
                  <input
                    type="checkbox"
                    checked={selected.has(it.permission)}
                    onChange={(e) => onChange(togglePermission(value, it.permission, e.target.checked))}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <div style={{ fontWeight: 700 }}>{it.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{it.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const staffRes = await api('/api/tenant/staff', { silent: true, skipBranchHeader: true })
      if (staffRes?.success === false) {
        setItems([])
        return
      }
      const list = Array.isArray(staffRes.staff) ? staffRes.staff : []
      if (systemType) {
        setItems(list.filter(s => s.systemType === systemType))
      } else {
        setItems(list)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const openCreate = () => {
    setCreateForm({ name: '', username: '', email: '', password: '', permissions: [], systemType })
    setFormError('')
    setCreateOpen(true)
  }
  const onCreate = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const payload = { ...createForm, systemType, permissions: canonicalizePermissions(createForm.permissions || []) }
      const res = await api('/api/tenant/staff', { method: 'POST', body: JSON.stringify(payload), silent: true, skipBranchHeader: true })
      if (res?.success === false) {
        setFormError(res.message || 'Bu işlem için yetkiniz yok')
        return
      }
      setItems([res.staff, ...items])
      setCreateOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openEdit = (s) => {
    setSelected(s)
    setEditForm({
      name: s.name,
      username: s.username || '',
      email: s.email,
      isActive: s.isActive,
      permissions: canonicalizePermissions(normalizePermissions(s.permissions || [])),
      systemType: s.systemType || systemType
    })
    setFormError('')
    setEditOpen(true)
  }
  const onEdit = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const payload = { ...editForm, systemType, permissions: canonicalizePermissions(editForm.permissions || []) }
      const res = await api(`/api/tenant/staff/${selected.id}`, { method: 'PUT', body: JSON.stringify(payload), silent: true, skipBranchHeader: true })
      if (res?.success === false) {
        setFormError(res.message || 'Bu işlem için yetkiniz yok')
        return
      }
      setItems(items.map(i => i.id === res.staff.id ? res.staff : i))
      setEditOpen(false)
      if (String(selected?.id) && String(user?.id) && String(selected.id) === String(user.id)) {
        try { await refresh() } catch {}
      }
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openPwd = (s) => {
    setSelected(s)
    setPwdForm({ password: '' })
    setFormError('')
    setPwdOpen(true)
  }
  const onPwd = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const res = await api(`/api/tenant/staff/${selected.id}/password`, { method: 'PUT', body: JSON.stringify(pwdForm), silent: true, skipBranchHeader: true })
      if (res?.success === false) {
        setFormError(res.message || 'Bu işlem için yetkiniz yok')
        return
      }
      setPwdOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const onDisable = async (s) => {
    try {
      const result = await api(`/api/tenant/staff/${s.id}`, { method: 'DELETE', silent: true, skipBranchHeader: true })
      if (result?.success === false) {
        setError(result.message || 'Bu işlem için yetkiniz yok')
        return
      }
      setItems(items.map(i => i.id === s.id ? { ...i, isActive: result.isActive } : i))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Personel</h3>
        <button className="btn" onClick={openCreate} disabled={tenantCtx?.tenant?.plan?.status === 'expired'} title={tenantCtx?.tenant?.plan?.status === 'expired' ? 'Paket süreniz doldu. Plan yükseltin.' : undefined}>Yeni Personel</button>
      </div>
      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
      {loading ? 'Yükleniyor...' : (
        items.length === 0 ? (
          <div>Henüz personel yok. Başlamak için “Yeni Personel” ekle.</div>
        ) : (
          <>
            <div className="desktop-only">
              <table className="table">
                <thead>
                  <tr><th>Ad</th><th>Kullanıcı Adı</th><th>E-posta</th><th>Durum</th><th>İzinler</th><th className="actions" style={{ width: 240 }}>Aksiyonlar</th></tr>
                </thead>
                <tbody>
                  {items.map(s => {
                    const statusLabel = s.isActive ? 'Aktif' : 'Pasif'
                    const permCount = (s.permissions || []).length
                    return (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{s.username || '-'}</td>
                        <td>{s.email}</td>
                        <td>{statusLabel}</td>
                        <td>
                          {permCount > 0 ? (
                            <div style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {permCount} izin
                            </div>
                          ) : '-'}
                        </td>
                        <td className="actions">
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn" onClick={() => openEdit(s)}>Düzenle</button>
                            <button className="btn" onClick={() => openPwd(s)}>Şifre Sıfırla</button>
                            <button className="btn" onClick={() => onDisable(s)}>Pasifleştir</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-only settings-mobile">
              {(items || []).map(s => {
                const statusLabel = s.isActive ? 'Aktif' : 'Pasif'
                const permCount = (s.permissions || []).length
                return (
                  <div key={s.id} className="mobile-list-item">
                    <div className="mobile-item-title breakAny">{s.name}</div>
                    <div className="mobile-item-meta">
                      <span className="breakAny">Kullanıcı adı: {s.username || '-'}</span>
                      <span className="breakAny">E-posta: {s.email}</span>
                      <span>Durum: {statusLabel}</span>
                      <span>İzin: {permCount}</span>
                    </div>
                    <div className="mobile-actions-row">
                      <button className="btn" type="button" onClick={() => openEdit(s)}>Düzenle</button>
                      <button className="btn" type="button" onClick={() => openPwd(s)}>Şifre Sıfırla</button>
                      <button className="btn" type="button" onClick={() => onDisable(s)}>Pasifleştir</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Personel">
        <form onSubmit={onCreate} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kullanıcı Adı</div>
            <input className="input" value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} placeholder="ornek: kantin1" />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta</div>
            <input className="input" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şifre</div>
            <input className="input" type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
          </label>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>İzinler</div>
            {renderPermissionsEditor(createForm.permissions, (permissions) => setCreateForm({ ...createForm, permissions }))}
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              Personelin şube yetkisi “Şube Ayarları &gt; Personel” bölümünden yönetilir.
            </div>
          </div>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Oluştur'}</button>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Personel Düzenle">
        <form onSubmit={onEdit} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kullanıcı Adı</div>
            <input className="input" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} placeholder="ornek: kantin1" />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta</div>
            <input className="input" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
            Aktif
          </label>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>İzinler</div>
            {renderPermissionsEditor(editForm.permissions, (permissions) => setEditForm({ ...editForm, permissions }))}
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              Personelin şube yetkisi “Şube Ayarları &gt; Personel” bölümünden yönetilir.
            </div>
          </div>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Kaydet'}</button>
        </form>
      </Modal>

      <Modal open={pwdOpen} onClose={() => setPwdOpen(false)} title="Şifre Sıfırla">
        <form onSubmit={onPwd} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni Şifre</div>
            <input className="input" type="password" value={pwdForm.password} onChange={(e) => setPwdForm({ password: e.target.value })} />
          </label>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Güncelle'}</button>
        </form>
      </Modal>
    </div>
  )
}
