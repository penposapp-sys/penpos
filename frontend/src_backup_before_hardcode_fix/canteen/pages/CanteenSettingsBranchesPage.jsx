import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/apiClient.js'
import Modal from '../../components/Modal.jsx'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'

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

  const load = async () => {
    setLoading(true)
    setError('')
    const res = await api('/api/canteen/branches', { silent: true })
    setItems(Array.isArray(res?.branches) ? res.branches : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const submitCreate = async () => {
    setError('')
    const name = String(createName || '').trim()
    if (!name) return
    const res = await api('/api/canteen/branches', { method: 'POST', data: { name, description: String(createDescription || '').trim() }, silent: true })
    if (!res?.ok) return setError(res?.message || 'Şube eklenemedi')
    setOpenCreate(false)
    setCreateName('')
    setCreateDescription('')
    load()
  }

  const openEditModal = (b) => {
    setEditId(String(b?.id || ''))
    setEditName(String(b?.name || ''))
    setEditDescription(String(b?.description || ''))
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
      silent: true
    })
    if (!res?.ok) return setError(res?.message || 'Güncellenemedi')
    setOpenEdit(false)
    load()
  }

  const toggleStatus = async (b) => {
    const id = String(b?.id || '')
    if (!id) return
    const next = b?.isActive === false
    const ok = window.confirm(next ? 'Şubeyi aktifleştirmek istiyor musun?' : 'Şubeyi pasifleştirmek istiyor musun?')
    if (!ok) return
    setError('')
    const res = await api(`/api/canteen/branches/${id}/status`, { method: 'PUT', data: { isActive: next }, silent: true })
    if (!res?.ok) return setError(res?.message || 'Güncellenemedi')
    load()
  }

  const openStaffModal = async (b) => {
    const id = String(b?.id || '')
    if (!id) return
    setOpenStaff(true)
    setStaffBranchId(id)
    setStaffBranchName(String(b?.name || ''))
    setStaffLoading(true)
    setError('')
    const res = await api(`/api/canteen/branches/${id}/staff`, { silent: true })
    setStaffList(Array.isArray(res?.staff) ? res.staff : [])
    setAssignedStaffIds(Array.isArray(res?.assignedStaffIds) ? res.assignedStaffIds.map(String) : [])
    setStaffLoading(false)
  }

  const saveStaff = async () => {
    if (!staffBranchId) return
    setStaffLoading(true)
    setError('')
    const res = await api(`/api/canteen/branches/${staffBranchId}/staff`, {
      method: 'PUT',
      data: { staffIds: assignedStaffIds },
      silent: true
    })
    if (!res?.ok) {
      setError(res?.message || 'Kaydedilemedi')
      setStaffLoading(false)
      return
    }
    setStaffList(Array.isArray(res?.staff) ? res.staff : [])
    setAssignedStaffIds(Array.isArray(res?.assignedStaffIds) ? res.assignedStaffIds.map(String) : [])
    setStaffLoading(false)
  }

  const filteredStaff = useMemo(() => {
    const q = String(staffQuery || '').toLowerCase().trim()
    if (!q) return staffList
    return staffList.filter(s => String(s?.name || '').toLowerCase().includes(q) || String(s?.email || '').toLowerCase().includes(q))
  }, [staffList, staffQuery])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Şube Ayarları</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Kantin şubeleri.</div>
        </div>
        <div className="actionWrap">
          <button className="btn btn--primary btn--compact" type="button" onClick={() => setOpenCreate(true)}>+ Yeni Şube</button>
          <button className="btn btn--compact" type="button" onClick={load} disabled={loading}>{loading ? '...' : 'Yenile'}</button>
        </div>
      </div>

      {!!error && <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}

      {isMobilePortrait ? (
        <div className="cardList">
          {items.map(b => (
            <div key={b.id} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="breakAny" style={{ fontWeight: 800 }}>{b.name}</div>
                  {!!String(b.description || '').trim() && <div className="breakAny" style={{ color: 'var(--muted)', marginTop: 4 }}>{b.description}</div>}
                </div>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  border: '1px solid var(--border)',
                  background: b.isActive === false ? '#111827' : '#ecfdf5',
                  color: b.isActive === false ? '#e5e7eb' : '#166534'
                }}>{b.isActive === false ? 'Pasif' : 'Aktif'}</span>
              </div>
              <div className="actionWrap" style={{ marginTop: 10 }}>
                <button className="btn" type="button" onClick={() => openEditModal(b)}>Düzenle</button>
                <button className="btn btn--primary" type="button" onClick={() => openStaffModal(b)}>Personel</button>
                <button className={b.isActive === false ? 'btn btn--primary' : 'btn btn--danger'} type="button" onClick={() => toggleStatus(b)}>
                  {b.isActive === false ? 'Aktifleştir' : 'Pasifleştir'}
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12 }}>Ad</th>
                <th style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12 }}>Açıklama</th>
                <th style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12, width: 120 }}>Durum</th>
                <th style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 12, width: 320 }}>Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {items.map(b => (
                <tr key={b.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 800 }}>{b.name}</div>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--muted)' }}>{b.description || ''}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      border: '1px solid var(--border)',
                      background: b.isActive === false ? '#111827' : '#ecfdf5',
                      color: b.isActive === false ? '#e5e7eb' : '#166534'
                    }}>{b.isActive === false ? 'Pasif' : 'Aktif'}</span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn--compact" type="button" onClick={() => openEditModal(b)}>Düzenle</button>
                      <button className="btn btn--primary btn--compact" type="button" onClick={() => openStaffModal(b)}>Personel</button>
                      <button className={b.isActive === false ? 'btn btn--primary btn--compact' : 'btn btn--danger btn--compact'} type="button" onClick={() => toggleStatus(b)}>
                        {b.isActive === false ? 'Aktifleştir' : 'Pasifleştir'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 16, color: 'var(--muted)' }}>Kayıt yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Yeni Şube">
        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={createName} onChange={(e) => setCreateName(e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Açıklama</div>
            <input className="input" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} />
          </label>
          <div className="actionWrap" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={() => setOpenCreate(false)}>Vazgeç</button>
            <button className="btn btn--primary" type="button" onClick={submitCreate} disabled={!String(createName || '').trim()}>Kaydet</button>
          </div>
        </div>
      </Modal>

      <Modal open={openEdit} onClose={() => setOpenEdit(false)} title="Şube Düzenle">
        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Açıklama</div>
            <input className="input" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          </label>
          <div className="actionWrap" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={() => setOpenEdit(false)}>Vazgeç</button>
            <button className="btn btn--primary" type="button" onClick={submitEdit} disabled={!String(editName || '').trim()}>Kaydet</button>
          </div>
        </div>
      </Modal>

      <Modal open={openStaff} onClose={() => setOpenStaff(false)} title={staffBranchName ? `${staffBranchName} • Personel` : 'Personel'}>
        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ara</div>
            <input className="input" value={staffQuery} onChange={(e) => setStaffQuery(e.target.value)} placeholder="İsim veya email" />
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            {staffLoading && <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>}
            {!staffLoading && filteredStaff.map(s => {
              const id = String(s.id)
              const checked = assignedStaffIds.includes(id)
              return (
                <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 12 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setAssignedStaffIds(prev => {
                        const next = new Set((prev || []).map(String))
                        if (next.has(id)) next.delete(id)
                        else next.add(id)
                        return Array.from(next)
                      })
                    }}
                    disabled={staffLoading}
                  />
                  <div style={{ display: 'grid', gap: 2 }}>
                    <div style={{ fontWeight: 800 }}>{s.name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>{s.email}</div>
                    {s.isActive === false && <div style={{ color: '#ef4444', fontSize: 12 }}>Pasif</div>}
                  </div>
                </label>
              )
            })}
            {!staffLoading && filteredStaff.length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
          </div>
          <div className="actionWrap" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={() => setOpenStaff(false)}>Kapat</button>
            <button className="btn btn--primary" type="button" onClick={saveStaff} disabled={staffLoading}>Kaydet</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
