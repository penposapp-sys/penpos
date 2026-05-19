import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import Modal from '../components/Modal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import {
  AdminActionMenu,
  AdminEmptyState,
  AdminFilterBar,
  AdminFilterField,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableCard,
} from '../components/AdminListUi.jsx'

function systemLabel(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'canteen' || raw === 'kantin') return 'Mağaza'
  return 'Restoran'
}

function priceLabel(value) {
  return `${Number(value || 0).toLocaleString('tr-TR')} ₺`
}

function limitsLabel(plan) {
  return `Ürün: ${plan.limits?.products ?? '-'} • Masa: ${plan.limits?.tables ?? '-'} • Personel: ${plan.limits?.staff ?? '-'}`
}

function featuresLabel(plan) {
  return `Rapor: ${plan.features?.reports ? 'Açık' : 'Kapalı'} • Mutfak: ${plan.features?.kitchen ? 'Açık' : 'Kapalı'}`
}

export default function PlatformAdminPlans() {
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
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [trialFilter, setTrialFilter] = useState('all')
  const [form, setForm] = useState({
    systemType: 'kermes',
    name: '',
    price: 0,
    limits: { products: -1, tables: -1, staff: -1 },
    features: { reports: false, kitchen: false },
    trialDays: 0,
    isTrial: false,
    isActive: true,
  })

  const toFormSystemType = (value) => {
    const raw = String(value || '').trim().toLowerCase()
    if (raw === 'canteen' || raw === 'kantin') return 'kantin'
    return 'kermes'
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api(`/api/platform/plans?systemType=${encodeURIComponent(systemType)}`)
      if (!res?.ok) throw new Error(res?.message || 'Planlar yüklenemedi')
      setItems(Array.isArray(res?.plans) ? res.plans : [])
    } catch (err) {
      setError(err.message)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [systemType])

  const openCreate = () => {
    setEditItem(null)
    setForm({
      systemType,
      name: '',
      price: 0,
      limits: { products: -1, tables: -1, staff: -1 },
      features: { reports: false, kitchen: false },
      trialDays: 0,
      isTrial: false,
      isActive: true,
    })
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (plan) => {
    setEditItem(plan)
    setForm({
      systemType: toFormSystemType(plan.systemType),
      name: plan.name,
      price: plan.price || 0,
      limits: plan.limits || { products: -1, tables: -1, staff: -1 },
      features: plan.features || { reports: false, kitchen: false },
      trialDays: plan.trialDays || 0,
      isTrial: !!plan.isTrial,
      isActive: !!plan.isActive,
    })
    setFormError('')
    setModalOpen(true)
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const res = editItem
        ? await api(`/api/platform/plans/${editItem._id}`, { method: 'PUT', body: JSON.stringify(form) })
        : await api('/api/platform/plans', { method: 'POST', body: JSON.stringify(form) })
      if (!res?.ok) throw new Error(res?.message || 'Plan kaydedilemedi')
      setModalOpen(false)
      await load()
      toast.success(editItem ? 'Plan güncellendi' : 'Plan oluşturuldu')
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openDelete = (plan) => {
    setDeleteTarget(plan)
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

  const filteredItems = items.filter((plan) => {
    const query = search.trim().toLocaleLowerCase('tr-TR')
    const matchesSearch = !query || [
      plan.name,
      systemLabel(plan.systemType),
      limitsLabel(plan),
      featuresLabel(plan),
    ].some((value) => String(value || '').toLocaleLowerCase('tr-TR').includes(query))

    const matchesActive = activeFilter === 'all'
      || (activeFilter === 'active' && plan.isActive)
      || (activeFilter === 'inactive' && !plan.isActive)

    const matchesTrial = trialFilter === 'all'
      || (trialFilter === 'trial' && plan.isTrial)
      || (trialFilter === 'standard' && !plan.isTrial)

    return matchesSearch && matchesActive && matchesTrial
  })

  return (
    <div className="main">
      <div className="admin-page">
        <AdminPageHeader
          title="Planlar / Paketler"
          subtitle="Paket yapılarını yeni PenPOS tablo görünümünde yönetin."
          action={<button className="btn btn--primary" onClick={openCreate}>Yeni Plan</button>}
        />

        <AdminFilterBar>
          <AdminFilterField label="Arama">
            <input
              className="input admin-filter-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Plan adı, sistem, limit veya özellik ara"
            />
          </AdminFilterField>
          <AdminFilterField label="Sistem">
            <select className="input admin-filter-input" value={systemType} onChange={(event) => setSystemType(event.target.value)}>
              <option value="kermes">Restoran</option>
              <option value="kantin">Mağaza</option>
            </select>
          </AdminFilterField>
          <AdminFilterField label="Durum">
            <select className="input admin-filter-input" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
              <option value="all">Tümü</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
          </AdminFilterField>
        </AdminFilterBar>

        <AdminFilterBar>
          <AdminFilterField label="Paket Tipi">
            <select className="input admin-filter-input" value={trialFilter} onChange={(event) => setTrialFilter(event.target.value)}>
              <option value="all">Tümü</option>
              <option value="trial">Trial</option>
              <option value="standard">Standart</option>
            </select>
          </AdminFilterField>
          <div />
          <div />
        </AdminFilterBar>

        {error ? <div style={{ color: '#dc2626', fontWeight: 700 }}>{error}</div> : null}

        <AdminTableCard>
          {loading ? (
            <div style={{ padding: 22, fontWeight: 700, color: '#64748b' }}>Yükleniyor...</div>
          ) : filteredItems.length === 0 ? (
            <AdminEmptyState title="Gösterilecek plan bulunamadı" description="Filtreleri değiştirin veya yeni bir plan ekleyin." />
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '23%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Sistem</th>
                    <th>Plan</th>
                    <th>Fiyat</th>
                    <th>Limitler</th>
                    <th>Özellikler</th>
                    <th>Durum</th>
                    <th className="admin-actions-cell">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((plan) => (
                    <tr key={plan._id} className="admin-table-row">
                      <td><span className="admin-cell-ellipsis">{systemLabel(plan.systemType)}</span></td>
                      <td title={plan.name || ''}>
                        <div className="admin-cell-ellipsis">{plan.name}</div>
                        <div className="admin-cell-secondary admin-cell-ellipsis">{plan.isTrial ? `${plan.trialDays || 0} gün trial` : 'Standart paket'}</div>
                      </td>
                      <td><span className="admin-cell-ellipsis">{priceLabel(plan.price)}</span></td>
                      <td title={limitsLabel(plan)}><span className="admin-cell-ellipsis">{limitsLabel(plan)}</span></td>
                      <td title={featuresLabel(plan)}><span className="admin-cell-ellipsis">{featuresLabel(plan)}</span></td>
                      <td>
                        <AdminStatusBadge tone={plan.isActive ? 'success' : 'neutral'}>
                          {plan.isActive ? 'Aktif' : 'Pasif'}
                        </AdminStatusBadge>
                      </td>
                      <td className="admin-actions-cell">
                        <AdminActionMenu
                          items={[
                            { label: 'Düzenle', onClick: () => openEdit(plan) },
                            { label: 'Sil', onClick: () => openDelete(plan), danger: true },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminTableCard>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Plan Düzenle' : 'Yeni Plan'}>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sistem</div>
            <select className="input" value={form.systemType} onChange={(event) => setForm({ ...form, systemType: event.target.value })}>
              <option value="kantin">Mağaza</option>
              <option value="kermes">Restoran</option>
            </select>
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Plan Adı</div>
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fiyat</div>
            <input type="number" className="input" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value || 0) })} />
          </label>
          <div className="planLimitsGrid">
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ürün limiti</div>
              <input type="number" className="input" value={form.limits.products} onChange={(event) => setForm({ ...form, limits: { ...form.limits, products: Number(event.target.value || -1) } })} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Masa limiti</div>
              <input type="number" className="input" value={form.limits.tables} onChange={(event) => setForm({ ...form, limits: { ...form.limits, tables: Number(event.target.value || -1) } })} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Personel limiti</div>
              <input type="number" className="input" value={form.limits.staff} onChange={(event) => setForm({ ...form, limits: { ...form.limits, staff: Number(event.target.value || -1) } })} />
            </label>
          </div>
          <div className="planFeaturesRow">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.features.reports} onChange={(event) => setForm({ ...form, features: { ...form.features, reports: event.target.checked } })} />
              <span>Raporlar</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.features.kitchen} onChange={(event) => setForm({ ...form, features: { ...form.features, kitchen: event.target.checked } })} />
              <span>Mutfak</span>
            </label>
          </div>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Deneme süresi (gün)</div>
            <input type="number" className="input" value={form.trialDays} onChange={(event) => setForm({ ...form, trialDays: Number(event.target.value || 0) })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.isTrial} onChange={(event) => setForm({ ...form, isTrial: event.target.checked })} />
            <span>Deneme paketi</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
            <span>Aktif</span>
          </label>
          {formError ? <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div> : null}
          <button className="btn btn--primary" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : (editItem ? 'Kaydet' : 'Oluştur')}</button>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Plan Sil"
        description="Bu işlem geri alınamaz. Plan kalıcı olarak silinecek. Emin misiniz?"
        confirmText="Evet, Sil"
        cancelText="Vazgeç"
        danger={true}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
