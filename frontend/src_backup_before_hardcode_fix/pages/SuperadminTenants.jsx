import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import Modal from '../components/Modal.jsx'

export default function SuperadminTenants() {
  const [tenants, setTenants] = useState([])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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

  const load = async () => {
    const { tenants } = await api('/api/superadmin/tenants')
    setTenants(tenants)
  }
  useEffect(() => { load() }, [])

  const onCreateTenant = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { tenant } = await api('/api/superadmin/tenants', {
        method: 'POST',
        body: JSON.stringify({ name, slug })
      })
      setName('')
      setSlug('')
      setTenants([tenant, ...tenants])
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

  const onCreateAdmin = async (e) => {
    e.preventDefault()
    setAdminLoading(true)
    setAdminError('')
    try {
      await api(`/api/superadmin/tenants/${selectedTenant.id}/admin`, {
        method: 'POST',
        body: JSON.stringify(adminForm)
      })
      setModalOpen(false)
    } catch (err) {
      setAdminError(err.message)
    } finally {
      setAdminLoading(false)
    }
  }

  const submitEditTenant = async (e) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError('')
    try {
      const { tenant } = await api(`/api/superadmin/tenants/${selectedTenant.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editForm.name })
      })
      setTenants(tenants.map(t => t.id === selectedTenant.id ? { ...t, name: tenant.name } : t))
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

  const submitTrialExtend = async (e) => {
    e.preventDefault()
    setTrialLoading(true)
    setTrialError('')
    try {
      const result = await api(`/api/superadmin/tenants/${selectedTenant.id}/trial-extend`, {
        method: 'PUT',
        body: JSON.stringify({ days: trialDays })
      })
      setTenants(tenants.map(t => t.id === selectedTenant.id ? { ...t, plan: result.plan } : t))
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
      setTenants(tenants.map(t => t.id === tenant.id ? { ...t, plan: result.plan } : t))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const softDeleteTenant = async (tenant) => {
    setLoading(true)
    setError('')
    try {
      await api(`/api/superadmin/tenants/${tenant.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="main" style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 16 }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Üyeler</h3>
        <div>
          <table className="table">
            <thead>
              <tr>
                <th>Üye Adı</th>
                <th>Durum</th>
                <th>Paket</th>
                <th>Deneme Bitiş Tarihi</th>
                <th>Oluşturulma</th>
                <th style={{ width: 360 }}>Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.slug}</div>
                  </td>
                  <td>{(t.isActive && t.status === 'active') ? 'Aktif' : 'Pasif'}</td>
                  <td>{t.plan?.name || '-'}</td>
                  <td>{t.plan?.endsAt ? new Date(t.plan.endsAt).toLocaleDateString() : '-'}</td>
                  <td>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" onClick={() => openEditModal(t)}>✏️ Düzenle</button>
                      <button className="btn" onClick={() => softDeleteTenant(t)}>🗑️ Sil</button>
                      <button className="btn" onClick={() => openAdminModal(t)}>Yönetici Oluştur</button>
                      <button className="btn" onClick={() => openTrialExtend(t)}>Deneme Süresi Uzat</button>
                      <button className="btn" onClick={() => endTrial(t)}>Deneme Süresi Bitir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <form className="card" onSubmit={onCreateTenant}>
        <h3 style={{ marginTop: 0 }}>Üye Oluştur</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pendik Sofrası" />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kod</div>
            <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="pendik-sofrasi" />
          </label>
          {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
          <button className="btn" disabled={loading}>{loading ? 'Gönderiliyor...' : 'Oluştur'}</button>
        </div>
      </form>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Üye Yöneticisi Oluştur">
        <form onSubmit={onCreateAdmin} style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Üye: {selectedTenant?.name}</div>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta</div>
            <input className="input" type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şifre</div>
            <input className="input" type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
          </label>
          {adminError && <div style={{ color: '#ef4444', fontSize: 13 }}>{adminError}</div>}
          <button className="btn" disabled={adminLoading}>{adminLoading ? 'Gönderiliyor...' : 'Oluştur'}</button>
        </form>
      </Modal>
      <Modal open={trialOpen} onClose={() => setTrialOpen(false)} title="Deneme Süresi Uzat">
        <form onSubmit={submitTrialExtend} style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Üye: {selectedTenant?.name}</div>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Deneme Süresi (gün)</div>
            <input className="input" type="number" min="1" value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} />
          </label>
          {trialError && <div style={{ color: '#ef4444', fontSize: 13 }}>{trialError}</div>}
          <button className="btn" disabled={trialLoading}>{trialLoading ? 'Gönderiliyor...' : 'Uzat'}</button>
        </form>
      </Modal>
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Üye Düzenle">
        <form onSubmit={submitEditTenant} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Üye Adı</div>
            <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </label>
          {editError && <div style={{ color: '#ef4444', fontSize: 13 }}>{editError}</div>}
          <button className="btn" disabled={editLoading}>{editLoading ? 'Gönderiliyor...' : 'Kaydet'}</button>
        </form>
      </Modal>
    </div>
  )
}
