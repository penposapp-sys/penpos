import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/apiClient.js'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { getSubscriptionStatus } from '../../lib/subscription.js'
import { PERMISSIONS, canonicalizePermissions, normalizePermissions } from '../../constants/permissions.js'
import { SettingsCard, SettingsField, SettingsToggle, SettingsUiStyles } from '../../components/settings/SettingsUi.jsx'
import BranchAccessField from '../../components/settings/BranchAccessField.jsx'
import { formatBranchSummary, normalizeBranchIdList } from '../../lib/branchVisibility.js'
import CanteenSettingsSection from '../components/CanteenSettingsSection.jsx'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'

const createAccessState = (branchIds = []) => {
  const normalized = normalizeBranchIdList(branchIds)
  return {
    allBranches: normalized.length === 0,
    branchIds: normalized
  }
}

const toBranchIds = (access) => access?.allBranches ? [] : normalizeBranchIdList(access?.branchIds)

const CANTEEN_ROLE_PERMISSIONS = [
  PERMISSIONS.CANTEEN_POS_ACCESS,
  PERMISSIONS.CANTEEN_PRODUCTS_VIEW,
  PERMISSIONS.CANTEEN_CATALOG_MANAGE,
  PERMISSIONS.CANTEEN_CUSTOMERS_VIEW,
  PERMISSIONS.CANTEEN_REPORTS_VIEW
]

const CANTEEN_PERMISSION_GROUPS = [
  {
    title: 'Kasa & Satış',
    items: [
      { permission: PERMISSIONS.CANTEEN_POS_ACCESS, label: 'Kasa erişimi', description: 'Kantin kasa ekranına giriş yapabilir.' },
      { permission: PERMISSIONS.CANTEEN_SALES_VIEW, label: 'Satış raporları', description: 'Tamamlanan satış akışını ve satış raporlarını görüntüler.' },
      { permission: PERMISSIONS.CANTEEN_REPORTS_VIEW, label: 'Raporlar', description: 'Mağaza rapor ekranını görüntüler.' },
      { permission: PERMISSIONS.CANTEEN_REPORTS_EXPORT, label: 'Rapor dışa aktarma', description: 'Raporları Excel olarak indirebilir.' }
    ]
  },
  {
    title: 'Ürün & Stok',
    items: [
      { permission: PERMISSIONS.CANTEEN_PRODUCTS_VIEW, label: 'Ürünleri görüntüle', description: 'Ürün listelerini ve katalog verisini görür.' },
      { permission: PERMISSIONS.CANTEEN_CATALOG_MANAGE, label: 'Katalog yönetimi', description: 'Ürün, kategori ve katalog düzenlemeleri yapar.' },
      { permission: PERMISSIONS.CANTEEN_STOCK_MANAGE, label: 'Stok hareketleri', description: 'Stok giriş/çıkış hareketlerini yönetir.' },
      { permission: PERMISSIONS.CANTEEN_STOCK_COUNT, label: 'Stok sayım', description: 'Sayım başlatabilir ve sayım işlemlerini yürütebilir.' },
      { permission: PERMISSIONS.CANTEEN_STOCK_COUNT_VIEW, label: 'Sayım geçmişi', description: 'Geçmiş stok sayım kayıtlarını görüntüler.' }
    ]
  },
  {
    title: 'Cari & Tahsilat',
    items: [
      { permission: PERMISSIONS.CANTEEN_CUSTOMERS_VIEW, label: 'Carileri görüntüle', description: 'Cari kartlarını ve hareketlerini görür.' },
      { permission: PERMISSIONS.CANTEEN_CUSTOMERS_CREATE, label: 'Cari oluştur', description: 'Yeni cari hesap açabilir.' },
      { permission: PERMISSIONS.CANTEEN_CUSTOMERS_EDIT, label: 'Cari düzenle', description: 'Cari bilgilerini güncelleyebilir.' },
      { permission: PERMISSIONS.CANTEEN_CUSTOMERS_MANAGE, label: 'Cari yönetimi', description: 'Cari yönetim işlemlerinin tamamını yapabilir.' },
      { permission: PERMISSIONS.CANTEEN_CUSTOMER_PAYMENT_DELETE, label: 'Tahsilat sil', description: 'Cari tahsilat kayıtlarını silebilir.' }
    ]
  },
  {
    title: 'Yönetim',
    items: [
      { permission: PERMISSIONS.CANTEEN_SETTINGS_MANAGE, label: 'Ayarlar', description: 'Kantin ayar ekranlarını yönetebilir.' },
      { permission: PERMISSIONS.CANTEEN_STAFF_MANAGE, label: 'Personel', description: 'Personel hesaplarını ve yetkilerini yönetebilir.' },
      { permission: PERMISSIONS.CANTEEN_BILLING_VIEW, label: 'Üyelik talepleri', description: 'Paket ve üyelik ekranlarını görüntüler.' },
      { permission: PERMISSIONS.CANTEEN_BILLING_MANAGE, label: 'Üyelik yönetimi', description: 'Üyelik ve paket taleplerini yönetebilir.' }
    ]
  }
]

export default function CanteenSettingsStaffPage() {
  const { tenantCtx, user, refresh } = useAuth()
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const isCompact = isMobilePortrait || isTablet
  const [items, setItems] = useState([])
  const [branches, setBranches] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [createForm, setCreateForm] = useState({ name: '', username: '', email: '', password: '', permissions: [], branchAccess: createAccessState([]) })
  const [editForm, setEditForm] = useState({ name: '', username: '', email: '', isActive: true, permissions: [], branchAccess: createAccessState([]) })
  const [pwdForm, setPwdForm] = useState({ password: '' })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const branchNameById = useMemo(
    () => Object.fromEntries((branches || []).map((branch) => [String(branch?._id || branch?.id || ''), branch?.name || '-'])),
    [branches]
  )

  const stats = useMemo(() => {
    const activeCount = items.filter((item) => item.isActive !== false).length
    return [
      { label: 'Toplam personel', value: String(items.length) },
      { label: 'Aktif personel', value: String(activeCount) },
      { label: 'Şube erişimi', value: String(branches.length) }
    ]
  }, [items, branches])

  const togglePermission = (currentList, permission, checked) => {
    const next = new Set(Array.isArray(currentList) ? currentList : [])
    if (checked) next.add(permission)
    else next.delete(permission)
    return canonicalizePermissions(Array.from(next))
  }

  const renderPermissionsEditor = (value, onChange) => {
    const selectedPermissions = new Set(Array.isArray(value) ? value : [])
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="settings-ui-btn" onClick={() => onChange(canonicalizePermissions(CANTEEN_ROLE_PERMISSIONS))}>
            Standart Mağaza Rolünü Uygula
          </button>
        </div>
        {CANTEEN_PERMISSION_GROUPS.map((group) => (
          <SettingsCard
            key={group.title}
            title={group.title}
            description="Kantin personelinin erişim kapsamını bu gruptan yönetin."
            icon="🔐"
            style={{ padding: 16 }}
          >
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
    const response = await api('/api/canteen/branches', { silent: true })
    setBranches(Array.isArray(response?.branches) ? response.branches : [])
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [staffRes] = await Promise.all([
        api(`/api/canteen/staff${includeInactive ? '?includeInactive=true' : ''}`, { silent: true }),
        loadBranches()
      ])
      setItems(Array.isArray(staffRes?.staff) ? staffRes.staff : [])
    } catch (err) {
      setError(err?.message || 'Personel listesi yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [includeInactive])

  const openCreate = () => {
    setCreateForm({ name: '', username: '', email: '', password: '', permissions: [], branchAccess: createAccessState([]) })
    setFormError('')
    setCreateOpen(true)
  }

  const onCreate = async (event) => {
    event.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const payload = {
        name: createForm.name,
        username: createForm.username,
        email: createForm.email,
        password: createForm.password,
        permissions: canonicalizePermissions(createForm.permissions || []),
        branchIds: toBranchIds(createForm.branchAccess)
      }
      const res = await api('/api/canteen/staff', { method: 'POST', data: payload, silent: true })
      if (!res?.ok) {
        const code = res?.code
        if (code === 'duplicate_email') setFormError('Bu e-posta zaten kayıtlı.')
        else if (code === 'duplicate_username') setFormError('Bu kullanıcı adı zaten kayıtlı.')
        else setFormError(res?.message || 'Personel oluşturulamadı.')
        return
      }
      setCreateOpen(false)
      await load()
      try { await refresh?.() } catch {}
    } catch (err) {
      setFormError(err?.message || 'Personel oluşturulamadı.')
    } finally {
      setFormLoading(false)
    }
  }

  const openEdit = (staff) => {
    setSelected(staff)
    setEditForm({
      name: staff?.name || '',
      username: staff?.username || '',
      email: staff?.email || '',
      isActive: staff?.isActive !== false,
      permissions: canonicalizePermissions(normalizePermissions(staff?.permissions || [])),
      branchAccess: createAccessState(staff?.branchIds || [])
    })
    setFormError('')
    setEditOpen(true)
  }

  const onEdit = async (event) => {
    event.preventDefault()
    if (!selected?.id) return
    setFormLoading(true)
    setFormError('')
    try {
      const payload = {
        name: editForm.name,
        username: editForm.username,
        email: editForm.email,
        isActive: !!editForm.isActive,
        permissions: canonicalizePermissions(editForm.permissions || []),
        branchIds: toBranchIds(editForm.branchAccess)
      }
      const res = await api(`/api/canteen/staff/${selected.id}`, { method: 'PUT', data: payload, silent: true })
      if (!res?.ok) {
        const code = res?.code
        if (code === 'duplicate_email') setFormError('Bu e-posta zaten kayıtlı.')
        else if (code === 'duplicate_username') setFormError('Bu kullanıcı adı zaten kayıtlı.')
        else setFormError(res?.message || 'Personel kaydedilemedi.')
        return
      }
      setEditOpen(false)
      await load()
      if (String(selected?.id) === String(user?.id)) {
        try { await refresh?.() } catch {}
      }
    } catch (err) {
      setFormError(err?.message || 'Personel kaydedilemedi.')
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
    if (!selected?.id) return
    setFormLoading(true)
    setFormError('')
    try {
      const res = await api(`/api/canteen/staff/${selected.id}`, {
        method: 'PUT',
        data: { password: pwdForm.password },
        silent: true
      })
      if (!res?.ok) {
        setFormError(res?.message || 'Şifre güncellenemedi.')
        return
      }
      setPwdOpen(false)
    } catch (err) {
      setFormError(err?.message || 'Şifre güncellenemedi.')
    } finally {
      setFormLoading(false)
    }
  }

  const openDeleteConfirm = (staff) => {
    setDeleteTarget(staff)
  }

  const onDelete = async () => {
    const staff = deleteTarget
    if (!staff?.id) return
    setDeleteLoading(true)
    setError('')
    try {
      const res = await api(`/api/canteen/staff/${staff.id}`, { method: 'DELETE', silent: true })
      if (!res?.ok) {
        setError(res?.message || 'Personel silinemedi.')
        return
      }
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err?.message || 'Personel silinemedi.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const branchSummary = (staff) => formatBranchSummary(staff?.branchIds, branchNameById)

  return (
    <CanteenSettingsSection
      badge="Personel Yönetimi"
      title="Kantin personelini restoran panelindeki akışla yönetin"
      description="Yeni personel ekleme, düzenleme, şifre sıfırlama ve şube erişimi atama işlemlerini tek panelden yönetin."
      stats={stats}
      actions={
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 999, border: '1px solid var(--app-border, var(--border))', background: 'var(--app-surface)' }}>
            <input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Pasifleri göster</span>
          </label>
          <button className="btn" type="button" onClick={load} disabled={loading}>{loading ? 'Yükleniyor...' : 'Yenile'}</button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 16 }}>
        <SettingsUiStyles />

        <div className="settings-ui-toolbar">
          <div>
            <h3 style={{ margin: 0 }}>Personel</h3>
            <div style={{ marginTop: 6, fontSize: 13, color: 'var(--app-text-secondary)' }}>Kantin personel erişim, giriş ve şube görünürlüğünü bu panelden yönetin.</div>
          </div>
          <button
            className="settings-ui-btn"
            onClick={openCreate}
            disabled={getSubscriptionStatus(tenantCtx) === 'expired'}
            title={getSubscriptionStatus(tenantCtx) === 'expired' ? 'Paket süreniz doldu. Plan yükseltin.' : undefined}
          >
            Yeni Personel
          </button>
        </div>

        {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}

        {loading ? 'Yükleniyor...' : items.length === 0 ? (
          <div className="settings-ui-table-shell" style={{ padding: 18 }}>Henüz personel yok. Başlamak için “Yeni Personel” ekleyin.</div>
        ) : (
          <>
            <div className="desktop-only settings-ui-table-shell">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ad</th>
                    <th>Kullanıcı Adı</th>
                    <th>E-posta</th>
                    <th>Durum</th>
                    <th>Şubeler</th>
                    <th>İzinler</th>
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
                        <td>{staff.isActive === false ? 'Pasif' : 'Aktif'}</td>
                        <td style={{ minWidth: 220 }}>{branchSummary(staff)}</td>
                        <td>{permCount > 0 ? `${permCount} izin` : '-'}</td>
                        <td className="actions">
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button className="settings-ui-btn" type="button" onClick={() => openEdit(staff)}>Düzenle</button>
                            <button className="settings-ui-btn" type="button" onClick={() => openPwd(staff)}>Şifre Sıfırla</button>
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
                  <div style={{ fontWeight: 900, color: 'var(--app-text)' }}>{staff.name}</div>
                  <div style={{ marginTop: 8, display: 'grid', gap: 4, color: 'var(--app-text-secondary)', fontSize: 13 }}>
                    <span>Kullanıcı adı: {staff.username || '-'}</span>
                    <span>E-posta: {staff.email}</span>
                    <span>Durum: {staff.isActive === false ? 'Pasif' : 'Aktif'}</span>
                    <span>Şubeler: {branchSummary(staff)}</span>
                    <span>İzin: {(staff.permissions || []).length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <button className="settings-ui-btn" type="button" onClick={() => openEdit(staff)}>Düzenle</button>
                    <button className="settings-ui-btn" type="button" onClick={() => openPwd(staff)}>Şifre Sıfırla</button>
                    <button className="settings-ui-btn-danger" type="button" onClick={() => openDeleteConfirm(staff)}>Sil</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Personel" portalSelector=".canteen-settings-shell" dialogStyle={{ width: isCompact ? 'calc(100% - 4px)' : 'min(960px, calc(100vw - 32px))', maxWidth: '100%', maxHeight: isCompact ? 'calc(100dvh - 4px)' : 'calc(100dvh - 24px)', justifySelf: 'center' }} bodyStyle={{ padding: isCompact ? 2 : 22 }}>
          <form onSubmit={onCreate} className="settings-ui-modal-form">
            <div className="settings-ui-grid two">
              <SettingsField label="Ad">
                <input className="settings-ui-input" value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} />
              </SettingsField>
              <SettingsField label="Kullanıcı Adı">
                <input className="settings-ui-input" value={createForm.username} onChange={(event) => setCreateForm({ ...createForm, username: event.target.value })} placeholder="ornek: magaza1" />
              </SettingsField>
              <SettingsField label="E-posta">
                <input className="settings-ui-input" type="email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} />
              </SettingsField>
              <SettingsField label="Şifre">
                <input className="settings-ui-input" type="password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} />
              </SettingsField>
            </div>

            <BranchAccessField
              label="Görebileceği Şubeler"
              hint="Şube seçmezseniz personel tüm şubeleri görebilir. Belirli şubeleri seçerseniz sadece onlar görünür."
              branches={branches}
              value={createForm.branchAccess}
              onChange={(branchAccess) => setCreateForm({ ...createForm, branchAccess })}
              allLabel="Tüm Şubeleri Görebilir"
              emptyText="Önce şube oluşturun."
            />

            <div>
              <div style={{ fontSize: 12, color: 'var(--app-text-secondary)', marginBottom: 8 }}>İzinler</div>
              {renderPermissionsEditor(createForm.permissions, (permissions) => setCreateForm({ ...createForm, permissions }))}
            </div>

            {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
            <button className="settings-ui-submit" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Oluştur'}</button>
          </form>
        </Modal>

        <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Personel Düzenle" portalSelector=".canteen-settings-shell" dialogStyle={{ width: isCompact ? 'calc(100% - 4px)' : 'min(960px, calc(100vw - 32px))', maxWidth: '100%', maxHeight: isCompact ? 'calc(100dvh - 4px)' : 'calc(100dvh - 24px)', justifySelf: 'center' }} bodyStyle={{ padding: isCompact ? 2 : 22 }}>
          <form onSubmit={onEdit} className="settings-ui-modal-form">
            <div className="settings-ui-grid two">
              <SettingsField label="Ad">
                <input className="settings-ui-input" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
              </SettingsField>
              <SettingsField label="Kullanıcı Adı">
                <input className="settings-ui-input" value={editForm.username} onChange={(event) => setEditForm({ ...editForm, username: event.target.value })} placeholder="ornek: magaza1" />
              </SettingsField>
              <SettingsField label="E-posta">
                <input className="settings-ui-input" type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} />
              </SettingsField>
            </div>

            <BranchAccessField
              label="Görebileceği Şubeler"
              hint="Şube dropdownlarında bu personele izin verilen şubeler gösterilir."
              branches={branches}
              value={editForm.branchAccess}
              onChange={(branchAccess) => setEditForm({ ...editForm, branchAccess })}
              allLabel="Tüm Şubeleri Görebilir"
              emptyText="Önce şube oluşturun."
            />

            <SettingsToggle label="Aktif" checked={!!editForm.isActive} onChange={(event) => setEditForm({ ...editForm, isActive: event.target.checked })} />

            <div>
              <div style={{ fontSize: 12, color: 'var(--app-text-secondary)', marginBottom: 8 }}>İzinler</div>
              {renderPermissionsEditor(editForm.permissions, (permissions) => setEditForm({ ...editForm, permissions }))}
            </div>

            {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
            <button className="settings-ui-submit" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Kaydet'}</button>
          </form>
        </Modal>

        <Modal open={pwdOpen} onClose={() => setPwdOpen(false)} title="Şifre Sıfırla" portalSelector=".canteen-settings-shell" dialogStyle={{ width: isCompact ? 'calc(100% - 4px)' : 'min(720px, calc(100vw - 32px))', maxWidth: '100%', maxHeight: isCompact ? 'calc(100dvh - 4px)' : 'calc(100dvh - 24px)', justifySelf: 'center' }} bodyStyle={{ padding: isCompact ? 2 : 22 }}>
          <form onSubmit={onPwd} className="settings-ui-modal-form">
            <SettingsField label="Yeni Şifre">
              <input className="settings-ui-input" type="password" value={pwdForm.password} onChange={(event) => setPwdForm({ password: event.target.value })} />
            </SettingsField>
            {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
            <button className="settings-ui-submit" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Güncelle'}</button>
          </form>
        </Modal>

        <ConfirmDialog
          open={!!deleteTarget}
          title="Personeli Listeden Kaldır"
          message="Bu personel aktif listeden kaldırılacak. Geçmiş satış ve raporlardaki adı korunacaktır. Devam etmek istiyor musunuz?"
          confirmText="Personeli Sil"
          loading={deleteLoading}
          onConfirm={onDelete}
          onClose={() => {
            if (deleteLoading) return
            setDeleteTarget(null)
          }}
        />
      </div>
    </CanteenSettingsSection>
  )
}
