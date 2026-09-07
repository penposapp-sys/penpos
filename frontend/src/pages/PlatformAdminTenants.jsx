import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const isValidObjectId = (v) => {
    const s = String(v || '').trim()
    if (s.length !== 24) return false
    return /^[0-9a-fA-F]{24}$/.test(s)
  }
  const anaokuluItems = (Array.isArray(items) ? items : []).filter((t) => {
    const idOk = isValidObjectId(t?._id || t?.id)
    if (!idOk) return false
    const tt = String(t?.systemType || t?.vertical || t?.businessType || t?.packageType || t?.pkg || '').trim().toLowerCase()
    const typeOk = tt === 'anaokulu' || tt.startsWith('anaokul') || tt.startsWith('kres') || tt.startsWith('kreş')
    if (!typeOk) return false
    const nm = String(t?.name || '').trim()
    if (nm.length < 2) return false
    return true
  })
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
  const [raListOpen, setRaListOpen] = useState(false)
  const [raItems, setRaItems] = useState([])
  const [raListLoading, setRaListLoading] = useState(false)
  const [raCreateOpen, setRaCreateOpen] = useState(false)
  const [raEditOpen, setRaEditOpen] = useState(false)
  const [raTarget, setRaTarget] = useState(null)
  const [raForm, setRaForm] = useState({ name: '', email: '', phone: '', password: '', accessibleTenantIds: [] })
  const [raError, setRaError] = useState('')
  const [raFormLoading, setRaFormLoading] = useState(false)
  const [raPassOpen, setRaPassOpen] = useState(false)
  const [raPassTarget, setRaPassTarget] = useState(null)
  const [raPassForm, setRaPassForm] = useState({ password: '' })
  const [raPassError, setRaPassError] = useState('')
  const [raPassLoading, setRaPassLoading] = useState(false)
  const [raDelOpen, setRaDelOpen] = useState(false)
  const [raDelTarget, setRaDelTarget] = useState(null)
  const [raSearch, setRaSearch] = useState('')

  const pagePlanType =
    system === 'canteen' ? 'canteen' :
    (system === 'anaokulu' ? 'anaokulu' : 'restaurant')
  const pageTitle =
    pagePlanType === 'canteen' ? 'Mağaza Üyeleri' :
    (pagePlanType === 'anaokulu' ? 'Anaokulu Üyeleri' : 'Restoran Üyeleri')
  const pageSubtitle =
    pagePlanType === 'canteen' ? 'Mağaza üye listesini paket süreleriyle birlikte yönetin.' :
    (pagePlanType === 'anaokulu' ? 'Anaokulu üye listesini paket süreleriyle birlikte yönetin, yönetici ve personel ekleyin.' :
    'Restoran üye listesini paket süreleriyle birlikte yönetin.')

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
      const required = [
        { key: 'name', label: 'Isletme Adi' },
        { key: 'ownerName', label: 'Sahip Adi' },
        { key: 'ownerEmail', label: 'Sahip E-posta' },
        { key: 'ownerPhone', label: 'Telefon' },
        { key: 'ownerPassword', label: 'Sifre' }
      ]
      const missingFields = required.filter(r => !String(form?.[r.key] || '').trim())
      if (missingFields.length > 0) {
        throw new Error(`Lutfen doldurun: ${missingFields.map(x => x.label).join(', ')}`)
      }
      if (String(form?.ownerPassword || '').length < 6) {
        throw new Error('Sifre en az 6 karakter olmalidir')
      }
      const target =
        pagePlanType === 'canteen' ? '/api/platform/tenants/canteen' :
        (pagePlanType === 'anaokulu' ? '/api/platform/tenants/anaokulu' : '/api/platform/tenants/kermes')
      const res = await api(target, { method: 'POST', body: JSON.stringify({ ...form }), portalOverride: 'platform' })
      if (!res?.ok) {
        throw new Error(res?.message || 'Uye olusturulamadi')
      }
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

  const loadRaList = async () => {
    setRaListLoading(true)
    try {
      const res = await api('/api/platform/anaokulu-region-admins', { portalOverride: 'platform' })
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : []
      setRaItems(list)
    } catch (err) {
      toast.error(err.message)
      setRaItems([])
    } finally {
      setRaListLoading(false)
    }
  }

  const openRaList = async () => {
    setRaListOpen(true)
    setRaSearch('')
    await loadRaList()
  }

  const toggleRaTenant = (tenantId) => {
    const sid = String(tenantId || '').trim()
    if (!sid || sid.length < 2) return
    if (!isValidObjectId(sid)) return
    setRaForm((prev) => {
      const current = Array.isArray(prev.accessibleTenantIds) ? [...prev.accessibleTenantIds] : []
      const idx = current.findIndex((x) => String(x) === sid)
      if (idx >= 0) current.splice(idx, 1)
      else current.push(sid)
      return { ...prev, accessibleTenantIds: current }
    })
  }

  const openRaCreate = () => {
    setRaForm({ name: '', email: '', phone: '', password: '', accessibleTenantIds: [] })
    setRaError('')
    setRaCreateOpen(true)
  }

  const openRaEdit = (row) => {
    setRaTarget(row)
    setRaForm({
      name: row?.name || row?.fullName || '',
      email: row?.email || '',
      phone: row?.phone || '',
      password: '',
      accessibleTenantIds: Array.isArray(row?.accessibleTenantIds) ? row.accessibleTenantIds.map(String) : []
    })
    setRaError('')
    setRaEditOpen(true)
  }

  const openRaPass = (row) => {
    setRaPassTarget(row)
    setRaPassForm({ password: '' })
    setRaPassError('')
    setRaPassOpen(true)
  }

  const openRaDel = (row) => {
    setRaDelTarget(row)
    setRaDelOpen(true)
  }

  const onCreateRa = async (event) => {
    event.preventDefault()
    setRaFormLoading(true)
    setRaError('')
    try {
      if (!raForm.name || !raForm.email) throw new Error('Ad soyad ve e-posta zorunludur')
      if (!raForm.password || String(raForm.password).length < 6) throw new Error('Sifre en az 6 karakter olmalidir')
      if (!Array.isArray(raForm.accessibleTenantIds) || raForm.accessibleTenantIds.length === 0) {
        throw new Error('En az bir anaokulu secmelisiniz. Once Anaokulu Uyesi olusturup listeden secin')
      }
      const validIds = raForm.accessibleTenantIds.filter((x) => isValidObjectId(x))
      if (validIds.length === 0) {
        throw new Error('Secilen anaokullarindan hicbiri gecerli degil. Listeden tekrar secim yapin')
      }
      const res = await api('/api/platform/anaokulu-region-admins', {
        method: 'POST',
        data: {
          name: raForm.name,
          email: raForm.email,
          phone: raForm.phone,
          password: raForm.password,
          accessibleTenantIds: validIds
        },
        portalOverride: 'platform'
      })
      if (!res?.ok) {
        const err = new Error(res?.message || res?.error || 'Okul süper admin oluşturulamadı')
        err.code = res?.code
        throw err
      }
      setRaCreateOpen(false)
      toast.success('Okul süper admin oluşturuldu')
      await loadRaList()
    } catch (err) {
      setRaError(err.code === 'email_taken' || err.code === 'email_in_use' ? (err.message || 'Bu e-posta zaten kullanılıyor') : err.message)
    } finally {
      setRaFormLoading(false)
    }
  }

  const onEditRa = async (event) => {
    event.preventDefault()
    if (!raTarget) return
    setRaFormLoading(true)
    setRaError('')
    try {
      if (!raForm.name || !raForm.email) throw new Error('Ad soyad ve e-posta zorunludur')
      if (!Array.isArray(raForm.accessibleTenantIds) || raForm.accessibleTenantIds.length === 0) {
        throw new Error('En az bir anaokulu secmelisiniz. Once Anaokulu Uyesi olusturup listeden secin')
      }
      const validIds = raForm.accessibleTenantIds.filter((x) => isValidObjectId(x))
      if (validIds.length === 0) {
        throw new Error('Secilen anaokullarindan hicbiri gecerli degil. Listeden tekrar secim yapin')
      }
      const resEdit = await api(`/api/platform/anaokulu-region-admins/${encodeURIComponent(raTarget._id || raTarget.id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: raForm.name,
          email: raForm.email,
          phone: raForm.phone,
          accessibleTenantIds: validIds
        }),
        portalOverride: 'platform'
      })
      if (!resEdit?.ok) {
        const err = new Error(resEdit?.message || resEdit?.error || 'Okul süper admin güncellenemedi')
        err.code = resEdit?.code
        throw err
      }
      setRaEditOpen(false)
      setRaTarget(null)
      toast.success('Okul süper admin güncellendi')
      await loadRaList()
    } catch (err) {
      setRaError(err.code === 'email_taken' || err.code === 'email_in_use' ? (err.message || 'Bu e-posta zaten kullanılıyor') : err.message)
    } finally {
      setRaFormLoading(false)
    }
  }

  const onRaPassSubmit = async (event) => {
    event.preventDefault()
    if (!raPassTarget) return
    setRaPassLoading(true)
    setRaPassError('')
    try {
      if (!raPassForm.password || String(raPassForm.password).length < 6) throw new Error('Sifre en az 6 karakter olmalidir')
      const resPass = await api(`/api/platform/anaokulu-region-admins/${encodeURIComponent(raPassTarget._id || raPassTarget.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ password: raPassForm.password }),
        portalOverride: 'platform'
      })
      if (!resPass?.ok) throw new Error(resPass?.message || 'Sifre sifirlanamadi')
      setRaPassOpen(false)
      setRaPassTarget(null)
      toast.success('Sifre sifirlandi')
    } catch (err) {
      setRaPassError(err.message)
    } finally {
      setRaPassLoading(false)
    }
  }

  const confirmRaDel = async () => {
    if (!raDelTarget) return
    try {
      const resDel = await api(`/api/platform/anaokulu-region-admins/${encodeURIComponent(raDelTarget._id || raDelTarget.id)}`, {
        method: 'DELETE',
        portalOverride: 'platform'
      })
      if (!resDel?.ok) throw new Error(resDel?.message || 'Okul süper admin silinemedi')
      setRaDelOpen(false)
      setRaDelTarget(null)
      toast.success('Okul süper admin silindi')
      await loadRaList()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const raFiltered = raItems.filter((row) => {
    const q = raSearch.trim().toLocaleLowerCase('tr-TR')
    if (!q) return true
    return [row?.name, row?.email, row?.phone].some((v) =>
      String(v || '').toLocaleLowerCase('tr-TR').includes(q)
    )
  })

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
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              {system === 'anaokulu' && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => navigate('/platform/anaokulu-region-admins')}
                >
                  🏫 Okul Süper Adminleri
                </button>
              )}
              <button className="btn btn--primary" onClick={openCreate}>Yeni Uye</button>
            </div>
          }
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

      <Modal open={raListOpen} onClose={() => setRaListOpen(false)} title="🏫 Okul Süper Adminleri" wide>
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
            <input
              className="input admin-filter-input"
              value={raSearch}
              onChange={(event) => setRaSearch(event.target.value)}
              placeholder="Ad, e-posta veya telefon ara"
              style={{ maxWidth: 320 }}
            />
            <button className="btn btn--primary" onClick={openRaCreate}>➕ Okul Süper Admin Oluştur</button>
          </div>
          <AdminTableCard>
            {raListLoading ? (
              <div style={{ padding: 22, fontWeight: 700, color: '#64748b' }}>Yukleniyor...</div>
            ) : raFiltered.length === 0 ? (
              <AdminEmptyState
                title="Okul süper admin bulunamadı"
                description="Sağ üstteki buton ile ilk kaydı ekleyin."
              />
            ) : (
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <colgroup>
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '24%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: 140 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Ad Soyad</th>
                      <th>E-posta</th>
                      <th>Telefon</th>
                      <th>Anaokulu Sayisi</th>
                      <th>Durum</th>
                      <th className="admin-actions-cell">Islemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {raFiltered.map((row) => {
                      const scount = Array.isArray(row.accessibleTenantIds) ? row.accessibleTenantIds.length : 0
                      const active = row.isActive !== false
                      return (
                        <tr key={row._id || row.id} className="admin-table-row">
                          <td title={row.name || ''}>
                            <span className="admin-cell-ellipsis">{row.name || 'Isimsiz'}</span>
                          </td>
                          <td title={row.email || ''}>
                            <span className="admin-cell-ellipsis admin-cell-secondary">{row.email || '-'}</span>
                          </td>
                          <td title={row.phone || ''}>
                            <span className="admin-cell-ellipsis">{row.phone || '-'}</span>
                          </td>
                          <td>
                            <AdminStatusBadge tone={scount > 0 ? 'info' : 'neutral'}>{scount} okul</AdminStatusBadge>
                          </td>
                          <td>
                            <AdminStatusBadge tone={active ? 'success' : 'neutral'}>{active ? 'Aktif' : 'Pasif'}</AdminStatusBadge>
                          </td>
                          <td className="admin-actions-cell">
                            <AdminActionMenu
                              items={[
                                { label: 'Duzenle', onClick: () => openRaEdit(row) },
                                { label: 'Sifre Sifirla', onClick: () => openRaPass(row) },
                                { label: 'Sil', onClick: () => openRaDel(row), danger: true },
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
      </Modal>

      <Modal open={raCreateOpen} onClose={() => setRaCreateOpen(false)} title="🏫 Yeni Okul Süper Admin Oluştur">
        <form onSubmit={onCreateRa} style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad Soyad *</div>
            <input className="input" value={raForm.name} onChange={(event) => setRaForm({ ...raForm, name: event.target.value })} placeholder="Orn: Ahmet Yilmaz" />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta *</div>
            <input type="email" className="input" value={raForm.email} onChange={(event) => setRaForm({ ...raForm, email: event.target.value })} placeholder="yonetici@okul.com" />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Telefon</div>
            <input className="input" value={raForm.phone} onChange={(event) => setRaForm({ ...raForm, phone: event.target.value })} placeholder="05xx xxx xx xx" />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sifre * (min 6 karakter)</div>
            <input type="password" className="input" value={raForm.password} onChange={(event) => setRaForm({ ...raForm, password: event.target.value })} />
          </label>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Erişilebilir Anaokulları *</div>
            <div className="card" style={{ maxHeight: 240, overflowY: 'auto', display: 'grid', gap: 6, padding: 10 }}>
              {anaokuluItems.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Once en az bir anaokulu uyesi olusturun.</div>
              ) : anaokuluItems.map((t) => {
                const checked = raForm.accessibleTenantIds.includes(String(t._id || t.id))
                return (
                  <label key={t._id || t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', padding: '4px 6px', borderRadius: 8 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRaTenant(t._id || t.id)}
                    />
                    <span style={{ fontSize: 14 }}>{t.name || 'Isimsiz'}</span>
                  </label>
                )
              })}
            </div>
          </div>
          {raError ? <div style={{ color: '#ef4444', fontSize: 13 }}>{raError}</div> : null}
          <button className="btn btn--primary" disabled={raFormLoading}>{raFormLoading ? 'Gonderiliyor...' : 'Olustur'}</button>
        </form>
      </Modal>

      <Modal open={raEditOpen} onClose={() => setRaEditOpen(false)} title={`🏫 Okul Süper Admini Düzenle${raTarget ? ` • ${raTarget.name}` : ''}`}>
        <form onSubmit={onEditRa} style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad Soyad *</div>
            <input className="input" value={raForm.name} onChange={(event) => setRaForm({ ...raForm, name: event.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta *</div>
            <input type="email" className="input" value={raForm.email} onChange={(event) => setRaForm({ ...raForm, email: event.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Telefon</div>
            <input className="input" value={raForm.phone} onChange={(event) => setRaForm({ ...raForm, phone: event.target.value })} />
          </label>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Erişilebilir Anaokulları *</div>
            <div className="card" style={{ maxHeight: 240, overflowY: 'auto', display: 'grid', gap: 6, padding: 10 }}>
              {anaokuluItems.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Once en az bir anaokulu uyesi olusturun.</div>
              ) : anaokuluItems.map((t) => {
                const checked = raForm.accessibleTenantIds.includes(String(t._id || t.id))
                return (
                  <label key={t._id || t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', padding: '4px 6px', borderRadius: 8 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRaTenant(t._id || t.id)}
                    />
                    <span style={{ fontSize: 14 }}>{t.name || 'Isimsiz'}</span>
                  </label>
                )
              })}
            </div>
          </div>
          {raError ? <div style={{ color: '#ef4444', fontSize: 13 }}>{raError}</div> : null}
          <button className="btn btn--primary" disabled={raFormLoading}>{raFormLoading ? 'Gonderiliyor...' : 'Kaydet'}</button>
        </form>
      </Modal>

      <Modal open={raPassOpen} onClose={() => setRaPassOpen(false)} title={`🔑 Şifre Sıfırla${raPassTarget ? ` • ${raPassTarget.name}` : ''}`}>
        <form onSubmit={onRaPassSubmit} style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni Şifre * (min 6 karakter)</div>
            <input type="password" className="input" value={raPassForm.password} onChange={(event) => setRaPassForm({ ...raPassForm, password: event.target.value })} />
          </label>
          {raPassError ? <div style={{ color: '#ef4444', fontSize: 13 }}>{raPassError}</div> : null}
          <button className="btn btn--primary" disabled={raPassLoading}>{raPassLoading ? 'Gonderiliyor...' : 'Sifirla'}</button>
        </form>
      </Modal>

      <ConfirmModal
        open={raDelOpen}
        onClose={() => setRaDelOpen(false)}
        title="🏫 Okul Süper Admini Sil"
        description={raDelTarget ? `${raDelTarget.name || 'Bu yonetici'} icin tum girisler iptal edilecektir. Silmek istediginize emin misiniz?` : 'Bu islem geri alinamaz.'}
        confirmText="Evet, Sil"
        cancelText="Vazgec"
        danger={true}
        onConfirm={confirmRaDel}
      />
    </div>
  )
}
