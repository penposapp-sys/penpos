import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import Modal from '../components/Modal.jsx'

export default function BranchesPage() {
  const getBranchId = (b) => b?._id || b?.id

  const [items, setItems] = useState([])
  const [staff, setStaff] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [staffOpen, setStaffOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [createForm, setCreateForm] = useState({ name: '', description: '' })
  const [editForm, setEditForm] = useState({ name: '', description: '', isActive: true })
  const [staffIds, setStaffIds] = useState([])
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api('/api/branches')
      const branches = Array.isArray(res?.branches) ? res.branches : []
      setItems(branches.map(b => ({ ...b, isActive: b?.isActive !== false, description: b?.description || '' })))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadStaff = async () => {
    try {
      const res = await api('/api/tenant/staff', { silent: true })
      const list = Array.isArray(res?.staff) ? res.staff : []
      setStaff(list)
      return list
    } catch {
      setStaff([])
      return []
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setCreateForm({ name: '', description: '' })
    setFormError('')
    setCreateOpen(true)
  }
  const onCreate = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const { branch } = await api('/api/branches', { method: 'POST', body: JSON.stringify(createForm) })
      if (branch) setItems([branch, ...items])
      setCreateOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openEdit = (b) => {
    setSelected(b)
    setEditForm({ name: b?.name || '', description: b?.description || '', isActive: b?.isActive !== false })
    setFormError('')
    setEditOpen(true)
  }
  const onEdit = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const bid = getBranchId(selected)
      if (!bid) {
        toast.error('Şube id bulunamadı (id/_id). Backend response alanlarını kontrol edin.')
        console.warn('[BRANCH_ID_MISSING]', selected)
        return
      }
      const { branch } = await api(`/api/branches/${bid}`, { method: 'PUT', body: JSON.stringify(editForm) })
      if (branch) setItems(items.map(i => (String(getBranchId(i)) === String(getBranchId(branch)) ? branch : i)))
      setEditOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const onToggle = async (b) => {
    const bid = getBranchId(b)
    if (!bid) {
      toast.error('Şube id bulunamadı (id/_id). Backend response alanlarını kontrol edin.')
      console.warn('[BRANCH_ID_MISSING]', b)
      return
    }
    try {
      const { branch } = await api(`/api/branches/${bid}/toggle`, { method: 'PUT' })
      if (branch) setItems(items.map(i => (String(getBranchId(i)) === String(getBranchId(branch)) ? branch : i)))
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const openStaffAssign = async (b) => {
    const bid = getBranchId(b)
    if (!bid) {
      toast.error('Şube id bulunamadı (id/_id). Backend response alanlarını kontrol edin.')
      console.warn('[BRANCH_ID_MISSING]', b)
      return
    }
    setSelected(b)
    setFormError('')
    setStaffOpen(true)
    const list = await loadStaff()
    const selectedStaff = (list || []).filter(s => Array.isArray(s.branchIds) && s.branchIds.map(String).includes(String(bid))).map(s => s.id)
    setStaffIds(selectedStaff)
  }

  const saveStaffAssign = async () => {
    const bid = getBranchId(selected)
    if (!bid) {
      toast.error('Şube id bulunamadı (id/_id). Backend response alanlarını kontrol edin.')
      console.warn('[BRANCH_ID_MISSING]', selected)
      return
    }
    setFormLoading(true)
    setFormError('')
    try {
      await api(`/api/branches/${bid}/staff`, { method: 'PUT', body: JSON.stringify({ staffIds }) })
      await loadStaff()
      setStaffOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Şubeler</h3>
        <button className="btn" onClick={openCreate}>Yeni Şube</button>
      </div>
      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
      {loading ? 'Yükleniyor...' : (
        items.length === 0 ? (
          <div>Henüz şube yok. Başlamak için “Yeni Şube” ekle.</div>
        ) : (
          <>
            <div className="desktop-only">
              <table className="table">
                <thead>
                  <tr><th>Ad</th><th>Açıklama</th><th>Durum</th><th className="actions" style={{ width: 360 }}>Aksiyonlar</th></tr>
                </thead>
                <tbody>
                  {items.map((b) => {
                    const bid = getBranchId(b)
                    const statusLabel = b.isActive ? 'Aktif' : 'Pasif'
                    return (
                      <tr key={bid || b.name}>
                        <td>{b.name}</td>
                        <td>{b.description || ''}</td>
                        <td>{statusLabel}</td>
                        <td className="actions">
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn" onClick={() => openEdit(b)}>Düzenle</button>
                            <button className="btn" onClick={() => openStaffAssign(b)}>Personel</button>
                            <button className="btn" onClick={() => onToggle(b)}>{b.isActive ? 'Pasifleştir' : 'Aktifleştir'}</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-only settings-mobile">
              {(items || []).map((b) => {
                const bid = getBranchId(b)
                const statusLabel = b.isActive ? 'Aktif' : 'Pasif'
                return (
                  <div key={bid || b.name} className="mobile-list-item">
                    <div className="mobile-item-title breakAny">{b.name}</div>
                    <div className="mobile-item-meta">
                      {!!String(b.description || '').trim() && <span className="breakAny">Açıklama: {b.description}</span>}
                      <span>Durum: {statusLabel}</span>
                    </div>
                    <div className="mobile-actions-row">
                      <button className="btn" type="button" onClick={() => openEdit(b)}>Düzenle</button>
                      <button className="btn" type="button" onClick={() => openStaffAssign(b)}>Personel</button>
                      <button className="btn" type="button" onClick={() => onToggle(b)}>{b.isActive ? 'Pasifleştir' : 'Aktifleştir'}</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Şube">
        <form onSubmit={onCreate} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Açıklama</div>
            <input className="input" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
          </label>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Oluştur'}</button>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Şube Düzenle">
        <form onSubmit={onEdit} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Açıklama</div>
            <input className="input" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={!!editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
            Aktif
          </label>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Kaydet'}</button>
        </form>
      </Modal>

      <Modal open={staffOpen} onClose={() => setStaffOpen(false)} title="Şube Personel Yetkisi">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>Şube: {selected?.name || '-'}</div>
          <div className="card" style={{ borderColor: 'var(--border)', maxHeight: 320, overflowY: 'auto' }}>
            {(staff || []).length === 0 ? (
              <div style={{ color: 'var(--muted)' }}>Personel bulunamadı</div>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {staff.map(s => {
                  const checked = staffIds.includes(s.id)
                  return (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, border: '1px solid var(--border)', borderRadius: 10, background: checked ? '#eff6ff' : '#ffffff' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? Array.from(new Set([...staffIds, s.id]))
                            : staffIds.filter(x => x !== s.id)
                          setStaffIds(next)
                        }}
                      />
                      <div style={{ display: 'grid', minWidth: 0 }}>
                        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.email}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setStaffOpen(false)} disabled={formLoading}>Vazgeç</button>
            <button className="btn" onClick={saveStaffAssign} disabled={formLoading}>{formLoading ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
