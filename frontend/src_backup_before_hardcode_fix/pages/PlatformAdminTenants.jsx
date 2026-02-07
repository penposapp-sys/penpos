import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import Modal from '../components/Modal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import { trStatusLabel } from '../i18n/tr.js'

export default function PlatformAdminTenants({ system = 'kermes' }) {
  const { isMobilePortrait } = useResponsiveFlags()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', ownerName: '', ownerEmail: '', ownerPassword: '' })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)
  const [extendForm, setExtendForm] = useState({ days: 7 })
  const [extendError, setExtendError] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState(null)
  const [plans, setPlans] = useState([])
  const [assignForm, setAssignForm] = useState({ planId: '', startsAt: '' })
  const [assignError, setAssignError] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '' })
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toggleBusy, setToggleBusy] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api(`/api/platform/tenants?system=${encodeURIComponent(system)}`, { portalOverride: 'platform' })
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.items)
          ? res.items
          : []
      setItems(list)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    setItems([])
    setLoading(false)
    setError('')
    setModalOpen(false)
    setForm({ name: '', ownerName: '', ownerEmail: '', ownerPassword: '' })
    setFormError('')
    setFormLoading(false)
    setExtendOpen(false)
    setExtendForm({ days: 7 })
    setExtendError('')
    setAssignOpen(false)
    setAssignTarget(null)
    setPlans([])
    setAssignForm({ planId: '', startsAt: '' })
    setAssignError('')
    setAssignLoading(false)
    setEditOpen(false)
    setEditTarget(null)
    setEditForm({ name: '', email: '' })
    setEditError('')
    setEditLoading(false)
    setDeleteConfirmOpen(false)
    setDeleteTarget(null)
    setToggleBusy(null)
    load()
  }, [system])

  const openCreate = () => {
    setForm({ name: '', ownerName: '', ownerEmail: '', ownerPassword: '' })
    setFormError('')
    setModalOpen(true)
  }

  const onCreate = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const target = system === 'canteen' ? '/api/platform/tenants/canteen' : '/api/platform/tenants/kermes'
      await api(target, { method: 'POST', body: JSON.stringify({ ...form }) })
      setModalOpen(false)
      await load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const toggleActive = async (t) => {
    try {
      await api(`/api/platform/tenants/${t._id}/status`, { method: 'PUT', body: JSON.stringify({ isActive: !t.isActive }) })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const openAssign = async (t) => {
    setAssignTarget(t)
    const today = new Date()
    const dd = String(today.getDate()).padStart(2, '0')
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const yyyy = String(today.getFullYear())
    setAssignForm({ planId: '', startsAt: `${dd}/${mm}/${yyyy}` })
    setAssignError('')
    setAssignOpen(true)
    try {
      const { plans } = await api('/api/platform/plans')
      setPlans(plans)
    } catch (err) {
      setAssignError(err.message)
    }
  }

  const normalizeDateForAPI = (value) => {
    if (!value) return new Date().toISOString().slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [dd, mm, yyyy] = value.split('/')
      return `${yyyy}-${mm}-${dd}`
    }
    const d = new Date(value)
    return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10)
  }

  const onAssign = async (e) => {
    e.preventDefault()
    setAssignLoading(true)
    setAssignError('')
    try {
      const safeStarts = normalizeDateForAPI(assignForm.startsAt)
      const result = await api(`/api/platform/tenants/${assignTarget._id}/plan`, { method: 'PUT', body: JSON.stringify({ planId: assignForm.planId, startsAt: safeStarts }) })
      setAssignOpen(false)
      await load()
      if (result?.success) {
        toast.success('İşlem başarıyla tamamlandı')
      }
    } catch (err) {
      setAssignError(err.message)
    } finally {
      setAssignLoading(false)
    }
  }

  const openExtend = (t) => {
    setAssignTarget(t)
    setExtendForm({ days: 7 })
    setExtendError('')
    setExtendOpen(true)
  }
  const onExtend = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setExtendError('')
    try {
      const result = await api(`/api/platform/tenants/${assignTarget._id}/trial-extend`, { method: 'PUT', body: JSON.stringify({ days: Number(extendForm.days || 0) }) })
      setExtendOpen(false)
      await load()
      if (result?.success) {
        toast.success('İşlem başarıyla tamamlandı')
      }
    } catch (err) {
      setExtendError(err.message)
    } finally {
      setFormLoading(false)
    }
  }
  const endTrial = async (t) => {
    try {
      const result = await api(`/api/platform/tenants/${t._id}/trial-end`, { method: 'PUT' })
      await load()
      if (result?.success) {
        toast.success('İşlem başarıyla tamamlandı')
      }
    } catch (err) {
      setError(err.message)
    }
  }
  const openEdit = (t) => {
    setEditTarget(t)
    setEditForm({ name: t.name, email: t.ownerEmail || '' })
    setEditError('')
    setEditOpen(true)
  }
  const onEdit = async (e) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError('')
    try {
      const result = await api(`/api/platform/tenants/${editTarget._id}`, { method: 'PUT', body: JSON.stringify({ name: editForm.name, email: editForm.email }) })
      const tenant = result.tenant
      setItems(items.map(i => i._id === tenant.id ? { ...i, name: tenant.name, ownerEmail: tenant.ownerEmail || i.ownerEmail } : i))
      setEditOpen(false)
    } catch (err) {
      setEditError(err.code === 'email_taken' ? 'Bu e-posta zaten kullanılıyor' : err.message)
    } finally {
      setEditLoading(false)
    }
  }
  
  const openDelete = (t) => {
    setDeleteTarget(t)
    setDeleteConfirmOpen(true)
  }
  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await api(`/api/platform/tenants/${deleteTarget._id}`, { method: 'DELETE' })
      await load()
      toast.success('Üye tamamen silindi')
      setDeleteConfirmOpen(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="main">
      <div className="actionWrap" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{system === 'canteen' ? 'Kantin Üyeler' : 'Kermes Üyeler'}</h3>
        <button className={isMobilePortrait ? 'btn btn--full' : 'btn'} onClick={openCreate}>Yeni Üye</button>
      </div>
      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
      <div className="card">
        {loading ? 'Yükleniyor...' : (
          items.length === 0 ? (
            <div>Henüz üye yok.</div>
          ) : (
            isMobilePortrait ? (
              <div className="cardList">
                {items.map(t => (
                  <div key={t._id} className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="breakAny" style={{ fontWeight: 800 }}>{t.name}</div>
                        <div style={{ color: 'var(--muted)', fontSize: 13 }}>{t.ownerEmail || '-'}</div>
                      </div>
                      <span className="page-pill">{t.isActive ? 'Aktif' : 'Pasif'}</span>
                    </div>
                    <div style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ color: 'var(--muted)' }}>Plan</div>
                        <div style={{ fontWeight: 700, textAlign: 'right' }}>{t.planName || '-'}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ color: 'var(--muted)' }}>Plan Durumu</div>
                        <div style={{ fontWeight: 700, textAlign: 'right' }}>{trStatusLabel(t.planStatus) || '-'}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ color: 'var(--muted)' }}>Bitiş</div>
                        <div style={{ fontWeight: 700, textAlign: 'right' }}>{t.planEndsAt ? new Date(t.planEndsAt).toLocaleDateString() : '-'}</div>
                      </div>
                    </div>
                    <div className="actionWrap" style={{ marginTop: 10 }}>
                      <button className="btn" onClick={() => openEdit(t)}>Düzenle</button>
                      <button className="btn" onClick={() => openDelete(t)}>Sil</button>
                      <button className="btn" onClick={() => toggleActive(t)}>{t.isActive ? 'Pasifleştir' : 'Aktifleştir'}</button>
                      <button className="btn" onClick={() => openAssign(t)}>{t.planName ? 'Plan Değiştir' : 'Plan Ata'}</button>
                      <button className="btn" onClick={() => openExtend(t)}>Deneme Uzat</button>
                      <button className="btn" onClick={() => endTrial(t)}>Denemeyi Bitir</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Ad</th><th>Durum</th><th>Plan</th><th>Plan Durumu</th><th>Bitiş</th><th style={{ width: 420 }}>Aksiyonlar</th></tr>
                </thead>
                <tbody>
                  {items.map(t => (
                    <tr key={t._id}>
                      <td>{t.name}</td>
                      <td>{t.isActive ? 'Aktif' : 'Pasif'}</td>
                      <td>{t.planName || '-'}</td>
                      <td>{trStatusLabel(t.planStatus) || '-'}</td>
                      <td>{t.planEndsAt ? new Date(t.planEndsAt).toLocaleDateString() : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn" onClick={() => openEdit(t)}>Düzenle</button>
                          <button className="btn" onClick={() => openDelete(t)}>Sil</button>
                          <button className="btn" onClick={() => toggleActive(t)}>{t.isActive ? 'Pasifleştir' : 'Aktifleştir'}</button>
                          <button className="btn" onClick={() => openAssign(t)}>{t.planName ? 'Plan Değiştir' : 'Plan Ata'}</button>
                          <button className="btn" onClick={() => openExtend(t)}>Deneme Uzat</button>
                          <button className="btn" onClick={() => endTrial(t)}>Denemeyi Bitir</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Yeni Üye">
        <form onSubmit={onCreate} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Restoran Adı</div>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sahip Adı</div>
            <input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sahip E-posta</div>
            <input className="input" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şifre</div>
            <input type="password" className="input" value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} />
          </label>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Üye Oluştur'}</button>
        </form>
      </Modal>

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title={`Plan Atama${assignTarget ? ` – ${assignTarget.name}` : ''}`}>
        <form onSubmit={onAssign} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Plan</div>
            <select className="input" value={assignForm.planId} onChange={(e) => setAssignForm({ ...assignForm, planId: e.target.value })}>
              <option value="">Seçiniz</option>
              {plans.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Başlangıç Tarihi</div>
            <input type="text" className="input" placeholder="gg/aa/yyyy" value={assignForm.startsAt} onChange={(e) => setAssignForm({ ...assignForm, startsAt: e.target.value })} />
          </label>
          {assignError && <div style={{ color: '#ef4444', fontSize: 13 }}>{assignError}</div>}
          <button className="btn" disabled={assignLoading || !assignForm.planId}>{assignLoading ? 'Gönderiliyor...' : 'Ata'}</button>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Üye Düzenle${editTarget ? ` – ${editTarget.name}` : ''}`}>
        <form onSubmit={onEdit} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta</div>
            <input className="input" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          </label>
          {editError && <div style={{ color: '#ef4444', fontSize: 13 }}>{editError}</div>}
          <button className="btn" disabled={editLoading}>{editLoading ? 'Gönderiliyor...' : 'Kaydet'}</button>
        </form>
      </Modal>

      <Modal open={extendOpen} onClose={() => setExtendOpen(false)} title={`Deneme Uzat${assignTarget ? ` – ${assignTarget.name}` : ''}`}>
        <form onSubmit={onExtend} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Gün</div>
            <input type="number" className="input" value={extendForm.days} onChange={(e) => setExtendForm({ days: Number(e.target.value || 0) })} />
          </label>
          {extendError && <div style={{ color: '#ef4444', fontSize: 13 }}>{extendError}</div>}
          <button className="btn" disabled={formLoading || !extendForm.days}>{formLoading ? 'Gönderiliyor...' : 'Uzat'}</button>
        </form>
      </Modal>
      <ConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Üye Sil"
        description="Bu işlem geri alınamaz. Üye ve tüm verileri silinecek. Emin misiniz?"
        confirmText="Evet, Sil"
        danger={true}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
