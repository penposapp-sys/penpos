import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import Modal from '../components/Modal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import {
  AdminPageHeader,
  AdminTableCard,
  AdminEmptyState,
  AdminStatusBadge,
  AdminActionMenu
} from '../components/AdminListUi.jsx'

const isValidObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || '').trim())

export default function PlatformAdminAnaokuluRegionAdmins() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [anaokuluTenants, setAnaokuluTenants] = useState([])
  const [tenantsLoading, setTenantsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modals state
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [passOpen, setPassOpen] = useState(false)
  const [delOpen, setDelOpen] = useState(false)

  const [targetAdmin, setTargetAdmin] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    accessibleTenantIds: [],
    isActive: true
  })

  const [newPassword, setNewPassword] = useState('')

  const tenantMap = useMemo(() => {
    const map = new Map()
    for (const t of anaokuluTenants) {
      map.set(String(t._id || t.id), t.name || 'İsimsiz Okul')
    }
    return map
  }, [anaokuluTenants])

  const loadTenants = async () => {
    setTenantsLoading(true)
    try {
      const res = await api('/api/platform/tenants?systemType=anaokulu', { portalOverride: 'platform' })
      const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
      const filtered = raw.filter((t) => {
        const pkg = String(t?.vertical || t?.systemType || t?.businessType || '').trim().toLowerCase()
        return pkg === 'anaokulu'
      })
      setAnaokuluTenants(filtered)
    } catch {
      setAnaokuluTenants([])
    } finally {
      setTenantsLoading(false)
    }
  }

  const loadAdmins = async () => {
    setLoading(true)
    try {
      const res = await api('/api/platform/anaokulu-region-admins', { portalOverride: 'platform' })
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : []
      setItems(list)
    } catch (err) {
      toast.error(err.message || 'Okul süper adminleri yüklenemedi')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTenants()
    loadAdmins()
  }, [])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return items.filter((row) => {
      const matchesSearch = !q || [row?.name, row?.email, row?.phone].some((v) =>
        String(v || '').toLocaleLowerCase('tr-TR').includes(q)
      )
      const isActive = row.isActive !== false
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && isActive) ||
        (statusFilter === 'inactive' && !isActive)

      return matchesSearch && matchesStatus
    })
  }, [items, search, statusFilter])

  const openCreate = () => {
    setForm({
      name: '',
      email: '',
      phone: '',
      password: '',
      accessibleTenantIds: anaokuluTenants.length === 1 ? [String(anaokuluTenants[0]._id || anaokuluTenants[0].id)] : [],
      isActive: true
    })
    setFormError('')
    setCreateOpen(true)
  }

  const openEdit = (row) => {
    setTargetAdmin(row)
    setForm({
      name: row?.name || row?.fullName || '',
      email: row?.email || '',
      phone: row?.phone || '',
      password: '',
      accessibleTenantIds: Array.isArray(row?.accessibleTenantIds) ? row.accessibleTenantIds.map(String) : [],
      isActive: row?.isActive !== false
    })
    setFormError('')
    setEditOpen(true)
  }

  const openPass = (row) => {
    setTargetAdmin(row)
    setNewPassword('')
    setFormError('')
    setPassOpen(true)
  }

  const openDel = (row) => {
    setTargetAdmin(row)
    setDelOpen(true)
  }

  const toggleTenant = (tenantId) => {
    const sid = String(tenantId || '').trim()
    if (!sid || !isValidObjectId(sid)) return
    setForm((prev) => {
      const current = Array.isArray(prev.accessibleTenantIds) ? [...prev.accessibleTenantIds] : []
      const idx = current.findIndex((x) => String(x) === sid)
      if (idx >= 0) current.splice(idx, 1)
      else current.push(sid)
      return { ...prev, accessibleTenantIds: current }
    })
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      if (!form.name || !form.email) throw new Error('Ad soyad ve e-posta zorunludur')
      if (!form.password || String(form.password).length < 6) throw new Error('Şifre en az 6 karakter olmalıdır')
      if (!Array.isArray(form.accessibleTenantIds) || form.accessibleTenantIds.length === 0) {
        throw new Error('En az bir anaokulu seçmelisiniz.')
      }
      const validIds = form.accessibleTenantIds.filter((x) => isValidObjectId(x) && tenantMap.has(x))
      if (validIds.length === 0) {
        throw new Error('Seçilen anaokullarından hiçbiri geçerli değil.')
      }

      const res = await api('/api/platform/anaokulu-region-admins', {
        method: 'POST',
        data: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          accessibleTenantIds: validIds
        },
        portalOverride: 'platform'
      })

      if (!res?.ok) {
        const err = new Error(res?.message || res?.error || 'Okul süper admin oluşturulamadı')
        err.code = res?.code
        throw err
      }

      setCreateOpen(false)
      toast.success('Okul süper admin başarıyla oluşturuldu')
      await loadAdmins()
    } catch (err) {
      setFormError(err.code === 'email_taken' || err.code === 'email_in_use' ? (err.message || 'Bu e-posta zaten kullanılıyor') : err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!targetAdmin) return
    setFormLoading(true)
    setFormError('')
    try {
      if (!form.name || !form.email) throw new Error('Ad soyad ve e-posta zorunludur')
      const validIds = form.accessibleTenantIds.filter((x) => isValidObjectId(x) && tenantMap.has(x))
      if (validIds.length === 0) {
        throw new Error('En az bir geçerli anaokulu seçmelisiniz.')
      }

      const res = await api(`/api/platform/anaokulu-region-admins/${encodeURIComponent(targetAdmin._id || targetAdmin.id)}`, {
        method: 'PUT',
        data: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          accessibleTenantIds: validIds,
          isActive: form.isActive
        },
        portalOverride: 'platform'
      })

      if (!res?.ok) {
        const err = new Error(res?.message || res?.error || 'Okul süper admin güncellenemedi')
        err.code = res?.code
        throw err
      }

      setEditOpen(false)
      setTargetAdmin(null)
      toast.success('Okul süper admin güncellendi')
      await loadAdmins()
    } catch (err) {
      setFormError(err.code === 'email_taken' || err.code === 'email_in_use' ? (err.message || 'Bu e-posta zaten kullanılıyor') : err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handlePassSubmit = async (e) => {
    e.preventDefault()
    if (!targetAdmin) return
    setFormLoading(true)
    setFormError('')
    try {
      if (!newPassword || newPassword.length < 6) throw new Error('Şifre en az 6 karakter olmalıdır')
      const res = await api(`/api/platform/anaokulu-region-admins/${encodeURIComponent(targetAdmin._id || targetAdmin.id)}`, {
        method: 'PUT',
        data: { password: newPassword },
        portalOverride: 'platform'
      })
      if (!res?.ok) throw new Error(res?.message || res?.error || 'Şifre sıfırlanamadı')
      setPassOpen(false)
      setTargetAdmin(null)
      toast.success('Şifre başarıyla güncellendi')
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelConfirm = async () => {
    if (!targetAdmin) return
    try {
      const res = await api(`/api/platform/anaokulu-region-admins/${encodeURIComponent(targetAdmin._id || targetAdmin.id)}`, {
        method: 'DELETE',
        portalOverride: 'platform'
      })
      if (!res?.ok) throw new Error(res?.message || res?.error || 'Okul süper admin silinemedi')
      setDelOpen(false)
      setTargetAdmin(null)
      toast.success('Okul süper admin silindi')
      await loadAdmins()
    } catch (err) {
      toast.error(err.message || 'Silme işlemi başarısız')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Top Breadcrumb & Return Button Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <button
          type="button"
          onClick={() => navigate('/platform/anaokulu-tenants')}
          className="btn btn--secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <span>←</span>
          <span>Anaokulu Üyelerine Dön</span>
        </button>

        <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
          <Link to="/platform/anaokulu-tenants" style={{ color: '#6366f1', textDecoration: 'none' }}>
            Anaokulu Üyeleri
          </Link>
          <span style={{ margin: '0 8px' }}>/</span>
          <span>Okul Süper Adminleri</span>
        </div>
      </div>

      {/* Main Page Header */}
      <AdminPageHeader
        title="🏫 Anaokulu Okul Süper Adminleri"
        subtitle="Birden fazla anaokulunu tek bir hesaptan yönetebilen okul süper adminlerini oluşturun ve yetkilendirin."
        action={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={openCreate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700
              }}
            >
              <span>➕</span>
              <span>Yeni Yönetici Oluştur</span>
            </button>
          </div>
        }
      />

      {/* Filter and Stats Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          padding: '14px 18px',
          borderRadius: 14
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 260, maxWidth: 420 }}>
          <input
            className="input admin-filter-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ad, e-posta veya telefon ile ara..."
            style={{ width: '100%' }}
          />
          {search && (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setSearch('')}
            >
              Temizle
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ minWidth: 130 }}
          >
            <option value="all">Tüm Durumlar</option>
            <option value="active">Sadece Aktif</option>
            <option value="inactive">Sadece Pasif</option>
          </select>

          <div
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              background: 'rgba(99, 102, 241, 0.08)',
              color: '#4f46e5',
              fontSize: 13,
              fontWeight: 700
            }}
          >
            Toplam: {items.length} Yönetici
          </div>
        </div>
      </div>

      {/* Table Card */}
      <AdminTableCard>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
            Yöneticiler yükleniyor...
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 30 }}>
            <AdminEmptyState
              title={search || statusFilter !== 'all' ? 'Aramanıza uygun yönetici bulunamadı' : 'Kayıtlı Okul Süper Admin Yok'}
              description={
                search || statusFilter !== 'all'
                  ? 'Filtreleri sıfırlayarak tekrar deneyebilirsiniz.'
                  : 'Sağ üstteki "Yeni Yönetici Oluştur" butonuna tıklayarak ilk okul süper adminini ekleyebilirsiniz.'
              }
            />
            {!search && statusFilter === 'all' && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <button type="button" className="btn btn--primary" onClick={openCreate}>
                  ➕ İlk Okul Süper Adminini Ekle
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Yönetici Bilgisi</th>
                  <th style={{ minWidth: 180 }}>E-Posta</th>
                  <th style={{ minWidth: 130 }}>Telefon</th>
                  <th style={{ minWidth: 220 }}>Yetkili Olduğu Anaokulları</th>
                  <th style={{ minWidth: 100 }}>Durum</th>
                  <th className="admin-actions-cell" style={{ width: 120 }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((row) => {
                  const assignedIds = Array.isArray(row.accessibleTenantIds) ? row.accessibleTenantIds.map(String) : []
                  const active = row.isActive !== false
                  return (
                    <tr key={row._id || row.id} className="admin-table-row">
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 12,
                              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: 15,
                              flexShrink: 0
                            }}
                          >
                            {(row.name || 'Y')[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                              {row.name || 'İsimsiz Yönetici'}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                              Okul Süper Admin
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="admin-cell-ellipsis" style={{ fontWeight: 500, color: '#334155' }}>
                          {row.email || '—'}
                        </span>
                      </td>

                      <td>
                        <span style={{ color: '#475569', fontSize: 13, fontWeight: 500 }}>
                          {row.phone || '—'}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {assignedIds.length === 0 ? (
                            <span style={{ color: '#94a3b8', fontSize: 12 }}>Henüz okul atanmadı</span>
                          ) : (
                            assignedIds.map((tid) => {
                              const schoolName = tenantMap.get(tid)
                              if (!schoolName) return null
                              return (
                                <span
                                  key={tid}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    background: 'rgba(99, 102, 241, 0.09)',
                                    color: '#4338ca',
                                    border: '1px solid rgba(99, 102, 241, 0.2)'
                                  }}
                                  title={schoolName}
                                >
                                  🏫 {schoolName}
                                </span>
                              )
                            })
                          )}
                        </div>
                      </td>

                      <td>
                        <AdminStatusBadge tone={active ? 'success' : 'neutral'}>
                          {active ? 'Aktif' : 'Pasif'}
                        </AdminStatusBadge>
                      </td>

                      <td className="admin-actions-cell">
                        <AdminActionMenu
                          items={[
                            { label: '✏️ Düzenle', onClick: () => openEdit(row) },
                            { label: '🔑 Şifre Sıfırla', onClick: () => openPass(row) },
                            { label: '🗑️ Sil', onClick: () => openDel(row), danger: true }
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

      {/* Create Manager Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="🏫 Yeni Okul Süper Admin Oluştur">
        <form onSubmit={handleCreateSubmit} style={{ display: 'grid', gap: 14 }}>
          {formError && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>
              ⚠️ {formError}
            </div>
          )}

          <label>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Ad Soyad *</div>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Örn: Ahmet Yılmaz"
              required
            />
          </label>

          <label>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>E-posta *</div>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="yonetici@anaokulu.com"
              required
            />
          </label>

          <label>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Telefon</div>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="05xx xxx xx xx"
            />
          </label>

          <label>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Şifre * (En az 6 karakter)</div>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </label>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Erişilebilir Anaokulları * (Yöneticinin denetleyeceği okulları seçin)
            </div>
            <div
              className="card"
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                display: 'grid',
                gap: 6,
                padding: 10,
                borderRadius: 10,
                background: '#f8fafc'
              }}
            >
              {anaokuluTenants.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94a3b8', padding: 8 }}>
                  Sistemde henüz kayıtlı anaokulu yok. Önce "Anaokulu Üyeleri" sayfasından okul oluşturun.
                </div>
              ) : (
                anaokuluTenants.map((t) => {
                  const sid = String(t._id || t.id)
                  const checked = form.accessibleTenantIds.includes(sid)
                  return (
                    <label
                      key={sid}
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: checked ? 'rgba(99, 102, 241, 0.08)' : '#fff',
                        border: '1px solid',
                        borderColor: checked ? 'rgba(99, 102, 241, 0.3)' : '#e2e8f0'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTenant(sid)}
                      />
                      <span style={{ fontSize: 13, fontWeight: checked ? 700 : 500, color: checked ? '#4338ca' : '#1e293b' }}>
                        🏫 {t.name}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn--secondary" onClick={() => setCreateOpen(false)}>
              Vazgeç
            </button>
            <button type="submit" className="btn btn--primary" disabled={formLoading}>
              {formLoading ? 'Oluşturuluyor...' : 'Yöneticiyi Oluştur'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Manager Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="✏️ Okul Süper Admini Düzenle">
        <form onSubmit={handleEditSubmit} style={{ display: 'grid', gap: 14 }}>
          {formError && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>
              ⚠️ {formError}
            </div>
          )}

          <label>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Ad Soyad *</div>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>

          <label>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>E-posta *</div>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>

          <label>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Telefon</div>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 0' }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
              Hesap Aktif (Giriş yapabilir)
            </span>
          </label>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Erişilebilir Anaokulları *
            </div>
            <div
              className="card"
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                display: 'grid',
                gap: 6,
                padding: 10,
                borderRadius: 10,
                background: '#f8fafc'
              }}
            >
              {anaokuluTenants.map((t) => {
                const sid = String(t._id || t.id)
                const checked = form.accessibleTenantIds.includes(sid)
                return (
                  <label
                    key={sid}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: checked ? 'rgba(99, 102, 241, 0.08)' : '#fff',
                      border: '1px solid',
                      borderColor: checked ? 'rgba(99, 102, 241, 0.3)' : '#e2e8f0'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTenant(sid)}
                    />
                    <span style={{ fontSize: 13, fontWeight: checked ? 700 : 500, color: checked ? '#4338ca' : '#1e293b' }}>
                      🏫 {t.name}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn--secondary" onClick={() => setEditOpen(false)}>
              Vazgeç
            </button>
            <button type="submit" className="btn btn--primary" disabled={formLoading}>
              {formLoading ? 'Kaydediliyor...' : 'Güncelle'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={passOpen} onClose={() => setPassOpen(false)} title={`🔑 Şifre Sıfırla: ${targetAdmin?.name || ''}`}>
        <form onSubmit={handlePassSubmit} style={{ display: 'grid', gap: 14 }}>
          {formError && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>
              ⚠️ {formError}
            </div>
          )}

          <label>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Yeni Şifre * (En az 6 karakter)</div>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Yeni şifreyi girin"
              required
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn--secondary" onClick={() => setPassOpen(false)}>
              Vazgeç
            </button>
            <button type="submit" className="btn btn--primary" disabled={formLoading}>
              {formLoading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title="Okul Süper Admini Sil"
        description={`"${targetAdmin?.name || targetAdmin?.email}" adlı okul süper adminini silmek istediğinizden emin misiniz? Bu yönetici anaokulu paneline erişemez.`}
        confirmText="Evet, Sil"
        cancelText="Vazgeç"
        danger={true}
        onConfirm={handleDelConfirm}
      />
    </div>
  )
}
