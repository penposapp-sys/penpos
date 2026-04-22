import React, { useEffect, useState } from 'react'
import { api } from '../lib/apiClient.js'
import Modal from '../components/Modal.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function MenuItemsPage() {
  const { tenantCtx } = useAuth()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [q, setQ] = useState('')
  const [active, setActive] = useState('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [createForm, setCreateForm] = useState({ categoryId: '', name: '', price: 0, description: '', imageUrl: '', sortOrder: 0 })
  const [editForm, setEditForm] = useState({ categoryId: '', name: '', price: 0, description: '', imageUrl: '', sortOrder: 0, isActive: true })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [inlineSaving, setInlineSaving] = useState({})
  const [inlineDrafts, setInlineDrafts] = useState({})
  const isExpired = tenantCtx?.tenant?.plan?.status === 'expired'

  const loadCategories = async () => {
    const { categories } = await api('/api/tenant/categories?active=true')
    setCategories(categories)
  }

  const loadItems = async () => {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams()
      if (categoryId) query.set('categoryId', categoryId)
      if (q) query.set('q', q)
      if (active !== 'all') query.set('active', active)
      const { items } = await api(`/api/tenant/menu-items?${query.toString()}`)
      setItems(items)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCategories(); loadItems() }, [])

  const onSearch = async (e) => {
    e.preventDefault()
    await loadItems()
  }

  const openCreate = () => {
    setCreateForm({ categoryId: categories[0]?.id || '', name: '', price: 0, description: '', imageUrl: '', sortOrder: 0 })
    setFormError('')
    setCreateOpen(true)
  }
  const onCreate = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const { item } = await api('/api/tenant/menu-items', { method: 'POST', body: JSON.stringify(createForm) })
      setItems([item, ...items])
      setCreateOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }
  const onCreateKeepOpen = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const { item } = await api('/api/tenant/menu-items', { method: 'POST', body: JSON.stringify(createForm) })
      setItems([item, ...items])
      setCreateForm({ categoryId: categories[0]?.id || '', name: '', price: 0, description: '', imageUrl: '', sortOrder: 0 })
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const openEdit = (i) => {
    setSelected(i)
    setEditForm({ categoryId: i.categoryId, name: i.name, price: i.price, description: i.description || '', imageUrl: i.imageUrl || '', sortOrder: i.sortOrder, isActive: i.isActive })
    setFormError('')
    setEditOpen(true)
  }
  const onEdit = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const { item } = await api(`/api/tenant/menu-items/${selected.id}`, { method: 'PUT', body: JSON.stringify(editForm) })
      setItems(items.map(it => it.id === item.id ? item : it))
      setEditOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const onDelete = async (i) => {
    try {
      const result = await api(`/api/tenant/menu-items/${i.id}`, { method: 'DELETE' })
      setItems(items.map(it => it.id === i.id ? { ...it, isActive: result.isActive } : it))
    } catch (err) {
      setError(err.message)
    }
  }

  const catName = (id) => categories.find(c => c.id === id)?.name || ''

  const getInlineDraft = (item) => {
    const key = String(item?.id || '')
    const draft = inlineDrafts[key] || {}
    return {
      price: draft.price ?? String(item?.price ?? ''),
      isActive: draft.isActive ?? !!item?.isActive
    }
  }

  const setInlineDraftValue = (itemId, patch) => {
    const key = String(itemId || '')
    setInlineDrafts(prev => ({
      ...(prev || {}),
      [key]: {
        ...(prev?.[key] || {}),
        ...patch
      }
    }))
  }

  const updateInlineItem = async (item, patch) => {
    const itemId = String(item?.id || '')
    if (!itemId) return
    setInlineSaving(prev => ({ ...(prev || {}), [itemId]: true }))
    setError('')
    try {
      const payload = {
        categoryId: item.categoryId,
        name: item.name,
        price: patch.price ?? item.price,
        description: item.description || '',
        imageUrl: item.imageUrl || '',
        sortOrder: item.sortOrder ?? 0,
        isActive: patch.isActive ?? item.isActive
      }
      const { item: updated } = await api(`/api/tenant/menu-items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
      setItems(prev => prev.map(it => it.id === updated.id ? updated : it))
      setInlineDrafts(prev => ({
        ...(prev || {}),
        [itemId]: {
          price: String(updated.price ?? ''),
          isActive: !!updated.isActive
        }
      }))
    } catch (err) {
      setError(err.message)
      setInlineDrafts(prev => ({
        ...(prev || {}),
        [itemId]: {
          price: String(item?.price ?? ''),
          isActive: !!item?.isActive
        }
      }))
    } finally {
      setInlineSaving(prev => ({ ...(prev || {}), [itemId]: false }))
    }
  }

  const commitInlinePrice = async (item) => {
    const draft = getInlineDraft(item)
    const normalized = String(draft.price || '').replace(',', '.').trim()
    const nextPrice = Number(normalized)
    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      setError('Fiyat 0 veya daha büyük bir sayı olmalı')
      setInlineDraftValue(item.id, { price: String(item?.price ?? '') })
      return
    }
    if (Number(nextPrice) === Number(item?.price ?? 0)) return
    await updateInlineItem(item, { price: nextPrice })
  }

  const toggleInlineStatus = async (item, nextIsActive) => {
    setInlineDraftValue(item.id, { isActive: !!nextIsActive })
    if (Boolean(item?.isActive) === Boolean(nextIsActive)) return
    await updateInlineItem(item, { isActive: !!nextIsActive })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Ürünler</h3>
        <button className="btn" onClick={openCreate} disabled={isExpired} title={isExpired ? 'Paket süreniz doldu. Plan yükseltin.' : undefined}>Yeni Ürün</button>
      </div>
      <form onSubmit={onSearch} className="desktop-only" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select className="input" style={{ width: 200 }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Tüm Kategoriler</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="input" placeholder="Ara" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ width: 160 }} value={active} onChange={(e) => setActive(e.target.value)}>
          <option value="all">Tümü</option>
          <option value="true">Aktif</option>
          <option value="false">Pasif</option>
        </select>
        <button className="btn">Ara</button>
      </form>

      <form onSubmit={onSearch} className="mobile-only mobile-filters" style={{ marginBottom: 12 }}>
        <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Tüm Kategoriler</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={active} onChange={(e) => setActive(e.target.value)}>
          <option value="all">Tümü</option>
          <option value="true">Aktif</option>
          <option value="false">Pasif</option>
        </select>
        <input className="input" placeholder="Ara" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn">Ara</button>
      </form>
      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
      {loading ? 'Yükleniyor...' : (
        items.length === 0 ? (
          <div>Henüz ürün yok. “Yeni Ürün” ile ekleyin.</div>
        ) : (
          <>
            <div className="desktop-only">
              <table className="table">
                <thead>
                  <tr><th>Ürün</th><th>Kategori</th><th>Fiyat</th><th>Durum</th><th className="actions" style={{ width: 300 }}>Aksiyon</th></tr>
                </thead>
                <tbody>
                  {items.map(i => {
                    const categoryLabel = catName(i.categoryId)
                    const draft = getInlineDraft(i)
                    const isSaving = !!inlineSaving[String(i.id)]
                    return (
                      <tr key={i.id}>
                        <td>{i.name}</td>
                        <td>{categoryLabel}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              className="input"
                              type="number"
                              min="0"
                              step="0.01"
                              style={{ width: 120 }}
                              value={draft.price}
                              onChange={(e) => setInlineDraftValue(i.id, { price: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  commitInlinePrice(i)
                                  e.currentTarget.blur()
                                }
                              }}
                              onBlur={() => commitInlinePrice(i)}
                              disabled={isExpired || isSaving}
                            />
                            <span>TL</span>
                          </div>
                        </td>
                        <td>
                          <select
                            className="input"
                            style={{ width: 120 }}
                            value={draft.isActive ? 'true' : 'false'}
                            onChange={(e) => toggleInlineStatus(i, e.target.value === 'true')}
                            disabled={isExpired || isSaving}
                          >
                            <option value="true">Aktif</option>
                            <option value="false">Pasif</option>
                          </select>
                        </td>
                        <td className="actions">
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn" onClick={() => openEdit(i)}>Düzenle</button>
                            <button className="btn" onClick={() => onDelete(i)}>Sil</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-only settings-mobile">
              {(items || []).map(i => {
                const categoryLabel = catName(i.categoryId)
                const draft = getInlineDraft(i)
                const isSaving = !!inlineSaving[String(i.id)]
                return (
                  <div key={i.id} className="mobile-list-item">
                    <div className="mobile-item-title breakAny">{i.name}</div>
                    <div className="mobile-item-meta">
                      <span className="breakAny">Kategori: {categoryLabel}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        Fiyat:
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="0.01"
                          style={{ width: 110 }}
                          value={draft.price}
                          onChange={(e) => setInlineDraftValue(i.id, { price: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              commitInlinePrice(i)
                              e.currentTarget.blur()
                            }
                          }}
                          onBlur={() => commitInlinePrice(i)}
                          disabled={isExpired || isSaving}
                        />
                        TL
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        Durum:
                        <select
                          className="input"
                          style={{ width: 110 }}
                          value={draft.isActive ? 'true' : 'false'}
                          onChange={(e) => toggleInlineStatus(i, e.target.value === 'true')}
                          disabled={isExpired || isSaving}
                        >
                          <option value="true">Aktif</option>
                          <option value="false">Pasif</option>
                        </select>
                      </span>
                      {isSaving && <span>Kaydediliyor...</span>}
                    </div>
                    <div className="mobile-actions-row">
                      <button className="btn" type="button" onClick={() => openEdit(i)}>Düzenle</button>
                      <button className="btn" type="button" onClick={() => onDelete(i)}>Sil</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Ürün">
        <form onSubmit={onCreate} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kategori</div>
            <select className="input" value={createForm.categoryId} onChange={(e) => setCreateForm({ ...createForm, categoryId: e.target.value })}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fiyat (TL)</div>
            <input className="input" type="number" value={createForm.price} onChange={(e) => setCreateForm({ ...createForm, price: Number(e.target.value) })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Açıklama</div>
            <textarea className="input" rows="3" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Görsel URL</div>
            <input className="input" value={createForm.imageUrl} onChange={(e) => setCreateForm({ ...createForm, imageUrl: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sort</div>
            <input className="input" type="number" value={createForm.sortOrder} onChange={(e) => setCreateForm({ ...createForm, sortOrder: Number(e.target.value) })} />
          </label>
          {formError && <div style={{ color: '#ef4444', fontSize: 13 }}>{formError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={onCreateKeepOpen} disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Ekle'}</button>
            <button className="btn" disabled={formLoading}>{formLoading ? 'Gönderiliyor...' : 'Kaydet & Kapat'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Ürün Düzenle">
        <form onSubmit={onEdit} style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kategori</div>
            <select className="input" value={editForm.categoryId} onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fiyat (TL)</div>
            <input className="input" type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Açıklama</div>
            <textarea className="input" rows="3" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Görsel URL</div>
            <input className="input" value={editForm.imageUrl} onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })} />
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
