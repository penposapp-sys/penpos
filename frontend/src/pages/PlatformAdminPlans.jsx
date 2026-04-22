import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import Modal from '../components/Modal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'

export default function PlatformAdminPlans() {
  const { isMobilePortrait } = useResponsiveFlags()
  const [systemType, setSystemType] = useState('kermes')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState({
    systemType: 'kermes',
    name: '',
    price: 0,
    limits: { products: -1, tables: -1, staff: -1 },
    features: { reports: false, kitchen: false },
    trialDays: 0,
    isActive: true
  })

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api(`/api/platform/plans?systemType=${encodeURIComponent(systemType)}`)
      if (!res?.ok) throw new Error(res?.message || 'Planlar yuklenemedi')
      setItems(Array.isArray(res?.plans) ? res.plans : [])
    } catch (err) {
      setError(err.message)
      setItems([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [systemType])

  const openCreate = () => {
    setEditItem(null)
    setForm({ systemType, name: '', price: 0, limits: { products: -1, tables: -1, staff: -1 }, features: { reports: false, kitchen: false }, trialDays: 0, isActive: true })
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (p) => {
    setEditItem(p)
    setForm({ systemType: p.systemType || 'kermes', name: p.name, price: p.price || 0, limits: p.limits || { products: -1, tables: -1, staff: -1 }, features: p.features || { reports: false, kitchen: false }, trialDays: p.trialDays || 0, isActive: !!p.isActive })
    setFormError('')
    setModalOpen(true)
  }

  const systemLabel = (st) => {
    const t = String(st || '').toLowerCase()
    if (t === 'kantin') return 'KANTİN'
    return 'RESTORAN'
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      let res
      if (editItem) {
        res = await api(`/api/platform/plans/${editItem._id}`, { method: 'PUT', body: JSON.stringify(form) })
      } else {
        res = await api('/api/platform/plans', { method: 'POST', body: JSON.stringify(form) })
      }
      if (!res?.ok) throw new Error(res?.message || 'Plan kaydedilemedi')
      setModalOpen(false)
      await load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openDelete = (p) => {
    setDeleteTarget(p)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await api(`/api/platform/plans/${deleteTarget._id}`, { method: 'DELETE' })
      if (!res?.ok) throw new Error(res?.message || 'Plan silinemedi')
      await load()
      toast.success('Plan silindi')
      setDeleteConfirmOpen(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="main">
      <div className="actionWrap" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Planlar</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="segmented" style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 999, overflow: 'hidden' }}>
            <button type="button" className={systemType === 'kantin' ? 'btn btn--compact btn--primary' : 'btn btn--compact'} onClick={() => setSystemType('kantin')}>KANTİN</button>
            <button type="button" className={systemType === 'kermes' ? 'btn btn--compact btn--primary' : 'btn btn--compact'} onClick={() => setSystemType('kermes')}>RESTORAN</button>
          </div>
          <button className={isMobilePortrait ? 'btn btn--full' : 'btn'} onClick={openCreate}>Yeni Plan</button>
        </div>
      </div>
      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
      <div className="card">
        {loading ? 'Yükleniyor...' : (
          items.length === 0 ? (
            <div>Henüz plan yok.</div>
          ) : (
            isMobilePortrait ? (
              <div className="cardList">
                {items.map(p => (
                  <div key={p._id} className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <div className="breakAny" style={{ fontWeight: 800 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{systemLabel(p.systemType)}</div>
                      </div>
                      <span className="page-pill">{p.isActive ? 'Aktif' : 'Pasif'}</span>
                    </div>
                    <div style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ color: 'var(--muted)' }}>Fiyat</div>
                        <div style={{ fontWeight: 800, textAlign: 'right' }}>{Number(p.price || 0).toLocaleString('tr-TR')} ₺</div>
                      </div>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <div style={{ color: 'var(--muted)' }}>Limitler</div>
                        <div className="breakAny" style={{ fontWeight: 700 }}>{`Ürün: ${p.limits?.products ?? '-'} • Masa: ${p.limits?.tables ?? '-'} • Personel: ${p.limits?.staff ?? '-'}`}</div>
                      </div>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <div style={{ color: 'var(--muted)' }}>Özellikler</div>
                        <div style={{ fontWeight: 700 }}>{`Rapor: ${p.features?.reports ? '✓' : '✗'} • Mutfak: ${p.features?.kitchen ? '✓' : '✗'}`}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ color: 'var(--muted)' }}>Deneme</div>
                        <div style={{ fontWeight: 700, textAlign: 'right' }}>{Number(p.trialDays || 0)} gün</div>
                      </div>
                    </div>
                    <div className="actionWrap" style={{ marginTop: 10 }}>
                      <button className="btn" onClick={() => openEdit(p)}>Düzenle</button>
                      <button className="btn" onClick={() => openDelete(p)}>Sil</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Sistem</th><th>Ad</th><th>Fiyat</th><th>Limitler</th><th>Özellikler</th><th>Aktif</th><th style={{ width: 220 }}>Aksiyonlar</th></tr>
                </thead>
                <tbody>
                  {items.map(p => (
                    <tr key={p._id}>
                      <td>{systemLabel(p.systemType)}</td>
                      <td>{p.name}</td>
                      <td>{p.price}</td>
                      <td>{`Ürün:${p.limits?.products ?? '-'} | Masa:${p.limits?.tables ?? '-'} | Personel:${p.limits?.staff ?? '-'}`}</td>
                      <td>{`Rapor:${p.features?.reports ? '✓' : '✗'} | Mutfak:${p.features?.kitchen ? '✓' : '✗'}`}</td>
                      <td>{p.isActive ? '✓' : '✗'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn" onClick={() => openEdit(p)}>Düzenle</button>
                          <button className="btn" onClick={() => openDelete(p)}>Sil</button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Plan Düzenle' : 'Yeni Plan'}>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sistem</div>
            <select className="input" value={form.systemType} onChange={(e) => setForm({ ...form, systemType: e.target.value })} style={{ height: 38 }}>
              <option value="kantin">KANTİN</option>
              <option value="kermes">RESTORAN</option>
            </select>
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Plan adı</div>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fiyat</div>
            <input type="number" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value || 0) })} />
          </label>
          <div className="planLimitsGrid">
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ürün limiti (-1 sınırsız)</div>
              <input type="number" className="input" value={form.limits.products} onChange={(e) => setForm({ ...form, limits: { ...form.limits, products: Number(e.target.value || -1) } })} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Masa limiti</div>
              <input type="number" className="input" value={form.limits.tables} onChange={(e) => setForm({ ...form, limits: { ...form.limits, tables: Number(e.target.value || -1) } })} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Personel limiti</div>
              <input type="number" className="input" value={form.limits.staff} onChange={(e) => setForm({ ...form, limits: { ...form.limits, staff: Number(e.target.value || -1) } })} />
            </label>
          </div>
          <div className="planFeaturesRow">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.features.reports} onChange={(e) => setForm({ ...form, features: { ...form.features, reports: e.target.checked } })} />
              <span>Raporlar</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.features.kitchen} onChange={(e) => setForm({ ...form, features: { ...form.features, kitchen: e.target.checked } })} />
              <span>Mutfak</span>
            </label>
          </div>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Deneme süresi (gün)</div>
            <input type="number" className="input" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: Number(e.target.value || 0) })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            <span>Aktif</span>
          </label>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : (editItem ? 'Kaydet' : 'Oluştur')}</button>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Plan Sil"
        description="Bu işlem geri alınamaz. Plan silinecek. Emin misiniz?"
        confirmText="Evet, Sil"
        danger={true}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
