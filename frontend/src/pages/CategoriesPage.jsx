import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import Modal from '../components/Modal.jsx'

export default function CategoriesPage() {
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [active, setActive] = useState('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [createForm, setCreateForm] = useState({ name: '', sortOrder: 0 })
  const [editForm, setEditForm] = useState({ name: '', sortOrder: 0, isActive: true })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams()
      if (q) query.set('q', q)
      if (active !== 'all') query.set('active', active)
      const { categories } = await api(`/api/tenant/categories?${query.toString()}`)
      setItems(categories)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const onSearch = async (e) => {
    e.preventDefault()
    await load()
  }

  const openCreate = () => {
    setCreateForm({ name: '', sortOrder: 0 })
    setFormError('')
    setCreateOpen(true)
  }
  const onCreate = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const { category } = await api('/api/tenant/categories', { method: 'POST', body: JSON.stringify(createForm) })
      setItems([category, ...items])
      setCreateOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openEdit = (c) => {
    setSelected(c)
    setEditForm({ name: c.name, sortOrder: c.sortOrder, isActive: c.isActive })
    setFormError('')
    setEditOpen(true)
  }
  const onEdit = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const { category } = await api(`/api/tenant/categories/${selected.id}`, { method: 'PUT', body: JSON.stringify(editForm) })
      setItems(items.map(i => i.id === category.id ? category : i))
      setEditOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const onDelete = async (c) => {
    try {
      await api(`/api/tenant/categories/${c.id}`, { method: 'DELETE' })
      setItems(items.map(i => i.id === c.id ? { ...i, isActive: false } : i))
    } catch (err) {
      if (err.code === 'category_has_items') {
        setError('Bu kategoriye bağlı ürünler var. Önce ürünleri silin.')
      } else {
        setError(err.message)
      }
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Kategoriler</h3>
        <button className="btn" onClick={openCreate}>Yeni Kategori</button>
      </div>
      <form onSubmit={onSearch} className="desktop-only" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input className="input" placeholder="Ara" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ width: 160 }} value={active} onChange={(e) => setActive(e.target.value)}>
          <option value="all">Tümü</option>
          <option value="true">Aktif</option>
          <option value="false">Pasif</option>
        </select>
        <button className="btn">Ara</button>
      </form>

      <form onSubmit={onSearch} className="mobile-only mobile-filters" style={{ marginBottom: 12 }}>
        <input className="input" placeholder="Ara" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mobile-filter-actions">
          <select className="input" value={active} onChange={(e) => setActive(e.target.value)}>
            <option value="all">Tümü</option>
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </select>
          <button className="btn">Ara</button>
        </div>
      </form>
      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
      {loading ? 'Yükleniyor...' : (
        items.length === 0 ? (
          <div>Henüz kategori yok. “Yeni Kategori” ile ekleyin.</div>
        ) : (
          <>
            <div className="desktop-only">
              <table className="table">
                <thead>
                  <tr><th>Ad</th><th>Durum</th><th>Sort</th><th className="actions" style={{ width: 240 }}>Aksiyon</th></tr>
                </thead>
                <tbody>
                  {items.map(c => {
                    const statusLabel = c.isActive ? 'Aktif' : 'Pasif'
                    return (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{statusLabel}</td>
                        <td>{c.sortOrder}</td>
                        <td className="actions">
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn" onClick={() => openEdit(c)}>Düzenle</button>
                            <button className="btn" onClick={() => onDelete(c)}>Sil</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-only settings-mobile">
              {(items || []).map(c => {
                const statusLabel = c.isActive ? 'Aktif' : 'Pasif'
                return (
                  <div key={c.id} className="mobile-list-item">
                    <div className="mobile-item-title breakAny">{c.name}</div>
                    <div className="mobile-item-meta">
                      <span>Durum: {statusLabel}</span>
                      <span>Sort: {c.sortOrder}</span>
                    </div>
                    <div className="mobile-actions-row">
                      <button className="btn" type="button" onClick={() => openEdit(c)}>Düzenle</button>
                      <button className="btn" type="button" onClick={() => onDelete(c)}>Sil</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Kategori">
        <form onSubmit={onCreate} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sort</div>
            <input className="input" type="number" value={createForm.sortOrder} onChange={(e) => setCreateForm({ ...createForm, sortOrder: Number(e.target.value) })} />
          </label>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Oluştur'}</button>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Kategori Düzenle">
        <form onSubmit={onEdit} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sort</div>
            <input className="input" type="number" value={editForm.sortOrder} onChange={(e) => setEditForm({ ...editForm, sortOrder: Number(e.target.value) })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
            Aktif
          </label>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Kaydet'}</button>
        </form>
      </Modal>
    </div>
  )
}
