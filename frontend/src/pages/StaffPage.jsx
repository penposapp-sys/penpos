import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient.js'
import Modal from '../components/Modal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getSubscriptionStatus } from '../lib/subscription.js'
import { PERMISSIONS, PERMISSION_GROUPS_TR, canonicalizePermissions, normalizePermissions } from '../constants/permissions.js'
import { SettingsCard, SettingsField, SettingsToggle, SettingsUiStyles } from '../components/settings/SettingsUi.jsx'
import BranchAccessField from '../components/settings/BranchAccessField.jsx'
import { formatBranchSummary, normalizeBranchIdList } from '../lib/branchVisibility.js'

const isVisibleItem = (item) => item?.isDeleted !== true && item?.status !== 'deleted'

const createAccessState = (branchIds = []) => {
  const normalized = normalizeBranchIdList(branchIds)
  return {
    allBranches: normalized.length === 0,
    branchIds: normalized
  }
}

const toAccessibleBranchIds = (access) => (access?.allBranches ? [] : normalizeBranchIdList(access?.branchIds))

const STAFF_PERMISSION_PRESETS = [
  {
    id: 'waiter',
    label: 'Garson',
    description: 'Masalar, siparis acma ve servis akisi.',
    permissions: [
      PERMISSIONS.POS_ACCESS,
      PERMISSIONS.MANAGE_TABLES
    ]
  },
  {
    id: 'cashier',
    label: 'Kasa',
    description: 'Ayarlar haric restoran tarafindaki tum yetkiler.',
    permissions: [
      PERMISSIONS.REPORTS_DASHBOARD_VIEW,
      PERMISSIONS.CLOSED_TABLES_PAGE_VIEW,
      PERMISSIONS.CLOSED_TABLES_VIEW,
      PERMISSIONS.CLOSED_TABLES_DETAIL_VIEW,
      PERMISSIONS.CLOSED_TABLES_REOPEN,
      PERMISSIONS.POS_ACCESS,
      PERMISSIONS.TAKE_PAYMENT,
      PERMISSIONS.CREATE_VERESIYE,
      PERMISSIONS.KITCHEN_ACCESS,
      PERMISSIONS.MANAGE_TABLES,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.VIEW_CLOSED_TABLES,
      PERMISSIONS.VIEW_ACCOUNTS,
      PERMISSIONS.MANAGE_ACCOUNTS,
      PERMISSIONS.COLLECT_DEBT
      ,
      PERMISSIONS.CARI_TAHSILAT_SIL,
      PERMISSIONS.VIEW_DELIVERY,
      PERMISSIONS.MANAGE_DELIVERY,
      PERMISSIONS.PACKAGE_COURIER_PAGE_VIEW,
      PERMISSIONS.PACKAGE_ORDERS_VIEW,
      PERMISSIONS.PACKAGE_ASSIGN_COURIER,
      PERMISSIONS.PACKAGE_STATUS_UPDATE,
      PERMISSIONS.PACKAGE_PAYMENT_STATUS_UPDATE,
      PERMISSIONS.PACKAGE_CANCEL,
      PERMISSIONS.COURIER_REPORTS_VIEW,
      PERMISSIONS.CUSTOMER_PHONE_VIEW,
      PERMISSIONS.CUSTOMER_ADDRESS_VIEW,
      PERMISSIONS.CUSTOMER_LOCATION_OPEN,
      PERMISSIONS.WALKIN_ACCESS,
      PERMISSIONS.MANAGE_MENU
    ]
  },
  {
    id: 'courier',
    label: 'Kurye',
    description: 'Kurye ekrani, teslimat durumu ve musteri iletisim bilgileri.',
    permissions: [
      PERMISSIONS.TAKE_PAYMENT,
      PERMISSIONS.CREATE_VERESIYE,
      PERMISSIONS.VIEW_DELIVERY,
      PERMISSIONS.MANAGE_DELIVERY,
      PERMISSIONS.PACKAGE_COURIER_PAGE_VIEW,
      PERMISSIONS.PACKAGE_ORDERS_VIEW,
      PERMISSIONS.PACKAGE_STATUS_UPDATE,
      PERMISSIONS.PACKAGE_PAYMENT_STATUS_UPDATE,
      PERMISSIONS.PACKAGE_CANCEL,
      PERMISSIONS.CUSTOMER_PHONE_VIEW,
      PERMISSIONS.CUSTOMER_ADDRESS_VIEW,
      PERMISSIONS.CUSTOMER_LOCATION_OPEN
    ]
  },
  {
    id: 'package',
    label: 'Paket',
    description: 'Paket siparis onaylama, atama ve takip akisi.',
    permissions: [
      PERMISSIONS.POS_ACCESS,
      PERMISSIONS.VIEW_DELIVERY,
      PERMISSIONS.MANAGE_DELIVERY,
      PERMISSIONS.PACKAGE_COURIER_PAGE_VIEW,
      PERMISSIONS.PACKAGE_ORDERS_VIEW,
      PERMISSIONS.PACKAGE_ASSIGN_COURIER,
      PERMISSIONS.PACKAGE_STATUS_UPDATE,
      PERMISSIONS.PACKAGE_PAYMENT_STATUS_UPDATE,
      PERMISSIONS.PACKAGE_CANCEL,
      PERMISSIONS.CUSTOMER_PHONE_VIEW,
      PERMISSIONS.CUSTOMER_ADDRESS_VIEW,
      PERMISSIONS.CUSTOMER_LOCATION_OPEN
    ]
  },
  {
    id: 'kitchen',
    label: 'Mutfak',
    description: 'Mutfak ekranina giris ve urun durum yonetimi.',
    permissions: [
      PERMISSIONS.KITCHEN_ACCESS
    ]
  }
]

export default function StaffPage({ systemType }) {
  const { tenantCtx, user, refresh } = useAuth()
  const [items, setItems] = useState([])
  const [branches, setBranches] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [createForm, setCreateForm] = useState({ name: '', username: '', email: '', password: '', permissions: [], systemType, branchAccess: createAccessState([]) })
  const [editForm, setEditForm] = useState({ name: '', username: '', email: '', isActive: true, permissions: [], systemType, branchAccess: createAccessState([]) })
  const [pwdForm, setPwdForm] = useState({ password: '' })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const branchNameById = useMemo(
    () => Object.fromEntries((branches || []).map((branch) => [String(branch?._id || branch?.id || ''), branch?.name || '-'])),
    [branches]
  )

  const togglePermission = (currentList, permission, checked) => {
    const next = new Set(Array.isArray(currentList) ? currentList : [])
    if (checked) next.add(permission)
    else next.delete(permission)
    return Array.from(next)
  }

  const renderPermissionsEditor = (value, onChange) => {
    const selectedPermissions = new Set(Array.isArray(value) ? value : [])
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>Yetki kisa yollari</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
            {STAFF_PERMISSION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="settings-ui-btn"
                title={preset.description}
                onClick={() => onChange(canonicalizePermissions(preset.permissions))}
              >
                {preset.label}
              </button>
            ))}
            <button type="button" className="settings-ui-btn" onClick={() => onChange([])}>
              Temizle
            </button>
          </div>
        </div>
        {(PERMISSION_GROUPS_TR || []).map((group) => (
          <SettingsCard key={group.title} title={group.title} description="Rol bazli erisim davranisini bu gruptan yonetin." icon="Q" style={{ padding: 16 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              {(group.items || []).map((item) => (
                <SettingsToggle
                  key={item.permission}
                  label={item.label}
                  description={item.description}
                  checked={selectedPermissions.has(item.permission)}
                  onChange={(event) => onChange(togglePermission(value, item.permission, event.target.checked))}
                />
              ))}
            </div>
          </SettingsCard>
        ))}
      </div>
    )
  }

  const loadBranches = async () => {
    const response = await api('/api/branches', { silent: true, skipBranchHeader: true })
    const nextBranches = Array.isArray(response?.branches) ? response.branches : []
    setBranches(nextBranches.filter((branch) => branch?.isActive !== false && isVisibleItem(branch)))
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [staffRes] = await Promise.all([
        api('/api/tenant/staff', { silent: true, skipBranchHeader: true }),
        loadBranches()
      ])
      if (staffRes?.success === false) {
        setItems([])
        return
      }
      const list = Array.isArray(staffRes.staff) ? staffRes.staff : []
      const visible = list.filter(isVisibleItem)
      setItems(systemType ? visible.filter((staff) => staff.systemType === systemType) : visible)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setCreateForm({ name: '', username: '', email: '', password: '', permissions: [], systemType, branchAccess: createAccessState([]) })
    setFormError('')
    setCreateOpen(true)
  }

  const onCreate = async (event) => {
    event.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const payload = {
        ...createForm,
        systemType,
        permissions: canonicalizePermissions(createForm.permissions || []),
        accessibleBranchIds: toAccessibleBranchIds(createForm.branchAccess)
      }
      const res = await api('/api/tenant/staff', { method: 'POST', body: JSON.stringify(payload), silent: true, skipBranchHeader: true })
      if (res?.success === false) {
        setFormError(res.message || 'Bu islem icin yetkiniz yok')
        return
      }
      setItems((prev) => [res.staff, ...prev].filter(isVisibleItem))
      setCreateOpen(false)
      await refresh()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openEdit = (staff) => {
    setSelected(staff)
    setEditForm({
      name: staff.name,
      username: staff.username || '',
      email: staff.email,
      isActive: staff.isActive !== false,
      permissions: canonicalizePermissions(normalizePermissions(staff.permissions || [])),
      systemType: staff.systemType || systemType,
      branchAccess: createAccessState(staff.accessibleBranchIds || staff.branchIds || [])
    })
    setFormError('')
    setEditOpen(true)
  }

  const onEdit = async (event) => {
    event.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const payload = {
        ...editForm,
        systemType,
        permissions: canonicalizePermissions(editForm.permissions || []),
        accessibleBranchIds: toAccessibleBranchIds(editForm.branchAccess)
      }
      const res = await api(`/api/tenant/staff/${selected.id}`, { method: 'PUT', body: JSON.stringify(payload), silent: true, skipBranchHeader: true })
      if (res?.success === false) {
        setFormError(res.message || 'Bu islem icin yetkiniz yok')
        return
      }
      setItems((prev) => prev.map((item) => (item.id === res.staff.id ? res.staff : item)).filter(isVisibleItem))
      setEditOpen(false)
      if (String(selected?.id) === String(user?.id)) {
        try { await refresh() } catch {}
      }
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openPwd = (staff) => {
    setSelected(staff)
    setPwdForm({ password: '' })
    setFormError('')
    setPwdOpen(true)
  }

  const onPwd = async (event) => {
    event.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const res = await api(`/api/tenant/staff/${selected.id}/password`, { method: 'PUT', body: JSON.stringify(pwdForm), silent: true, skipBranchHeader: true })
      if (res?.success === false) {
        setFormError(res.message || 'Bu islem icin yetkiniz yok')
        return
      }
      setPwdOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openDeleteConfirm = (staff) => {
    setDeleteTarget(staff)
  }

  const onDelete = async () => {
    const staff = deleteTarget
    if (!staff) return
    setDeleteLoading(true)
    try {
      const result = await api(`/api/tenant/staff/${staff.id}`, { method: 'DELETE', silent: true, skipBranchHeader: true })
      if (result?.success === false) {
        setError(result.message || 'Bu islem icin yetkiniz yok')
        return
      }
      setItems((prev) => prev.filter((item) => item.id !== staff.id))
      setDeleteTarget(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  const branchSummary = (staff) => formatBranchSummary(staff?.accessibleBranchIds || staff?.branchIds, branchNameById)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <SettingsUiStyles />

      <div className="settings-ui-toolbar">
        <div>
          <h3 style={{ margin: 0 }}>Personel</h3>
          <div style={{ marginTop: 6, fontSize: 13, color: '#64748b' }}>Personel erisim, giris ve sube gorunurlugunu bu panelden yonetin.</div>
        </div>
        <button
          className="settings-ui-btn"
          onClick={openCreate}
          disabled={getSubscriptionStatus(tenantCtx) === 'expired'}
          title={getSubscriptionStatus(tenantCtx) === 'expired' ? 'Paket sureniz doldu. Plan yukselin.' : undefined}
        >
          Yeni Personel
        </button>
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}

      {loading ? 'Yukleniyor...' : items.length === 0 ? (
        <div className="settings-ui-table-shell" style={{ padding: 18 }}>Henuz personel yok. Baslamak icin "Yeni Personel" ekleyin.</div>
      ) : (
        <>
          <div className="desktop-only settings-ui-table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Kullanici Adi</th>
                  <th>E-posta</th>
                  <th>Durum</th>
                  <th>Subeler</th>
                  <th>Izinler</th>
                  <th className="actions" style={{ width: 320 }}>Aksiyonlar</th>
                </tr>
              </thead>
              <tbody>
                {items.map((staff) => {
                  const permCount = (staff.permissions || []).length
                  return (
                    <tr key={staff.id}>
                      <td>{staff.name}</td>
                      <td>{staff.username || '-'}</td>
                      <td>{staff.email}</td>
                      <td>{staff.isActive ? 'Aktif' : 'Pasif'}</td>
                      <td style={{ minWidth: 220 }}>{branchSummary(staff)}</td>
                      <td>{permCount > 0 ? `${permCount} izin` : '-'}</td>
                      <td className="actions">
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="settings-ui-btn" type="button" onClick={() => openEdit(staff)}>Duzenle</button>
                          <button className="settings-ui-btn" type="button" onClick={() => openPwd(staff)}>Sifre Sifirla</button>
                          <button className="settings-ui-btn-danger" type="button" onClick={() => openDeleteConfirm(staff)}>Sil</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mobile-only settings-mobile">
            {items.map((staff) => (
              <div key={staff.id} className="settings-ui-table-shell" style={{ padding: 16, marginBottom: 12 }}>
                <div style={{ fontWeight: 900, color: '#0f172a' }}>{staff.name}</div>
                <div style={{ marginTop: 8, display: 'grid', gap: 4, color: '#64748b', fontSize: 13 }}>
                  <span>Kullanici adi: {staff.username || '-'}</span>
                  <span>E-posta: {staff.email}</span>
                  <span>Durum: {staff.isActive ? 'Aktif' : 'Pasif'}</span>
                  <span>Subeler: {branchSummary(staff)}</span>
                  <span>Izin: {(staff.permissions || []).length}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <button className="settings-ui-btn" type="button" onClick={() => openEdit(staff)}>Duzenle</button>
                  <button className="settings-ui-btn" type="button" onClick={() => openPwd(staff)}>Sifre Sifirla</button>
                  <button className="settings-ui-btn-danger" type="button" onClick={() => openDeleteConfirm(staff)}>Sil</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Yeni Personel"
        headerActions={(
          <button
            className="settings-ui-submit"
            type="submit"
            form="staff-create-form"
            disabled={formLoading}
            style={{ minHeight: 42, padding: '8px 16px', borderRadius: 14, boxShadow: 'var(--theme-active-glow)' }}
          >
            {formLoading ? 'Gonderiliyor...' : 'Olustur'}
          </button>
        )}
      >
        <form id="staff-create-form" onSubmit={onCreate} style={{ display: 'grid', gap: 12 }}>
          <SettingsField label="Ad">
            <input className="settings-ui-input" value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} />
          </SettingsField>
          <SettingsField label="Kullanici Adi">
            <input className="settings-ui-input" value={createForm.username} onChange={(event) => setCreateForm({ ...createForm, username: event.target.value })} placeholder="ornek: garson1" />
          </SettingsField>
          <SettingsField label="E-posta">
            <input className="settings-ui-input" type="email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} />
          </SettingsField>
          <SettingsField label="Sifre">
            <input className="settings-ui-input" type="password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} />
          </SettingsField>
          <BranchAccessField
            label="Gorebilecegi Subeler"
            hint="Sube secmezseniz personel tum subeleri gorebilir. Belirli subeleri secerseniz sadece onlar gorunur."
            branches={branches}
            value={createForm.branchAccess}
            onChange={(branchAccess) => setCreateForm({ ...createForm, branchAccess })}
            allLabel="Tum Subeleri Gorebilir"
          />
          <div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Izinler</div>
            {renderPermissionsEditor(createForm.permissions, (permissions) => setCreateForm({ ...createForm, permissions }))}
          </div>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
        </form>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Personel Duzenle"
        headerActions={(
          <button
            className="settings-ui-submit"
            type="submit"
            form="staff-edit-form"
            disabled={formLoading}
            style={{ minHeight: 42, padding: '8px 16px', borderRadius: 14, boxShadow: 'var(--theme-active-glow)' }}
          >
            {formLoading ? 'Gonderiliyor...' : 'Kaydet'}
          </button>
        )}
      >
        <form id="staff-edit-form" onSubmit={onEdit} style={{ display: 'grid', gap: 12 }}>
          <SettingsField label="Ad">
            <input className="settings-ui-input" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
          </SettingsField>
          <SettingsField label="Kullanici Adi">
            <input className="settings-ui-input" value={editForm.username} onChange={(event) => setEditForm({ ...editForm, username: event.target.value })} placeholder="ornek: garson1" />
          </SettingsField>
          <SettingsField label="E-posta">
            <input className="settings-ui-input" type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} />
          </SettingsField>
          <BranchAccessField
            label="Gorebilecegi Subeler"
            hint="Sube dropdownlarinda bu personele izin verilen subeler gosterilir."
            branches={branches}
            value={editForm.branchAccess}
            onChange={(branchAccess) => setEditForm({ ...editForm, branchAccess })}
            allLabel="Tum Subeleri Gorebilir"
          />
          <SettingsToggle label="Aktif" checked={!!editForm.isActive} onChange={(event) => setEditForm({ ...editForm, isActive: event.target.checked })} />
          <div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Izinler</div>
            {renderPermissionsEditor(editForm.permissions, (permissions) => setEditForm({ ...editForm, permissions }))}
          </div>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
        </form>
      </Modal>

      <Modal open={pwdOpen} onClose={() => setPwdOpen(false)} title="Sifre Sifirla">
        <form onSubmit={onPwd} style={{ display: 'grid', gap: 12 }}>
          <SettingsField label="Yeni Sifre">
            <input className="settings-ui-input" type="password" value={pwdForm.password} onChange={(event) => setPwdForm({ password: event.target.value })} />
          </SettingsField>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="settings-ui-submit" disabled={formLoading}>{formLoading ? 'Gonderiliyor...' : 'Guncelle'}</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Personeli Listeden Kaldir"
        message="Bu personel aktif listeden kaldirilacak. Gecmis satis ve raporlardaki adi korunur. Devam etmek istiyor musunuz?"
        confirmText="Personeli Sil"
        loading={deleteLoading}
        onConfirm={onDelete}
        onClose={() => {
          if (deleteLoading) return
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
