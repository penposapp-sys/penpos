import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
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
  formatAdminDate,
} from '../components/AdminListUi.jsx'

function getPlanMeta(tenant) {
  const status = String(tenant?.plan?.status || '').trim().toLowerCase()
  if (status === 'expired') return { key: 'expired', label: 'Süresi doldu', tone: 'danger' }
  if (status === 'trial') return { key: 'trial', label: 'Trial aktif', tone: 'info' }
  if (status === 'active') return { key: 'active', label: 'Aktif paket', tone: 'success' }
  return { key: 'inactive', label: 'Pasif', tone: 'neutral' }
}

export default function SuperadminTenants() {
  const [tenants, setTenants] = useState([])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' })
  const [adminError, setAdminError] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)
  const [trialOpen, setTrialOpen] = useState(false)
  const [trialDays, setTrialDays] = useState(7)
  const [trialError, setTrialError] = useState('')
  const [trialLoading, setTrialLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { tenants } = await api('/api/superadmin/tenants')
      setTenants(Array.isArray(tenants) ? tenants : [])
    } catch (err) {
      setError(err.message)
      setTenants([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onCreateTenant = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { tenant } = await api('/api/superadmin/tenants', {
        method: 'POST',
        body: JSON.stringify({ name, slug }),
      })
      setName('')
      setSlug('')
      setCreateOpen(false)
      setTenants((prev) => [tenant, ...prev])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openAdminModal = (tenant) => {
    setSelectedTenant(tenant)
    setAdminForm({ name: '', email: '', password: '' })
    setAdminError('')
    setModalOpen(true)
  }

  const openEditModal = (tenant) => {
    setSelectedTenant(tenant)
    setEditForm({ name: tenant.name })
    setEditError('')
    setEditOpen(true)
  }

  const onCreateAdmin = async (event) => {
    event.preventDefault()
    setAdminLoading(true)
    setAdminError('')
    try {
      await api(`/api/superadmin/tenants/${selectedTenant.id}/admin`, {
        method: 'POST',
        body: JSON.stringify(adminForm),
      })
      setModalOpen(false)
    } catch (err) {
      setAdminError(err.message)
    } finally {
      setAdminLoading(false)
    }
  }

  const submitEditTenant = async (event) => {
    event.preventDefault()
    setEditLoading(true)
    setEditError('')
    try {
      const { tenant } = await api(`/api/superadmin/tenants/${selectedTenant.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editForm.name }),
      })
      setTenants((prev) => prev.map((item) => item.id === selectedTenant.id ? { ...item, name: tenant.name } : item))
      setEditOpen(false)
    } catch (err) {
      setEditError(err.message)
    } finally {
      setEditLoading(false)
    }
  }

  const openTrialExtend = (tenant) => {
    setSelectedTenant(tenant)
    setTrialDays(7)
    setTrialError('')
    setTrialOpen(true)
  }

  const submitTrialExtend = async (event) => {
    event.preventDefault()
    setTrialLoading(true)
    setTrialError('')
    try {
      const result = await api(`/api/superadmin/tenants/${selectedTenant.id}/trial-extend`, {
        method: 'PUT',
        body: JSON.stringify({ days: trialDays }),
      })
      setTenants((prev) => prev.map((item) => item.id === selectedTenant.id ? { ...item, plan: result.plan } : item))
      setTrialOpen(false)
    } catch (err) {
      setTrialError(err.message)
    } finally {
      setTrialLoading(false)
    }
  }

  const endTrial = async (tenant) => {
    setLoading(true)
    setError('')
    try {
      const result = await api(`/api/superadmin/tenants/${tenant.id}/trial-end`, { method: 'PUT' })
      setTenants((prev) => prev.map((item) => item.id === tenant.id ? { ...item, plan: result.plan } : item))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openDelete = (tenant) => {
    setDeleteTarget(tenant)
    setDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setLoading(true)
    setError('')
    try {
      await api(`/api/superadmin/tenants/${deleteTarget.id}`, { method: 'DELETE' })
      await load()
      setDeleteOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredTenants = tenants.filter((tenant) => {
    const query = search.trim().toLocaleLowerCase('tr-TR')
    const matchesSearch = !query || [
      tenant.name,
      tenant.slug,
      tenant.plan?.name,
    ].some((value) => String(value || '').toLocaleLowerCase('tr-TR').includes(query))

    const isActive = tenant.isActive && tenant.status === 'active'
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'active' && isActive)
      || (statusFilter === 'inactive' && !isActive)

    const planMeta = getPlanMeta(tenant)
    const matchesPlan = planFilter === 'all' || planFilter === planMeta.key

    return matchesSearch && matchesStatus && matchesPlan
  })

  return (
    <div className="main">
      <div className="admin-page">
        <AdminPageHeader
          title="Tenant Listesi"
          subtitle="Süper admin tenant yönetimini yeni kompakt tablo düzeninde yönetin."
          action={<button className="btn btn--primary" onClick={() => setCreateOpen(true)}>Yeni Üye</button>}
        />

        <AdminFilterBar>
          <AdminFilterField label="Arama">
            <input
              className="input admin-filter-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="İşletme, kod veya plan ara"
            />
          </AdminFilterField>
          <AdminFilterField label="Durum">
            <select className="input admin-filter-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tümü</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
          </AdminFilterField>
          <AdminFilterField label="Plan Durumu">
            <select className="input admin-filter-input" value={planFilter} onChange={(event) => setPlanFilter(event.target.value)}>
              <option value="all">Tümü</option>
              <option value="trial">Trial aktif</option>
              <option value="active">Aktif paket</option>
              <option value="expired">Süresi doldu</option>
              <option value="inactive">Pasif</option>
            </select>
          </AdminFilterField>
        </AdminFilterBar>

        {error ? <div style={{ color: '#dc2626', fontWeight: 700 }}>{error}</div> : null}

        <AdminTableCard>
          {loading ? (
            <div style={{ padding: 22, fontWeight: 700, color: '#64748b' }}>Yükleniyor...</div>
          ) : filteredTenants.length === 0 ? (
            <AdminEmptyState title="Gösterilecek tenant bulunamadı" description="Filtreleri temizleyin veya yeni bir üye oluşturun." />
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <colgroup>
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: 140 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>İşletme</th>
                    <th>Kod</th>
                    <th>Durum</th>
                    <th>Plan</th>
                    <th>Plan Durumu</th>
                    <th>Bitiş</th>
                    <th>Oluşturulma</th>
                    <th className="admin-actions-cell">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((tenant) => {
                    const isActive = tenant.isActive && tenant.status === 'active'
                    const planMeta = getPlanMeta(tenant)
                    const endsAt = tenant.plan?.endsAt ? formatAdminDate(tenant.plan.endsAt) : ''
                    return (
                      <tr key={tenant.id} className="admin-table-row">
                        <td title={tenant.name || ''}><span className="admin-cell-ellipsis">{tenant.name}</span></td>
                        <td title={tenant.slug || ''}><span className="admin-cell-ellipsis admin-cell-secondary">{tenant.slug || 'Kod yok'}</span></td>
                        <td>
                          <AdminStatusBadge tone={isActive ? 'success' : 'neutral'}>
                            {isActive ? 'Aktif' : 'Pasif'}
                          </AdminStatusBadge>
                        </td>
                        <td title={tenant.plan?.name || ''}><span className="admin-cell-ellipsis">{tenant.plan?.name || 'Plan yok'}</span></td>
                        <td><AdminStatusBadge tone={planMeta.tone}>{planMeta.label}</AdminStatusBadge></td>
                        <td>
                          {endsAt
                            ? <span className="admin-cell-ellipsis">{endsAt}</span>
                            : <AdminStatusBadge tone={planMeta.tone}>{planMeta.label}</AdminStatusBadge>}
                        </td>
                        <td><span className="admin-cell-ellipsis">{tenant.createdAt ? formatAdminDate(tenant.createdAt) : 'Tarih yok'}</span></td>
                        <td className="admin-actions-cell">
                          <AdminActionMenu
                            items={[
                              { label: 'Düzenle', onClick: () => openEditModal(tenant) },
                              { label: 'Yönetici Oluştur', onClick: () => openAdminModal(tenant) },
                              { label: 'Deneme Uzat', onClick: () => openTrialExtend(tenant) },
                              { label: 'Denemeyi Bitir', onClick: () => endTrial(tenant) },
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Üye Oluştur">
        <form onSubmit={onCreateTenant} style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>İşletme Adı</div>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Pendik Sofrası" />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kod</div>
            <input className="input" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="pendik-sofrasi" />
          </label>
          {error ? <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div> : null}
          <button className="btn btn--primary" disabled={loading}>{loading ? 'Gönderiliyor...' : 'Oluştur'}</button>
        </form>
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Üye Yöneticisi Oluştur">
        <form onSubmit={onCreateAdmin} style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Üye: {selectedTenant?.name}</div>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={adminForm.name} onChange={(event) => setAdminForm({ ...adminForm, name: event.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta</div>
            <input className="input" type="email" value={adminForm.email} onChange={(event) => setAdminForm({ ...adminForm, email: event.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şifre</div>
            <input className="input" type="password" value={adminForm.password} onChange={(event) => setAdminForm({ ...adminForm, password: event.target.value })} />
          </label>
          {adminError ? <div style={{ color: '#ef4444', fontSize: 13 }}>{adminError}</div> : null}
          <button className="btn btn--primary" disabled={adminLoading}>{adminLoading ? 'Gönderiliyor...' : 'Oluştur'}</button>
        </form>
      </Modal>

      <Modal open={trialOpen} onClose={() => setTrialOpen(false)} title="Deneme Süresi Uzat">
        <form onSubmit={submitTrialExtend} style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Üye: {selectedTenant?.name}</div>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Deneme Süresi (gün)</div>
            <input className="input" type="number" min="1" value={trialDays} onChange={(event) => setTrialDays(Number(event.target.value || 0))} />
          </label>
          {trialError ? <div style={{ color: '#ef4444', fontSize: 13 }}>{trialError}</div> : null}
          <button className="btn btn--primary" disabled={trialLoading}>{trialLoading ? 'Gönderiliyor...' : 'Uzat'}</button>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Üye Düzenle">
        <form onSubmit={submitEditTenant} style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>İşletme Adı</div>
            <input className="input" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
          </label>
          {editError ? <div style={{ color: '#ef4444', fontSize: 13 }}>{editError}</div> : null}
          <button className="btn btn--primary" disabled={editLoading}>{editLoading ? 'Gönderiliyor...' : 'Kaydet'}</button>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Üye Sil"
        description="Bu işlem geri alınamaz. Tenant kalıcı olarak silinecek. Emin misiniz?"
        confirmText="Evet, Sil"
        cancelText="Vazgeç"
        danger={true}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
