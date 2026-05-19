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
import {
  formatPlanBadge,
  formatPlanDate,
  getPlanDisplayName,
  getPlanStatus,
  getRemainingPlanMeta,
  resolvePlanType,
} from '../lib/planPresentation.js'

function getTenantStateMeta(item) {
  return item?.isActive
    ? { label: 'Aktif', tone: 'success' }
    : { label: 'Pasif', tone: 'neutral' }
}

export default function PlatformAdminTenants({ system = 'kermes' }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', ownerName: '', ownerEmail: '', ownerPhone: '', ownerPassword: '' })
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
  const [assignPlansLoading, setAssignPlansLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' })
  const [editError, setEditError] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planStatusFilter, setPlanStatusFilter] = useState('all')

  const pagePlanType = system === 'canteen' ? 'canteen' : 'restaurant'
  const pageTitle = pagePlanType === 'canteen' ? 'Mağaza Üyeleri' : 'Restoran Üyeleri'
  const pageSubtitle = pagePlanType === 'canteen'
    ? 'Mağaza üye listesini paket süreleriyle birlikte yönetin.'
    : 'Restoran üye listesini paket süreleriyle birlikte yönetin.'

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api(`/api/platform/tenants?system=${encodeURIComponent(system)}`, { portalOverride: 'platform' })
      const rawList = Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : []
      setItems(rawList)
      return rawList
    } catch (err) {
      setError(err.message)
      setItems([])
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [system])

  const openCreate = () => {
    setForm({ name: '', ownerName: '', ownerEmail: '', ownerPhone: '', ownerPassword: '' })
    setFormError('')
    setModalOpen(true)
  }

  const onCreate = async (event) => {
    event.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const target = pagePlanType === 'canteen' ? '/api/platform/tenants/canteen' : '/api/platform/tenants/kermes'
      await api(target, { method: 'POST', body: JSON.stringify({ ...form }), portalOverride: 'platform' })
      setModalOpen(false)
      await load()
      toast.success('Uye olusturuldu')
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const toggleActive = async (tenant) => {
    try {
      await api(`/api/platform/tenants/${tenant._id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !tenant.isActive }),
        portalOverride: 'platform'
      })
      await load()
      toast.success(tenant.isActive ? 'Uye pasiflestirildi' : 'Uye aktiflestirildi')
    } catch (err) {
      setError(err.message)
    }
  }

  const openAssign = async (tenant) => {
    setAssignTarget(tenant)
    setAssignForm({
      planId: '',
      startsAt: new Date().toISOString().slice(0, 10)
    })
    setAssignError('')
    setAssignPlansLoading(true)
    setAssignOpen(true)

    try {
      const res = await api(
        `/api/platform/plans?tenantId=${encodeURIComponent(String(tenant._id || ''))}&systemType=${encodeURIComponent(pagePlanType)}`,
        { portalOverride: 'platform' }
      )
      const safePlans = Array.isArray(res?.plans) ? res.plans : Array.isArray(res?.items) ? res.items : []
      setPlans(safePlans.filter((plan) => resolvePlanType(plan) === pagePlanType))
      if (safePlans.length === 0) {
        setAssignError('Bu uye icin uygun plan bulunamadi.')
      }
    } catch (err) {
      setAssignError(err.message)
      setPlans([])
    } finally {
      setAssignPlansLoading(false)
    }
  }

  const normalizeDateForAPI = (value) => {
    if (!value) return new Date().toISOString().slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [dd, mm, yyyy] = value.split('/')
      return `${yyyy}-${mm}-${dd}`
    }
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10)
  }

  const onAssign = async (event) => {
    event.preventDefault()
    if (!assignTarget || !assignForm.planId) return
    setAssignLoading(true)
    setAssignError('')
    try {
      const safeStarts = normalizeDateForAPI(assignForm.startsAt)
      const result = await api(`/api/platform/tenants/${assignTarget._id}/plan`, {
        method: 'PUT',
        body: JSON.stringify({ planId: assignForm.planId, startsAt: safeStarts, systemType: pagePlanType }),
        portalOverride: 'platform'
      })
      const nextItems = await load()
      if (detailTarget?._id) {
        const refreshed = nextItems.find((item) => item._id === detailTarget._id)
        if (refreshed) setDetailTarget(refreshed)
      }
      setAssignOpen(false)
      setAssignTarget(null)
      if (result?.success) toast.success('Plan bilgisi guncellendi')
    } catch (err) {
      setAssignError(err.message)
    } finally {
      setAssignLoading(false)
    }
  }

  const openExtend = (tenant) => {
    setAssignTarget(tenant)
    setExtendForm({ days: 7 })
    setExtendError('')
    setExtendOpen(true)
  }

  const onExtend = async (event) => {
    event.preventDefault()
    setFormLoading(true)
    setExtendError('')
    try {
      const result = await api(`/api/platform/tenants/${assignTarget._id}/trial-extend`, {
        method: 'PUT',
        body: JSON.stringify({ days: Number(extendForm.days || 0) }),
        portalOverride: 'platform'
      })
      await load()
      setExtendOpen(false)
      if (result?.success) toast.success('Deneme suresi uzatildi')
    } catch (err) {
      setExtendError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const endTrial = async (tenant) => {
    try {
      const result = await api(`/api/platform/tenants/${tenant._id}/trial-end`, { method: 'PUT', portalOverride: 'platform' })
      await load()
      if (result?.success) toast.success('Deneme suresi sonlandirildi')
    } catch (err) {
      setError(err.message)
    }
  }

  const openEdit = (tenant) => {
    setEditTarget(tenant)
    setEditForm({ name: tenant.name || '', email: tenant.ownerEmail || '', phone: tenant.ownerPhone || tenant.phone || '' })
    setEditError('')
    setEditOpen(true)
  }

  const onEdit = async (event) => {
    event.preventDefault()
    setEditLoading(true)
    setEditError('')
    try {
      const result = await api(`/api/platform/tenants/${editTarget._id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editForm.name, email: editForm.email, phone: editForm.phone }),
        portalOverride: 'platform'
      })
      const tenant = result?.tenant
      setItems((prev) => prev.map((item) => (
        item._id === tenant?.id
          ? {
              ...item,
              name: tenant.name,
              ownerEmail: tenant.ownerEmail || item.ownerEmail,
              ownerPhone: tenant.ownerPhone || item.ownerPhone,
              phone: tenant.phone || item.phone,
            }
          : item
      )))
      setEditOpen(false)
      toast.success('Uye bilgileri guncellendi')
    } catch (err) {
      setEditError(err.code === 'email_taken' ? 'Bu e-posta zaten kullaniliyor' : err.message)
    } finally {
      setEditLoading(false)
    }
  }

  const openDelete = (tenant) => {
    setDeleteTarget(tenant)
    setDeleteConfirmOpen(true)
  }

  const openDetail = (tenant) => {
    setDetailTarget(tenant)
    setDetailOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await api(`/api/platform/tenants/${deleteTarget._id}`, { method: 'DELETE', portalOverride: 'platform' })
      await load()
      toast.success('Uye tamamen silindi')
      setDeleteConfirmOpen(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const filteredItems = items.filter((item) => {
    const query = search.trim().toLocaleLowerCase('tr-TR')
    const planName = getPlanDisplayName(item)
    const matchesSearch = !query || [
      item.name,
      item.ownerEmail,
      item.ownerPhone,
      item.phone,
      planName,
    ].some((value) => String(value || '').toLocaleLowerCase('tr-TR').includes(query))

    const tenantMeta = getTenantStateMeta(item)
    const planMeta = formatPlanBadge(item)
    const matchesStatus = statusFilter === 'all' || statusFilter === (tenantMeta.tone === 'success' ? 'active' : 'inactive')
    const matchesPlanStatus = planStatusFilter === 'all' || planStatusFilter === planMeta.key

    return matchesSearch && matchesStatus && matchesPlanStatus
  })

  return (
    <div className="main">
      <div className="admin-page">
        <AdminPageHeader
          title={pageTitle}
          subtitle={pageSubtitle}
          action={<button className="btn btn--primary" onClick={openCreate}>Yeni Uye</button>}
        />

        <AdminFilterBar>
          <AdminFilterField label="Arama">
            <input
              className="input admin-filter-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Isletme, e-posta, telefon veya paket ara"
            />
          </AdminFilterField>
          <AdminFilterField label="Durum">
            <select className="input admin-filter-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tumu</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
          </AdminFilterField>
          <AdminFilterField label="Paket Durumu">
            <select className="input admin-filter-input" value={planStatusFilter} onChange={(event) => setPlanStatusFilter(event.target.value)}>
              <option value="all">Tumu</option>
              <option value="trial">Trial aktif</option>
              <option value="active">Aktif paket</option>
              <option value="expired">Suresi doldu</option>
              <option value="inactive">Plan atanmamis</option>
            </select>
          </AdminFilterField>
        </AdminFilterBar>

        {error ? <div style={{ color: '#dc2626', fontWeight: 700 }}>{error}</div> : null}

        <AdminTableCard>
          {loading ? (
            <div style={{ padding: 22, fontWeight: 700, color: '#64748b' }}>Yukleniyor...</div>
          ) : filteredItems.length === 0 ? (
            <AdminEmptyState title="Gosterilecek uye bulunamadi" description="Filtreleri temizleyin veya yeni bir uye olusturun." />
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <colgroup>
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: 140 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Isletme</th>
                    <th>E-posta</th>
                    <th>Telefon</th>
                    <th>Durum</th>
                    <th>Paket</th>
                    <th>Paket Durumu</th>
                    <th>Bitis</th>
                    <th>Kalan Sure</th>
                    <th className="admin-actions-cell">Islemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((tenant) => {
                    const tenantMeta = getTenantStateMeta(tenant)
                    const planMeta = formatPlanBadge(tenant)
                    const remainingMeta = getRemainingPlanMeta(tenant)
                    const planName = getPlanDisplayName(tenant)
                    return (
                      <tr key={tenant._id} className="admin-table-row">
                        <td title={tenant.name || ''}>
                          <span className="admin-cell-ellipsis">{tenant.name || 'Isimsiz isletme'}</span>
                        </td>
                        <td title={tenant.ownerEmail || ''}>
                          <span className="admin-cell-ellipsis admin-cell-secondary">{tenant.ownerEmail || 'E-posta yok'}</span>
                        </td>
                        <td title={tenant.ownerPhone || tenant.phone || ''}>
                          <span className="admin-cell-ellipsis">{tenant.ownerPhone || tenant.phone || 'Telefon yok'}</span>
                        </td>
                        <td>
                          <AdminStatusBadge tone={tenantMeta.tone}>{tenantMeta.label}</AdminStatusBadge>
                        </td>
                        <td title={planName}>
                          <span className="admin-cell-ellipsis">{planName || 'Plan bilgisi bulunamadi'}</span>
                        </td>
                        <td>
                          <AdminStatusBadge tone={planMeta.tone}>{planMeta.label}</AdminStatusBadge>
                        </td>
                        <td>
                          <span className="admin-cell-ellipsis">{formatPlanDate(tenant.planEndsAt) || '-'}</span>
                        </td>
                        <td>
                          <AdminStatusBadge tone={remainingMeta.tone}>{remainingMeta.label}</AdminStatusBadge>
                        </td>
                        <td className="admin-actions-cell">
                          <AdminActionMenu
                            items={[
                              { label: 'Detay', onClick: () => openDetail(tenant) },
                              { label: 'Duzenle', onClick: () => openEdit(tenant) },
                              { label: planName ? 'Plan Degistir' : 'Plan Ata', onClick: () => openAssign(tenant) },
                              { label: 'Deneme Uzat', onClick: () => openExtend(tenant) },
                              { label: 'Denemeyi Bitir', onClick: () => endTrial(tenant) },
                              { label: tenant.isActive ? 'Pasiflestir' : 'Aktiflestir', onClick: () => toggleActive(tenant) },
                              { label: 'Sil', onClick: () => openDelete(tenant), danger: true },
                            ]}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AdminTableCard>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Yeni Uye">
        <form onSubmit={onCreate} style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Isletme Adi</div>
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sahip Adi</div>
            <input className="input" value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sahip E-posta</div>
            <input className="input" value={form.ownerEmail} onChange={(event) => setForm({ ...form, ownerEmail: event.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Telefon</div>
            <input className="input" value={form.ownerPhone} onChange={(event) => setForm({ ...form, ownerPhone: event.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sifre</div>
            <input type="password" className="input" value={form.ownerPassword} onChange={(event) => setForm({ ...form, ownerPassword: event.target.value })} />
          </label>
          {formError ? <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div> : null}
          <button className="btn btn--primary" disabled={formLoading}>{formLoading ? 'Gonderiliyor...' : 'Uye Olustur'}</button>
        </form>
      </Modal>

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title={`Plan Atama${assignTarget ? ` • ${assignTarget.name}` : ''}`}>
        <form onSubmit={onAssign} style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Plan</div>
            <select className="input" value={assignForm.planId} onChange={(event) => setAssignForm({ ...assignForm, planId: event.target.value })} disabled={assignPlansLoading}>
              <option value="">Seciniz</option>
              {plans.map((plan) => <option key={plan._id || plan.id} value={plan._id || plan.id}>{plan.name}</option>)}
            </select>
          </label>
          {assignPlansLoading ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>Uygun planlar yukleniyor...</div> : null}
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Baslangic Tarihi</div>
            <input type="date" className="input" value={assignForm.startsAt} onChange={(event) => setAssignForm({ ...assignForm, startsAt: event.target.value })} />
          </label>
          {assignError ? <div style={{ color: '#ef4444', fontSize: 13 }}>{assignError}</div> : null}
          <button className="btn btn--primary" disabled={assignLoading || !assignForm.planId}>{assignLoading ? 'Gonderiliyor...' : 'Ata'}</button>
        </form>
      </Modal>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`Uye Detayi${detailTarget ? ` • ${detailTarget.name}` : ''}`}>
        {detailTarget ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="card" style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontWeight: 800 }}>{detailTarget.name}</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div><strong>Paket adi:</strong> {getPlanDisplayName(detailTarget) || 'Plan bilgisi bulunamadi'}</div>
                <div><strong>Paket baslangic tarihi:</strong> {formatPlanDate(detailTarget.planStartedAt) || '-'}</div>
                <div><strong>Paket bitis tarihi:</strong> {formatPlanDate(detailTarget.planEndsAt) || '-'}</div>
                <div><strong>Kalan sure:</strong> {getRemainingPlanMeta(detailTarget).label}</div>
                <div><strong>Paket durumu:</strong> {formatPlanBadge(detailTarget).label}</div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Uye Duzenle${editTarget ? ` • ${editTarget.name}` : ''}`}>
        <form onSubmit={onEdit} style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Isletme Adi</div>
            <input className="input" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta</div>
            <input className="input" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Telefon</div>
            <input className="input" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} />
          </label>
          {editError ? <div style={{ color: '#ef4444', fontSize: 13 }}>{editError}</div> : null}
          <button className="btn btn--primary" disabled={editLoading}>{editLoading ? 'Gonderiliyor...' : 'Kaydet'}</button>
        </form>
      </Modal>

      <Modal open={extendOpen} onClose={() => setExtendOpen(false)} title={`Deneme Uzat${assignTarget ? ` • ${assignTarget.name}` : ''}`}>
        <form onSubmit={onExtend} style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Gun</div>
            <input type="number" className="input" value={extendForm.days} onChange={(event) => setExtendForm({ days: Number(event.target.value || 0) })} />
          </label>
          {extendError ? <div style={{ color: '#ef4444', fontSize: 13 }}>{extendError}</div> : null}
          <button className="btn btn--primary" disabled={formLoading || !extendForm.days}>{formLoading ? 'Gonderiliyor...' : 'Uzat'}</button>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Uye Sil"
        description="Bu islem geri alinamaz. Uye ve tum verileri kalici olarak silinecek. Emin misiniz?"
        confirmText="Evet, Sil"
        cancelText="Vazgec"
        danger={true}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
