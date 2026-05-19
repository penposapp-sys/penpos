import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import Modal from '../components/Modal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { toast } from '../lib/toast.js'
import { SettingsField, SettingsToggle, SettingsUiStyles } from '../components/settings/SettingsUi.jsx'

const isVisibleItem = (item) => item?.isDeleted !== true && item?.status !== 'deleted'

export default function BranchesPage() {
  const getBranchId = (branch) => branch?._id || branch?.id

  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [createForm, setCreateForm] = useState({ name: '', description: '', address: '' })
  const [editForm, setEditForm] = useState({ name: '', description: '', address: '', isActive: true })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api('/api/branches', { skipBranchHeader: true })
      const branches = Array.isArray(res?.branches) ? res.branches : []
      setItems(
        branches
          .filter(isVisibleItem)
          .map((branch) => ({
            ...branch,
            isActive: branch?.isActive !== false,
            description: branch?.description || '',
            address: branch?.address || ''
          }))
      )
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
    setCreateForm({ name: '', description: '', address: '' })
    setFormError('')
    setCreateOpen(true)
  }

  const onCreate = async (event) => {
    event.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const { branch } = await api('/api/branches', {
        method: 'POST',
        body: JSON.stringify(createForm),
        skipBranchHeader: true
      })
      if (branch && isVisibleItem(branch)) {
        setItems((prev) => [{ ...branch, description: branch?.description || '', address: branch?.address || '' }, ...prev])
      }
      setCreateOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openEdit = (branch) => {
    setSelected(branch)
    setEditForm({
      name: branch?.name || '',
      description: branch?.description || '',
      address: branch?.address || '',
      isActive: branch?.isActive !== false
    })
    setFormError('')
    setEditOpen(true)
  }

  const onEdit = async (event) => {
    event.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const branchId = getBranchId(selected)
      if (!branchId) {
        toast.error('Şube kaydı bulunamadı.')
        return
      }
      const { branch } = await api(`/api/branches/${branchId}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
        skipBranchHeader: true
      })
      if (branch) {
        setItems((prev) => prev.map((item) => (String(getBranchId(item)) === String(getBranchId(branch)) ? branch : item)).filter(isVisibleItem))
      }
      setEditOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openDeleteConfirm = (branch) => {
    setDeleteTarget(branch)
  }

  const onDelete = async () => {
    const branch = deleteTarget
    if (!branch) return
    const branchId = getBranchId(branch)
    if (!branchId) {
      toast.error('Şube kaydı bulunamadı.')
      return
    }
    setDeleteLoading(true)
    try {
      await api(`/api/branches/${branchId}`, { method: 'DELETE', skipBranchHeader: true })
      setItems((prev) => prev.filter((item) => String(getBranchId(item)) !== String(branchId)))
      setDeleteTarget(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div>
      <SettingsUiStyles />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Şubeler</h3>
        <button className="btn" onClick={openCreate}>Yeni Şube</button>
      </div>

      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}

      {loading ? 'Yükleniyor...' : items.length === 0 ? (
        <div>Henüz şube yok. Başlamak için “Yeni Şube” ekleyin.</div>
      ) : (
        <>
          <div className="desktop-only">
            <table className="table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Açıklama</th>
                  <th>Adres</th>
                  <th>Durum</th>
                  <th className="actions" style={{ width: 240 }}>Aksiyonlar</th>
                </tr>
              </thead>
              <tbody>
                {items.map((branch) => {
                  const branchId = getBranchId(branch)
                  return (
                    <tr key={branchId || branch.name}>
                      <td>{branch.name}</td>
                      <td>{branch.description || '-'}</td>
                      <td>{branch.address || '-'}</td>
                      <td>{branch.isActive ? 'Aktif' : 'Pasif'}</td>
                      <td className="actions">
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="btn" type="button" onClick={() => openEdit(branch)}>Düzenle</button>
                          <button className="settings-ui-btn-danger" type="button" onClick={() => openDeleteConfirm(branch)}>Sil</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mobile-only settings-mobile">
            {items.map((branch) => {
              const branchId = getBranchId(branch)
              return (
                <div key={branchId || branch.name} className="mobile-list-item">
                  <div className="mobile-item-title breakAny">{branch.name}</div>
                  <div className="mobile-item-meta">
                    {!!String(branch.description || '').trim() && <span className="breakAny">Açıklama: {branch.description}</span>}
                    {!!String(branch.address || '').trim() && <span className="breakAny">Adres: {branch.address}</span>}
                    <span>Durum: {branch.isActive ? 'Aktif' : 'Pasif'}</span>
                  </div>
                  <div className="mobile-actions-row">
                    <button className="btn" type="button" onClick={() => openEdit(branch)}>Düzenle</button>
                    <button className="settings-ui-btn-danger" type="button" onClick={() => openDeleteConfirm(branch)}>Sil</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Şube">
        <form onSubmit={onCreate} style={{ display: 'grid', gap: 12 }}>
          <SettingsField label="Ad">
            <input className="settings-ui-input" value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} />
          </SettingsField>
          <SettingsField label="Açıklama">
            <input className="settings-ui-input" value={createForm.description} onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })} />
          </SettingsField>
          <SettingsField label="Adres">
            <textarea className="settings-ui-textarea" rows="3" value={createForm.address} onChange={(event) => setCreateForm({ ...createForm, address: event.target.value })} />
          </SettingsField>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Oluştur'}</button>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Şube Düzenle">
        <form onSubmit={onEdit} style={{ display: 'grid', gap: 12 }}>
          <SettingsField label="Ad">
            <input className="settings-ui-input" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
          </SettingsField>
          <SettingsField label="Açıklama">
            <input className="settings-ui-input" value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} />
          </SettingsField>
          <SettingsField label="Adres">
            <textarea className="settings-ui-textarea" rows="3" value={editForm.address} onChange={(event) => setEditForm({ ...editForm, address: event.target.value })} />
          </SettingsField>
          <SettingsToggle label="Aktif" checked={!!editForm.isActive} onChange={(event) => setEditForm({ ...editForm, isActive: event.target.checked })} />
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Kaydet'}</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Şubeyi Listeden Kaldır"
        message="Bu şube aktif listeden kaldırılacak. Geçmiş satış ve raporlardaki şube adı korunacaktır. Devam etmek istiyor musunuz?"
        confirmText="Şubeyi Sil"
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
