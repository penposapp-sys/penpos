import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/apiClient.js'
import Modal from '../../components/Modal.jsx'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'
import CanteenSettingsSection, { CanteenSettingsCard } from '../components/CanteenSettingsSection.jsx'

export default function CanteenSettingsBranchesPage() {
  const { isMobilePortrait } = useResponsiveFlags()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [openCreate, setOpenCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDescription, setCreateDescription] = useState('')

  const [openEdit, setOpenEdit] = useState(false)
  const [editId, setEditId] = useState('')
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')

  const [openStaff, setOpenStaff] = useState(false)
  const [staffBranchId, setStaffBranchId] = useState('')
  const [staffBranchName, setStaffBranchName] = useState('')
  const [staffLoading, setStaffLoading] = useState(false)
  const [staffList, setStaffList] = useState([])
  const [assignedStaffIds, setAssignedStaffIds] = useState([])
  const [staffQuery, setStaffQuery] = useState('')

  const load = async (options = {}) => {
    const background = options?.background === true
    if (!background) setLoading(true)
    if (!background) setError('')
    try {
      const res = await api('/api/canteen/branches', { silent: true })
      setItems(Array.isArray(res?.branches) ? res.branches : [])
    } finally {
      if (!background) setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const stats = useMemo(() => {
    const activeCount = items.filter((item) => item.isActive !== false).length
    return [
      { label: 'Toplam şube', value: String(items.length) },
      { label: 'Aktif şube', value: String(activeCount) },
      { label: 'Pasif şube', value: String(Math.max(0, items.length - activeCount)) },
    ]
  }, [items])

  const submitCreate = async () => {
    const name = String(createName || '').trim()
    if (!name) return
    setError('')
    const res = await api('/api/canteen/branches', {
      method: 'POST',
      data: { name, description: String(createDescription || '').trim() },
      silent: true,
    })
    if (!res?.ok) {
      setError(res?.message || 'Şube eklenemedi.')
      return
    }
    setOpenCreate(false)
    setCreateName('')
    setCreateDescription('')
    await load()
  }

  const openEditModal = (branch) => {
    setEditId(String(branch?.id || ''))
    setEditName(String(branch?.name || ''))
    setEditDescription(String(branch?.description || ''))
    setOpenEdit(true)
  }

  const submitEdit = async () => {
    if (!editId) return
    const name = String(editName || '').trim()
    if (!name) return
    setError('')
    const res = await api(`/api/canteen/branches/${editId}`, {
      method: 'PUT',
      data: { name, description: String(editDescription || '').trim() },
      silent: true,
    })
    if (!res?.ok) {
      setError(res?.message || 'Şube güncellenemedi.')
      return
    }
    setOpenEdit(false)
    await load()
  }

  const toggleStatus = async (branch) => {
    const id = String(branch?.id || '')
    if (!id) return
    const nextActive = branch?.isActive === false
    const confirmed = window.confirm(nextActive ? 'Şubeyi aktifleştirmek istiyor musunuz?' : 'Şubeyi pasifleştirmek istiyor musunuz?')
    if (!confirmed) return
    setError('')
    const res = await api(`/api/canteen/branches/${id}/status`, {
      method: 'PUT',
      data: { isActive: nextActive },
      silent: true,
    })
    if (!res?.ok) {
      setError(res?.message || 'Şube durumu güncellenemedi.')
      return
    }
    await load()
  }

  const openStaffModal = async (branch) => {
    const id = String(branch?.id || '')
    if (!id) return
    setOpenStaff(true)
    setStaffBranchId(id)
    setStaffBranchName(String(branch?.name || ''))
    setStaffLoading(true)
    setError('')
    try {
      const res = await api(`/api/canteen/branches/${id}/staff`, { silent: true })
      setStaffList(Array.isArray(res?.staff) ? res.staff : [])
      setAssignedStaffIds(Array.isArray(res?.assignedStaffIds) ? res.assignedStaffIds.map(String) : [])
    } finally {
      setStaffLoading(false)
    }
  }

  const saveStaff = async () => {
    if (!staffBranchId) return
    setStaffLoading(true)
    setError('')
    try {
      const res = await api(`/api/canteen/branches/${staffBranchId}/staff`, {
        method: 'PUT',
        data: { staffIds: assignedStaffIds },
        silent: true,
      })
      if (!res?.ok) {
        setError(res?.message || 'Personel atamaları kaydedilemedi.')
        return
      }
      setStaffList(Array.isArray(res?.staff) ? res.staff : [])
      setAssignedStaffIds(Array.isArray(res?.assignedStaffIds) ? res.assignedStaffIds.map(String) : [])
    } finally {
      setStaffLoading(false)
    }
  }

  const filteredStaff = useMemo(() => {
    const query = String(staffQuery || '').toLowerCase().trim()
    if (!query) return staffList
    return staffList.filter((item) => String(item?.name || '').toLowerCase().includes(query) || String(item?.email || '').toLowerCase().includes(query))
  }, [staffList, staffQuery])

  return (
    <CanteenSettingsSection
      badge="Şube Yönetimi"
      title="Şubeleri modern kart düzeniyle yönetin"
      description="Şube oluşturma, pasife alma ve personele erişim atama işlemlerini restoran tarafındaki daha düzenli görünüm mantığıyla tek yerden yönetin."
      stats={stats}
      actions={
        <>
          <button className="btn btn--primary" type="button" onClick={() => setOpenCreate(true)}>+ Yeni Şube</button>
          <button className="btn" type="button" onClick={load} disabled={loading}>{loading ? 'Yükleniyor...' : 'Yenile'}</button>
        </>
      }
    >
      {error ? <CanteenSettingsCard style={{ padding: 16, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</CanteenSettingsCard> : null}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {items.map((branch) => (
          <CanteenSettingsCard key={branch.id} style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--app-text)', overflowWrap: 'anywhere' }}>{branch.name}</div>
                <div style={{ marginTop: 6, color: 'var(--app-text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
                  {String(branch.description || '').trim() || 'Bu şube için henüz açıklama girilmedi.'}
                </div>
              </div>
              <span
                style={{
                  borderRadius: 999,
                  padding: '7px 12px',
                  fontSize: 12,
                  fontWeight: 900,
                  background: branch.isActive === false ? 'rgba(148, 163, 184, 0.18)' : 'var(--theme-accent-soft)',
                  color: branch.isActive === false ? 'var(--app-text-secondary)' : 'var(--theme-accent-text)',
                  whiteSpace: 'nowrap',
                }}
              >
                {branch.isActive === false ? 'Pasif' : 'Aktif'}
              </span>
            </div>

            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <div style={{ borderRadius: 16, background: 'var(--theme-accent-soft)', padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--theme-accent-text)', fontWeight: 800 }}>Durum</div>
                <div style={{ marginTop: 5, fontWeight: 900 }}>{branch.isActive === false ? 'Kapalı' : 'Açık'}</div>
              </div>
              <div style={{ borderRadius: 16, background: 'var(--theme-accent-soft)', padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--theme-accent-text)', fontWeight: 800 }}>Personel</div>
                <div style={{ marginTop: 5, fontWeight: 900 }}>Atanabilir</div>
              </div>
              <div style={{ borderRadius: 16, background: 'var(--theme-accent-soft)', padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--theme-accent-text)', fontWeight: 800 }}>Kayıt</div>
                <div style={{ marginTop: 5, fontWeight: 900 }}>{branch.id ? 'Hazır' : 'Taslak'}</div>
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button className="btn" type="button" onClick={() => openEditModal(branch)}>Düzenle</button>
              <button className="btn btn--primary" type="button" onClick={() => openStaffModal(branch)}>Personel Ata</button>
              <button className={branch.isActive === false ? 'btn btn--primary' : 'btn btn--danger'} type="button" onClick={() => toggleStatus(branch)}>
                {branch.isActive === false ? 'Aktifleştir' : 'Pasifleştir'}
              </button>
            </div>
          </CanteenSettingsCard>
        ))}
      </div>

      {!loading && items.length === 0 ? <CanteenSettingsCard style={{ padding: 18 }}>Henüz şube kaydı bulunmuyor.</CanteenSettingsCard> : null}

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Yeni Şube Oluştur">
        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şube adı</div>
            <input className="input" value={createName} onChange={(event) => setCreateName(event.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Açıklama</div>
            <input className="input" value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" type="button" onClick={() => setOpenCreate(false)}>Vazgeç</button>
            <button className="btn btn--primary" type="button" onClick={submitCreate} disabled={!String(createName || '').trim()}>Kaydet</button>
          </div>
        </div>
      </Modal>

      <Modal open={openEdit} onClose={() => setOpenEdit(false)} title="Şube Düzenle">
        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şube adı</div>
            <input className="input" value={editName} onChange={(event) => setEditName(event.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Açıklama</div>
            <input className="input" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" type="button" onClick={() => setOpenEdit(false)}>Vazgeç</button>
            <button className="btn btn--primary" type="button" onClick={submitEdit} disabled={!String(editName || '').trim()}>Kaydet</button>
          </div>
        </div>
      </Modal>

      <Modal open={openStaff} onClose={() => setOpenStaff(false)} title={staffBranchName ? `${staffBranchName} · Personel Atamaları` : 'Personel Atamaları'}>
        <div style={{ display: 'grid', gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ara</div>
            <input className="input" value={staffQuery} onChange={(event) => setStaffQuery(event.target.value)} placeholder="İsim veya e-posta" />
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            {staffLoading ? <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div> : null}
            {!staffLoading && filteredStaff.map((staff) => {
              const id = String(staff.id)
              const checked = assignedStaffIds.includes(id)
              return (
                <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 16 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setAssignedStaffIds((current) => {
                        const next = new Set((current || []).map(String))
                        if (next.has(id)) next.delete(id)
                        else next.add(id)
                        return Array.from(next)
                      })
                    }}
                    disabled={staffLoading}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{staff.name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 13, overflowWrap: 'anywhere' }}>{staff.email}</div>
                    {staff.isActive === false ? <div style={{ color: '#ef4444', fontSize: 12 }}>Pasif personel</div> : null}
                  </div>
                </label>
              )
            })}
            {!staffLoading && filteredStaff.length === 0 ? <div style={{ color: 'var(--muted)' }}>Eşleşen personel bulunamadı.</div> : null}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" type="button" onClick={() => setOpenStaff(false)}>Kapat</button>
            <button className="btn btn--primary" type="button" onClick={saveStaff} disabled={staffLoading}>Atamaları Kaydet</button>
          </div>
        </div>
      </Modal>
    </CanteenSettingsSection>
  )
}
