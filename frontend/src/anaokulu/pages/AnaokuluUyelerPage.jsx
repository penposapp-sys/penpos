import React, { useState, useEffect } from 'react'
import { api } from '../../lib/apiClient.js'
import { useAuth } from '../../context/AuthContext.jsx'

const Btn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 10, fontWeight: 600,
  cursor: 'pointer', border: 'none', fontSize: 13
}

const InputCls = {
  padding: '9px 12px', borderRadius: 10,
  border: '1px solid #cbd5e1', background: '#fff',
  fontSize: 13, outline: 'none', width: '100%'
}

const LabelCls = {
  fontSize: 12, color: '#475569', fontWeight: 600,
  display: 'block', marginBottom: 6
}

const FieldCls = { marginBottom: 14 }

export default function AnaokuluUyelerPage() {
  const { user, refresh, regionCurrentTenantId, isRegionAdmin, accessibleTenants } = useAuth()
  const isManager = Boolean(isRegionAdmin || user?.role === 'superadmin' || user?.role === 'platform_admin')
  const [scope, setScope] = useState('account') // 'account' | string tenantId
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const toast = (m) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 3000) }

  const withTenantHeaders = (opts = {}) => {
    const extra = { ...opts }
    const effectiveTenantId = scope !== 'account' ? scope : regionCurrentTenantId
    if (effectiveTenantId) {
      extra.headers = { ...(extra.headers || {}), 'x-tenant-id': String(effectiveTenantId) }
    }
    return extra
  }

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [delOpen, setDelOpen] = useState(null) // user object
  const [selected, setSelected] = useState(null)

  const [createForm, setCreateForm] = useState({
    name: '', email: '', username: '', phone: '', password: '', role: 'staff'
  })
  const [editForm, setEditForm] = useState({
    name: '', email: '', username: '', phone: '', role: 'staff', isActive: true
  })
  const [pwdForm, setPwdForm] = useState({ password: '' })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      if (isManager && scope === 'account') {
        const res = await api('/api/platform/region-admin/members', {
          portalOverride: 'anaokulu',
          silent: true
        })
        setItems(Array.isArray(res?.items) ? res.items : [])
      } else {
        const res = await api(`/api/tenant/staff${includeInactive ? '?includeInactive=true' : ''}`, withTenantHeaders({
          portalOverride: 'anaokulu',
          silent: true
        }))
        const all = Array.isArray(res?.staff) ? res.staff : []
        const anaokuluUsers = all.filter(u => !u.systemType || u.systemType === 'anaokulu')
        setItems(anaokuluUsers)
      }
    } catch (err) {
      setError(err?.message || 'Üye listesi yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [includeInactive, scope])

  const openCreate = () => {
    setCreateForm({
      name: '', email: '', username: '', phone: '', password: '',
      role: scope === 'account' ? 'anaokulu_region_admin' : 'staff'
    })
    setFormError('')
    setCreateOpen(true)
  }

  const onCreate = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      if (!createForm.name?.trim()) throw new Error('Ad soyad gerekli.')
      if (!createForm.email?.trim()) throw new Error('E-posta gerekli.')
      if (!createForm.password || createForm.password.length < 6) throw new Error('Şifre en az 6 karakter olmalı.')

      if (isManager && scope === 'account') {
        const payload = {
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          username: createForm.username?.trim() || undefined,
          phone: createForm.phone?.trim() || undefined,
          password: createForm.password
        }
        const res = await api('/api/platform/region-admin/members', {
          method: 'POST', data: payload, silent: true, portalOverride: 'anaokulu'
        })
        if (!res || res.ok === false) {
          const code = res?.code
          if (code === 'duplicate_email') throw new Error('Bu e-posta zaten kayıtlı.')
          if (code === 'duplicate_username') throw new Error('Bu kullanıcı adı zaten kayıtlı.')
          throw new Error(res?.message || 'Üye oluşturulamadı.')
        }
      } else {
        const payload = {
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          username: createForm.username?.trim() || undefined,
          password: createForm.password,
          role: createForm.role,
          permissions: [],
          systemType: 'anaokulu'
        }
        const res = await api('/api/tenant/staff', withTenantHeaders({
          method: 'POST', data: payload, silent: true, portalOverride: 'anaokulu'
        }))
        if (!res || res.ok === false) {
          const code = res?.code
          if (code === 'duplicate_email') throw new Error('Bu e-posta zaten kayıtlı.')
          if (code === 'duplicate_username') throw new Error('Bu kullanıcı adı zaten kayıtlı.')
          throw new Error(res?.message || 'Üye oluşturulamadı.')
        }
      }
      toast('Üye başarıyla eklendi.')
      setCreateOpen(false)
      await load()
    } catch (err) {
      setFormError(err?.message || String(err))
    } finally {
      setFormLoading(false)
    }
  }

  const openEdit = (u) => {
    setSelected(u)
    setEditForm({
      name: u.name || '',
      email: u.email || '',
      username: u.username || '',
      phone: u.phone || '',
      role: u.role || (scope === 'account' ? 'anaokulu_region_admin' : 'staff'),
      isActive: u.isActive !== false && u.status !== 'inactive' && u.status !== 'deleted'
    })
    setFormError('')
    setEditOpen(true)
  }

  const onEditSave = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      if (!selected) return
      if (!editForm.name?.trim()) throw new Error('Ad soyad gerekli.')
      if (!editForm.email?.trim()) throw new Error('E-posta gerekli.')

      if (isManager && scope === 'account') {
        const payload = {
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          username: editForm.username?.trim() || undefined,
          phone: editForm.phone?.trim() || '',
          isActive: !!editForm.isActive
        }
        const res = await api(`/api/platform/region-admin/members/${selected.id || selected._id}`, {
          method: 'PUT', data: payload, silent: true, portalOverride: 'anaokulu'
        })
        if (!res || res.ok === false) throw new Error(res?.message || 'Güncelleme başarısız.')
      } else {
        const payload = {
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          username: editForm.username?.trim() || undefined,
          role: editForm.role,
          isActive: !!editForm.isActive,
          permissions: [],
          systemType: 'anaokulu'
        }
        const res = await api(`/api/tenant/staff/${selected.id || selected._id}`, withTenantHeaders({
          method: 'PUT', data: payload, silent: true, portalOverride: 'anaokulu'
        }))
        if (!res || res.ok === false) throw new Error(res?.message || 'Güncelleme başarısız.')
      }
      toast('Üye güncellendi.')
      setEditOpen(false)
      await load()
    } catch (err) {
      setFormError(err?.message || String(err))
    } finally {
      setFormLoading(false)
    }
  }

  const openPwd = (u) => {
    setSelected(u)
    setPwdForm({ password: '' })
    setFormError('')
    setPwdOpen(true)
  }

  const onPwdSave = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      if (!selected) return
      if (!pwdForm.password || pwdForm.password.length < 6) throw new Error('Şifre en az 6 karakter olmalı.')

      if (isManager && scope === 'account') {
        const res = await api(`/api/platform/region-admin/members/${selected.id || selected._id}`, {
          method: 'PUT', data: { password: pwdForm.password }, silent: true, portalOverride: 'anaokulu'
        })
        if (!res || res.ok === false) throw new Error(res?.message || 'Şifre sıfırlanamadı.')
      } else {
        const res = await api(`/api/tenant/staff/${selected.id || selected._id}/password`, withTenantHeaders({
          method: 'PUT', data: { password: pwdForm.password }, silent: true, portalOverride: 'anaokulu'
        }))
        if (!res || res.ok === false) throw new Error(res?.message || 'Şifre sıfırlanamadı.')
      }
      toast('Şifre sıfırlandı.')
      setPwdOpen(false)
    } catch (err) {
      setFormError(err?.message || String(err))
    } finally {
      setFormLoading(false)
    }
  }

  const onDeleteConfirm = async () => {
    if (!delOpen) return
    setFormLoading(true)
    try {
      if (isManager && scope === 'account') {
        const res = await api(`/api/platform/region-admin/members/${delOpen.id || delOpen._id}`, {
          method: 'DELETE', silent: true, portalOverride: 'anaokulu'
        })
        if (!res || res.ok === false) throw new Error(res?.message || 'Silme başarısız.')
      } else {
        const res = await api(`/api/tenant/staff/${delOpen.id || delOpen._id}`, withTenantHeaders({
          method: 'DELETE', silent: true, portalOverride: 'anaokulu'
        }))
        if (!res || res.ok === false) throw new Error(res?.message || 'Silme başarısız.')
      }
      toast('Üye devre dışı bırakıldı.')
      setDelOpen(null)
      await load()
    } catch (err) {
      toast(err?.message || String(err))
    } finally {
      setFormLoading(false)
    }
  }

  const statusBadge = (u) => {
    const active = u.isActive !== false && u.status !== 'inactive' && u.status !== 'deleted' && u.isDeleted !== true
    const common = { display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }
    return active
      ? { ...common, background: '#dcfce7', color: '#166534', text: 'Aktif' }
      : { ...common, background: '#fee2e2', color: '#991b1b', text: 'Pasif' }
  }

  const roleBadge = (role) => {
    const common = { display: 'inline-block', padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700 }
    if (role === 'anaokulu_region_admin') return { ...common, background: 'rgba(99,102,241,0.12)', color: '#4338ca', text: 'Bölge Yöneticisi' }
    if (role === 'tenant_admin') return { ...common, background: '#eef2ff', color: '#3730a3', text: 'Yönetici (Müdür)' }
    if (role === 'superadmin') return { ...common, background: '#fff7ed', color: '#9a3412', text: 'Süper Admin' }
    if (role === 'platform_admin') return { ...common, background: '#fef3c7', color: '#92400e', text: 'Platform' }
    return { ...common, background: '#f1f5f9', color: '#334155', text: 'Personel' }
  }

  const panel = {
    background: '#fff', borderRadius: 14, border: '1px solid #e6ebf3',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)', overflow: 'hidden'
  }
  const th = {
    padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#475569',
    background: '#f8fafc', borderBottom: '1px solid #e6ebf3', textAlign: 'left'
  }
  const td = {
    padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle'
  }
  const tbl = { width: '100%', borderCollapse: 'collapse' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 24, color: '#0f172a' }}>👤 Anaokulu Üyeleri</h2>
          <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>
            {scope === 'account' 
              ? 'Yönetim paneliniz için yardımcı yöneticileri buradan yönetin. Tüm bağlı okulların verilerine erişebilirler.'
              : 'Seçili okula ait müdür ve öğretmen kadrosunu buradan yönetin.'}
          </p>
        </div>
        <button onClick={openCreate} style={{
          ...Btn, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
          boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
        }}>
          {scope === 'account' ? '➕ Yönetim Paneline Üye Ekle' : '➕ Yeni Personel Ekle'}
        </button>
      </div>

      {isManager && (
        <div style={{
          ...panel, marginBottom: 16, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🏢</span> Yönetilen Alan:
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setScope('account')}
              style={{
                ...Btn,
                background: scope === 'account' ? 'linear-gradient(135deg,#4f46e5,#6366f1)' : '#f1f5f9',
                color: scope === 'account' ? '#fff' : '#475569',
                border: scope === 'account' ? 'none' : '1px solid #e2e8f0',
                boxShadow: scope === 'account' ? '0 2px 8px rgba(79,70,229,0.25)' : 'none'
              }}
            >
              👑 Kendi Hesabım (Yönetim Paneli)
            </button>
            {(accessibleTenants || []).map(t => {
              const tId = String(t.id || t._id)
              const isSel = scope === tId
              return (
                <button
                  key={tId}
                  type="button"
                  onClick={() => setScope(tId)}
                  style={{
                    ...Btn,
                    background: isSel ? 'linear-gradient(135deg,#0284c7,#0ea5e9)' : '#f1f5f9',
                    color: isSel ? '#fff' : '#475569',
                    border: isSel ? 'none' : '1px solid #e2e8f0',
                    boxShadow: isSel ? '0 2px 8px rgba(2,132,199,0.25)' : 'none'
                  }}
                >
                  🏫 {t.name || 'Anaokulu'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {isManager && scope === 'account' ? (
        <div style={{
          background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 12,
          padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#3730a3', display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span style={{ fontSize: 20 }}>👑</span>
          <div>
            <b>Kendi Hesabınız (Yönetim Paneli Üyeleri):</b> Buraya eklenen kullanıcılar sizin adınıza tüm bağlı anaokullarının verilerini (ücretler, tahsilatlar, faturalar, raporlar) görüntüleyebilir ve yönetebilir.
          </div>
        </div>
      ) : isManager ? (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12,
          padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#166534', display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span style={{ fontSize: 20 }}>🏫</span>
          <div>
            <b>{accessibleTenants?.find(t => String(t.id || t._id) === String(scope))?.name || 'Okul'} Personelleri:</b> Bu okula ait öğretmen ve yöneticileri listeliyorsunuz. Buradaki kullanıcılar yalnızca bu okulun verilerine erişebilir.
          </div>
        </div>
      ) : null}

      <div style={{
        ...panel, marginBottom: 16, padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
            Pasif üyeleri de göster
          </label>
        </div>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          Toplam: <b style={{ color: '#0f172a' }}>{items.length}</b> üye
        </span>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', background: '#fee2e2', color: '#991b1b',
          borderRadius: 12, marginBottom: 16, fontSize: 13, fontWeight: 500
        }}>{error}</div>
      )}

      <div style={panel}>
        <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
          <table style={tbl}>
            <thead>
              <tr>
                <th style={th}>Ad Soyad</th>
                <th style={th}>E-posta</th>
                <th style={th}>Kullanıcı Adı / Tel</th>
                <th style={th}>Rol</th>
                <th style={th}>Durum</th>
                <th style={{ ...th, minWidth: 220, textAlign: 'right' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ ...td, textAlign: 'center', padding: '40px 12px', color: '#94a3b8' }}>Yükleniyor...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} style={{ ...td, textAlign: 'center', padding: '40px 12px', color: '#94a3b8' }}>
                  {scope === 'account' 
                    ? 'Yönetim panelinize henüz yardımcı üye eklenmemiş. Yukarıdaki butondan ekleyebilirsiniz.'
                    : 'Bu okula ait henüz üye eklenmemiş. Yukarıdaki butondan ilk üyeyi ekleyin.'}
                </td></tr>
              ) : items.map(u => {
                const sBdg = statusBadge(u)
                const rBdg = roleBadge(u.role)
                const isMe = String(user?.id || user?._id || '') === String(u.id || u._id || '')
                return (
                  <tr key={String(u.id || u._id || u.email)}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...td, fontWeight: 700 }}>
                      {u.name || '-'}
                      {isMe && <span style={{ fontSize: 10, marginLeft: 6, padding: '2px 6px', background: '#eef2ff', color: '#3730a3', borderRadius: 999, fontWeight: 700 }}>SİZ</span>}
                    </td>
                    <td style={td}>{u.email || '-'}</td>
                    <td style={{ ...td, color: '#334155' }}>
                      <div>{u.username || '-'}</div>
                      {u.phone && <div style={{ fontSize: 11, color: '#64748b' }}>📞 {u.phone}</div>}
                    </td>
                    <td style={td}><span style={rBdg}>{rBdg.text}</span></td>
                    <td style={td}><span style={sBdg}>{sBdg.text}</span></td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button onClick={() => openEdit(u)} style={{
                          ...Btn, background: '#f1f5f9', color: '#0f172a', padding: '6px 12px', fontSize: 12
                        }}>Düzenle</button>
                        <button onClick={() => openPwd(u)} style={{
                          ...Btn, background: '#f8fafc', color: '#334155', padding: '6px 12px', fontSize: 12
                        }}>Şifre</button>
                        {!isMe && (
                          <button onClick={() => setDelOpen(u)} style={{
                            ...Btn, background: '#fee2e2', color: '#b91c1c', padding: '6px 12px', fontSize: 12
                          }}>Sil</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <ModalWrap title={scope === 'account' ? 'Yönetim Paneline Yeni Üye Ekle' : 'Yeni Okul Personeli Ekle'} onClose={() => setCreateOpen(false)}>
          <form onSubmit={onCreate}>
            <div style={FieldCls}>
              <label style={LabelCls}>Ad Soyad *</label>
              <input style={InputCls} value={createForm.name}
                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Örn: Ayşe Yılmaz" />
            </div>
            <div style={FieldCls}>
              <label style={LabelCls}>E-posta *</label>
              <input style={InputCls} type="email" value={createForm.email}
                onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="ayse@example.com" />
            </div>
            <div style={FieldCls}>
              <label style={LabelCls}>Kullanıcı Adı (isteğe bağlı)</label>
              <input style={InputCls} value={createForm.username}
                onChange={e => setCreateForm({ ...createForm, username: e.target.value })}
                placeholder="ayseyilmaz" />
            </div>
            <div style={FieldCls}>
              <label style={LabelCls}>Telefon (isteğe bağlı)</label>
              <input style={InputCls} value={createForm.phone}
                onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                placeholder="05xxxxxxxxx" />
            </div>
            <div style={FieldCls}>
              <label style={LabelCls}>Şifre * (en az 6 karakter)</label>
              <input style={InputCls} type="password" value={createForm.password}
                onChange={e => setCreateForm({ ...createForm, password: e.target.value })} />
            </div>
            {scope === 'account' ? (
              <div style={FieldCls}>
                <label style={LabelCls}>Yetki Seviyesi</label>
                <div style={{
                  padding: '10px 12px', background: '#eef2ff', borderRadius: 10,
                  border: '1px solid #c7d2fe', fontSize: 13, color: '#3730a3', fontWeight: 600
                }}>
                  👑 Yönetim Paneli Yöneticisi (Tüm bağlı okullara tam erişim sağlar)
                </div>
              </div>
            ) : (
              <div style={FieldCls}>
                <label style={LabelCls}>Rol</label>
                <select style={InputCls} value={createForm.role}
                  onChange={e => setCreateForm({ ...createForm, role: e.target.value })}>
                  <option value="staff">👩‍🏫 Personel (Öğretmen / Muhasebeci)</option>
                  <option value="tenant_admin">👑 Okul Yöneticisi (Müdür / Tam Yetki)</option>
                </select>
              </div>
            )}
            {formError && <div style={{
              padding: '10px 14px', background: '#fee2e2', color: '#991b1b',
              borderRadius: 10, fontSize: 12, fontWeight: 600, marginBottom: 14
            }}>{formError}</div>}
          </form>
          <ModalFooter
            onClose={() => setCreateOpen(false)}
            onPrimary={onCreate}
            primaryText="Üyeyi Kaydet"
            loading={formLoading}
          />
        </ModalWrap>
      )}

      {editOpen && selected && (
        <ModalWrap title="Üyeyi Düzenle" onClose={() => setEditOpen(false)}>
          <form onSubmit={onEditSave}>
            <div style={FieldCls}>
              <label style={LabelCls}>Ad Soyad *</label>
              <input style={InputCls} value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div style={FieldCls}>
              <label style={LabelCls}>E-posta *</label>
              <input style={InputCls} type="email" value={editForm.email}
                onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div style={FieldCls}>
              <label style={LabelCls}>Kullanıcı Adı</label>
              <input style={InputCls} value={editForm.username}
                onChange={e => setEditForm({ ...editForm, username: e.target.value })} />
            </div>
            <div style={FieldCls}>
              <label style={LabelCls}>Telefon</label>
              <input style={InputCls} value={editForm.phone}
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="05xxxxxxxxx" />
            </div>
            {scope === 'account' ? (
              <div style={FieldCls}>
                <label style={LabelCls}>Yetki Seviyesi</label>
                <div style={{
                  padding: '8px 12px', background: '#eef2ff', borderRadius: 10,
                  border: '1px solid #c7d2fe', fontSize: 13, color: '#3730a3', fontWeight: 600
                }}>
                  👑 Yönetim Paneli Yöneticisi
                </div>
              </div>
            ) : (
              <div style={FieldCls}>
                <label style={LabelCls}>Rol</label>
                <select style={InputCls} value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                  <option value="staff">👩‍🏫 Personel</option>
                  <option value="tenant_admin">👑 Okul Yöneticisi</option>
                </select>
              </div>
            )}
            <div style={FieldCls}>
              <label style={{ ...LabelCls, marginBottom: 0, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!editForm.isActive}
                  onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} />
                Hesap aktif
              </label>
            </div>
            {formError && <div style={{
              padding: '10px 14px', background: '#fee2e2', color: '#991b1b',
              borderRadius: 10, fontSize: 12, fontWeight: 600, marginBottom: 14
            }}>{formError}</div>}
          </form>
          <ModalFooter
            onClose={() => setEditOpen(false)}
            onPrimary={onEditSave}
            primaryText="Değişiklikleri Kaydet"
            loading={formLoading}
          />
        </ModalWrap>
      )}


      {pwdOpen && selected && (
        <ModalWrap title={`${selected.name || 'Üye'} · Şifre Sıfırla`} onClose={() => setPwdOpen(false)}>
          <form onSubmit={onPwdSave}>
            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 16px 0' }}>
              <b>{selected.email}</b> hesabı için yeni şifre belirleyin.
            </p>
            <div style={FieldCls}>
              <label style={LabelCls}>Yeni Şifre * (en az 6 karakter)</label>
              <input style={InputCls} type="password" value={pwdForm.password}
                onChange={e => setPwdForm({ ...pwdForm, password: e.target.value })} />
            </div>
            {formError && <div style={{
              padding: '10px 14px', background: '#fee2e2', color: '#991b1b',
              borderRadius: 10, fontSize: 12, fontWeight: 600, marginBottom: 14
            }}>{formError}</div>}
          </form>
          <ModalFooter
            onClose={() => setPwdOpen(false)}
            onPrimary={onPwdSave}
            primaryText="Şifreyi Sıfırla"
            loading={formLoading}
          />
        </ModalWrap>
      )}

      {delOpen && (
        <ModalWrap title="Üyeyi Sil / Devre Dışı Bırak" onClose={() => setDelOpen(null)}>
          <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.6 }}>
            <b>{delOpen.name}</b> (<code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 6 }}>{delOpen.email}</code>)
            {' '}üyesini silmek istediğinizden emin misiniz?<br />
            Bu işlem hesabı <b>devre dışı bırakır</b>, veri kaybı olmaz. Gelecekte tekrar aktifleştirilebilir.
          </p>
          <ModalFooter
            onClose={() => setDelOpen(null)}
            onPrimary={onDeleteConfirm}
            primaryText="Evet, Devre Dışı Bırak"
            primaryDanger
            loading={formLoading}
          />
        </ModalWrap>
      )}

      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#0f172a', color: '#fff', padding: '12px 22px', borderRadius: 14,
          fontWeight: 600, fontSize: 13, zIndex: 99999,
          boxShadow: '0 8px 24px rgba(15,23,42,0.3)'
        }}>{toastMsg}</div>
      )}
    </div>
  )
}

function ModalWrap({ title, children, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20
    }}>
      <div style={{
        background: '#fff', borderRadius: 18, width: 'min(540px, 100%)', maxHeight: '90vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(15,23,42,0.25)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid #e6ebf3',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{
            padding: '6px 10px', borderRadius: 8, border: 'none', background: '#f1f5f9',
            cursor: 'pointer', fontSize: 14, color: '#475569', fontWeight: 700
          }}>✕</button>
        </div>
        <div style={{ padding: 22, overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}

function ModalFooter({ onClose, onPrimary, primaryText = 'Kaydet', loading = false, primaryDanger = false }) {
  return (
    <div style={{
      padding: '14px 22px', borderTop: '1px solid #e6ebf3',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      background: '#f8fafc'
    }}>
      <div></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} disabled={loading} style={{
          ...Btn, background: '#fff', color: '#475569', border: '1px solid #cbd5e1',
          opacity: loading ? 0.5 : 1
        }}>Kapat</button>
        {onPrimary && (
          <button onClick={onPrimary} disabled={loading} style={{
            ...Btn,
            background: primaryDanger
              ? 'linear-gradient(135deg,#ef4444,#dc2626)'
              : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            color: '#fff',
            boxShadow: primaryDanger
              ? '0 4px 12px rgba(239,68,68,0.25)'
              : '0 4px 12px rgba(99,102,241,0.25)',
            opacity: loading ? 0.7 : 1
          }}>{loading ? '⏳ Kaydediliyor...' : primaryText}</button>
        )}
      </div>
    </div>
  )
}
