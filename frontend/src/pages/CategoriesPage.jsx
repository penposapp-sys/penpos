import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient.js'
import Modal from '../components/Modal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { SettingsToggle, SettingsUiStyles } from '../components/settings/SettingsUi.jsx'
import BranchAccessField from '../components/settings/BranchAccessField.jsx'
import { formatBranchSummary, normalizeBranchIdList } from '../lib/branchVisibility.js'

const isVisibleItem = (item) => item?.isDeleted !== true && item?.status !== 'deleted'

const createVisibilityState = (branchIds = []) => {
  const normalized = normalizeBranchIdList(branchIds)
  return {
    allBranches: normalized.length === 0,
    branchIds: normalized
  }
}

const buildCategoryPayload = (form) => ({
  name: form.name,
  sortOrder: Number(form.sortOrder) || 0,
  allBranches: form.visibility?.allBranches !== false,
  branchIds: form.visibility?.allBranches ? [] : normalizeBranchIdList(form.visibility?.branchIds)
})

export default function CategoriesPage() {
  const [items, setItems] = useState([])
  const [branches, setBranches] = useState([])
  const [q, setQ] = useState('')
  const [active, setActive] = useState('all')
  const [branchFilter, setBranchFilter] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [createForm, setCreateForm] = useState({ name: '', sortOrder: 0, visibility: createVisibilityState([]) })
  const [editForm, setEditForm] = useState({ name: '', sortOrder: 0, isActive: true, visibility: createVisibilityState([]) })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const branchNameById = useMemo(
    () => Object.fromEntries((branches || []).map((branch) => [String(branch?._id || branch?.id || ''), branch?.name || '-'])),
    [branches]
  )

  const loadBranches = async () => {
    const response = await api('/api/branches', { skipBranchHeader: true })
    const nextBranches = Array.isArray(response?.branches) ? response.branches : []
    setBranches(nextBranches.filter((branch) => branch?.isActive !== false && isVisibleItem(branch)))
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams()
      if (q) query.set('q', q)
      if (active !== 'all') query.set('active', active)
      if (branchFilter) query.set('branchId', branchFilter)
      const suffix = query.toString()
      const response = await api(`/api/tenant/categories${suffix ? `?${suffix}` : ''}`, { skipBranchHeader: true })
      setItems((Array.isArray(response?.categories) ? response.categories : []).filter(isVisibleItem))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadAll = async () => {
      await loadBranches()
      await load()
    }
    loadAll()
  }, [])

  const onSearch = async (event) => {
    event.preventDefault()
    await load()
  }

  const openCreate = () => {
    setCreateForm({ name: '', sortOrder: 0, visibility: createVisibilityState([]) })
    setFormError('')
    setCreateOpen(true)
  }

  const onCreate = async (event) => {
    event.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const { category } = await api('/api/tenant/categories', {
        method: 'POST',
        body: JSON.stringify(buildCategoryPayload(createForm)),
        skipBranchHeader: true
      })
      if (category && isVisibleItem(category)) {
        await load()
      }
      setCreateOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openEdit = (category) => {
    setSelected(category)
    setEditForm({
      name: category.name,
      sortOrder: category.sortOrder,
      isActive: category.isActive !== false,
      visibility: createVisibilityState(category.branchIds)
    })
    setFormError('')
    setEditOpen(true)
  }

  const onEdit = async (event) => {
    event.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const payload = { ...buildCategoryPayload(editForm), isActive: !!editForm.isActive }
      const { category } = await api(`/api/tenant/categories/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        skipBranchHeader: true
      })
      setItems((prev) => prev.map((item) => (item.id === category.id ? category : item)).filter(isVisibleItem))
      setEditOpen(false)
      await load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openDeleteConfirm = (category) => {
    setDeleteTarget(category)
  }

  const onDelete = async () => {
    const category = deleteTarget
    if (!category) return
    setDeleteLoading(true)
    try {
      await api(`/api/tenant/categories/${category.id}`, { method: 'DELETE', skipBranchHeader: true })
      setItems((prev) => prev.filter((item) => item.id !== category.id))
      setDeleteTarget(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  const branchSummary = (item) => formatBranchSummary(item?.branchIds, branchNameById)

  return (
    <div>
      <SettingsUiStyles />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Kategoriler</h3>
        <button className="btn" onClick={openCreate}>Yeni Kategori</button>
      </div>

      <form onSubmit={onSearch} className="desktop-only" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select className="input" style={{ width: 200 }} value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
          <option value="">Tüm Şubeler</option>
          {branches.map((branch) => <option key={branch._id || branch.id} value={branch._id || branch.id}>{branch.name}</option>)}
        </select>
        <input className="input" placeholder="Ara" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className="input" style={{ width: 160 }} value={active} onChange={(event) => setActive(event.target.value)}>
          <option value="all">Tümü</option>
          <option value="true">Aktif</option>
          <option value="false">Pasif</option>
        </select>
        <button className="btn">Ara</button>
      </form>

      <form onSubmit={onSearch} className="mobile-only mobile-filters" style={{ marginBottom: 12 }}>
        <select className="input" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
          <option value="">Tüm Şubeler</option>
          {branches.map((branch) => <option key={branch._id || branch.id} value={branch._id || branch.id}>{branch.name}</option>)}
        </select>
        <input className="input" placeholder="Ara" value={q} onChange={(event) => setQ(event.target.value)} />
        <div className="mobile-filter-actions">
          <select className="input" value={active} onChange={(event) => setActive(event.target.value)}>
            <option value="all">Tümü</option>
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </select>
          <button className="btn">Ara</button>
        </div>
      </form>

      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}

      {loading ? 'Yükleniyor...' : items.length === 0 ? (
        <div>Henüz kategori yok. “Yeni Kategori” ile ekleyin.</div>
      ) : (
        <>
          <div className="desktop-only">
            <table className="table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Şubeler</th>
                  <th>Durum</th>
                  <th>Sıra</th>
                  <th className="actions" style={{ width: 240 }}>Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {items.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td style={{ minWidth: 220 }}>{branchSummary(category)}</td>
                    <td>{category.isActive ? 'Aktif' : 'Pasif'}</td>
                    <td>{category.sortOrder}</td>
                    <td className="actions">
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" type="button" onClick={() => openEdit(category)}>Düzenle</button>
                        <button className="settings-ui-btn-danger" type="button" onClick={() => openDeleteConfirm(category)}>Sil</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mobile-only settings-mobile">
            {items.map((category) => (
              <div key={category.id} className="mobile-list-item">
                <div className="mobile-item-title breakAny">{category.name}</div>
                <div className="mobile-item-meta">
                  <span className="breakAny">Şubeler: {branchSummary(category)}</span>
                  <span>Durum: {category.isActive ? 'Aktif' : 'Pasif'}</span>
                  <span>Sıra: {category.sortOrder}</span>
                </div>
                <div className="mobile-actions-row">
                  <button className="btn" type="button" onClick={() => openEdit(category)}>Düzenle</button>
                  <button className="settings-ui-btn-danger" type="button" onClick={() => openDeleteConfirm(category)}>Sil</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Kategori">
        <form onSubmit={onCreate} style={{ display: 'grid', gap: 10 }}>
          <BranchAccessField
            label="Şube Seçimi"
            hint="Kategoriyi bir veya birden fazla şubeye bağlayabilirsiniz. Şube seçilmezse kategori tüm şubelerde geçerli kabul edilir."
            branches={branches}
            value={createForm.visibility}
            onChange={(visibility) => setCreateForm({ ...createForm, visibility })}
            allLabel="Tüm Şubelerde Geçerli"
          />
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sıra</div>
            <input className="input" type="number" value={createForm.sortOrder} onChange={(event) => setCreateForm({ ...createForm, sortOrder: event.target.value })} />
          </label>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Oluştur'}</button>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Kategori Düzenle">
        <form onSubmit={onEdit} style={{ display: 'grid', gap: 10 }}>
          <BranchAccessField
            label="Şube Seçimi"
            hint="Bu kategori sadece seçilen şubelerde görünür."
            branches={branches}
            value={editForm.visibility}
            onChange={(visibility) => setEditForm({ ...editForm, visibility })}
            allLabel="Tüm Şubelerde Geçerli"
          />
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sıra</div>
            <input className="input" type="number" value={editForm.sortOrder} onChange={(event) => setEditForm({ ...editForm, sortOrder: event.target.value })} />
          </label>
          <SettingsToggle label="Aktif" checked={!!editForm.isActive} onChange={(event) => setEditForm({ ...editForm, isActive: event.target.checked })} />
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Kaydet'}</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Kategoriyi Listeden Kaldır"
        message="Bu kategori aktif listeden kaldırılacak. Bu kategoriye ait geçmiş satış ve rapor kayıtları korunacaktır. Devam etmek istiyor musunuz?"
        confirmText="Kategoriyi Sil"
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
