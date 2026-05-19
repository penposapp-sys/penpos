import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'
import Modal from '../../components/Modal.jsx'
import CanteenBulkProductsExcelCard from '../components/CanteenBulkProductsExcelCard.jsx'
import { PRODUCT_PLACEHOLDER } from '../components/CanteenQrPreview.jsx'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'

const normalize = (value) => String(value || '').toLowerCase().trim()
const hasValue = (value) => String(value ?? '').trim() !== ''
const parseLocaleNumber = (value) => Number(String(value || '').replace(',', '.'))
const EMPTY_CATEGORY_FORM = { id: '', name: '', description: '', imageUrl: '', sortOrder: '0' }

const selectStyles = {
  width: '100%',
  minHeight: 44,
  borderRadius: 12,
  border: '1px solid var(--app-border, var(--border))',
  padding: '0 12px',
  background: 'var(--app-surface, var(--panel))',
  color: 'var(--app-text, var(--text))',
  font: 'inherit'
}

function CategoryCard({ category, onEdit, onRemove, canManage }) {
  return (
    <div style={{ border: '1px solid var(--app-border, var(--border))', borderRadius: 18, padding: 14, display: 'grid', gap: 10, background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-surface) 96%, transparent), var(--app-surface-soft, var(--panelElevated)))', color: 'var(--app-text, var(--text))' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <img
          src={category.imageUrl || PRODUCT_PLACEHOLDER}
          alt={category.name}
          onError={(event) => { event.currentTarget.src = PRODUCT_PLACEHOLDER }}
          style={{ width: 64, height: 64, borderRadius: 18, objectFit: 'cover', background: 'var(--app-surface-elevated, var(--panelElevated))', border: '1px solid var(--app-border, var(--border))', flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: 'var(--app-text, var(--text))' }}>{category.name}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>Sıralama: {Number(category.sortOrder || 0)}</div>
          <div style={{ color: category.isActive === false ? '#b45309' : 'var(--muted)', fontSize: 12 }}>
            {category.isActive === false ? 'Pasif' : 'Aktif'}
          </div>
        </div>
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 13, minHeight: 18 }}>
        {category.description || 'Açıklama yok'}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn--compact" type="button" onClick={() => onEdit(category)} disabled={!canManage}>Düzenle</button>
        <button className="btn btn--danger btn--compact" type="button" onClick={() => onRemove(category)} disabled={!canManage}>Pasife Al</button>
      </div>
    </div>
  )
}

export default function CanteenSettingsProductsPage() {
  const { me } = useOutletContext()
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [barcode, setBarcode] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [stockTrackingEnabled, setStockTrackingEnabled] = useState(false)
  const [stockQty, setStockQty] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [q, setQ] = useState('')
  const [error, setError] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState('')
  const [editName, setEditName] = useState('')
  const [editBarcode, setEditBarcode] = useState('')
  const [editBuyPrice, setEditBuyPrice] = useState('')
  const [editSellPrice, setEditSellPrice] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editStockTrackingEnabled, setEditStockTrackingEnabled] = useState(false)
  const [editStockQty, setEditStockQty] = useState('')

  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM)
  const [categorySaving, setCategorySaving] = useState(false)

  const [branches, setBranches] = useState([])
  const [allowedIds, setAllowedIds] = useState([])
  const isCompact = isMobilePortrait || isTablet

  const canManage = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && me.permissions.includes('manage_menu'))

  const loadProfile = async () => {
    const response = await api('/api/tenant/profile', { silent: true })
    const tenant = response?.tenant || null
    const rawBranches = Array.isArray(tenant?.branches) ? tenant.branches : []
    const nextBranches = rawBranches
      .map((branch) => ({
        id: String(branch?.id || branch?._id || ''),
        name: String(branch?.name || ''),
        isActive: branch?.isActive !== false
      }))
      .filter((branch) => branch.id && branch.name && branch.isActive !== false)
    const nextAllowed = Array.isArray(tenant?.canteenAllowedBranchIds)
      ? tenant.canteenAllowedBranchIds.map(String).filter(Boolean)
      : []
    setBranches(nextBranches)
    setAllowedIds(nextAllowed)
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const visibleBranches = useMemo(() => {
    const allowedSet = new Set((allowedIds || []).map(String))
    if (me?.role === 'tenant_admin') {
      return allowedSet.size > 0 ? branches.filter((branch) => allowedSet.has(String(branch.id))) : branches
    }
    if (allowedSet.size === 0) return []
    return branches.filter((branch) => allowedSet.has(String(branch.id)))
  }, [allowedIds, branches, me?.role])

  useEffect(() => {
    if (String(selectedBranchId || '').trim()) return
    if (visibleBranches.length > 0) setSelectedBranchId(String(visibleBranches[0].id))
  }, [visibleBranches, selectedBranchId])

  useEffect(() => {
    if (!selectedBranchId) return
    if (visibleBranches.some((branch) => String(branch.id) === String(selectedBranchId))) return
    setSelectedBranchId(visibleBranches.length > 0 ? String(visibleBranches[0].id) : '')
  }, [visibleBranches, selectedBranchId])

  const loadCategories = async (branchId) => {
    const currentBranchId = String(branchId || '').trim()
    if (!currentBranchId) {
      setCategories([])
      return
    }
    const response = await api('/api/canteen/categories', {
      silent: true,
      headers: { 'x-branch-id': currentBranchId }
    })
    setCategories(Array.isArray(response?.categories) ? response.categories : [])
  }

  const loadProducts = async (branchId) => {
    const currentBranchId = String(branchId || '').trim()
    if (!currentBranchId) {
      setItems([])
      return
    }
    const response = await api(`/api/canteen/products?branchId=${encodeURIComponent(currentBranchId)}`, { silent: true })
    setItems(Array.isArray(response?.products) ? response.products : [])
  }

  const load = async (branchId, options = {}) => {
    const currentBranchId = String(branchId || '').trim()
    const background = options?.background === true
    if (!currentBranchId) {
      setItems([])
      setCategories([])
      return
    }
    if (!background) setLoading(true)
    if (!background) setError('')
    await Promise.all([loadProducts(currentBranchId), loadCategories(currentBranchId)])
    if (!background) setLoading(false)
  }

  useEffect(() => {
    load(selectedBranchId)
  }, [selectedBranchId])

  const filtered = useMemo(() => {
    const query = normalize(q)
    if (!query) return items
    return items.filter((item) => [item.name, item.categoryName, item.barcode].some((value) => normalize(value).includes(query)))
  }, [items, q])

  const isCreateFormValid =
    canManage &&
    hasValue(name) &&
    hasValue(barcode) &&
    hasValue(selectedBranchId) &&
    hasValue(sellPrice) &&
    Number.isFinite(parseLocaleNumber(sellPrice)) &&
    parseLocaleNumber(sellPrice) >= 0

  const resetCreateForm = () => {
    setName('')
    setBarcode('')
    setBuyPrice('')
    setSellPrice('')
    setImageUrl('')
    setCategoryId('')
    setStockTrackingEnabled(false)
    setStockQty('')
  }

  const create = async (event) => {
    event.preventDefault()
    if (!canManage) return

    const branchId = String(selectedBranchId || '').trim()
    if (!branchId) {
      setError('Şube seçmelisin')
      return
    }
    const normalizedBarcode = String(barcode || '').trim()
    if (!normalizedBarcode) {
      setError('Barkod zorunlu')
      toast.error('Barkod zorunlu')
      return
    }
    if (!String(name || '').trim()) {
      setError('Ürün adı zorunlu')
      return
    }
    if (!hasValue(sellPrice)) {
      setError('Satış fiyatı zorunlu')
      toast.error('Satış fiyatı zorunlu')
      return
    }

    const price = parseLocaleNumber(sellPrice)
    const cost = parseLocaleNumber(buyPrice)
    if (!Number.isFinite(price) || price < 0) {
      setError('Satış fiyatı geçersiz')
      toast.error('Satış fiyatı geçersiz')
      return
    }

    setError('')
    const response = await api(`/api/canteen/products?branchId=${encodeURIComponent(branchId)}`, {
      method: 'POST',
      data: {
        name,
        barcode: normalizedBarcode,
        price,
        costPrice: Number.isFinite(cost) ? cost : 0,
        imageUrl: String(imageUrl || '').trim(),
        categoryId: String(categoryId || '').trim() || null,
        stockTrackingEnabled: stockTrackingEnabled === true,
        stockQty: Number(String(stockQty || '').replace(',', '.')) || 0
      },
      silent: true
    })

    if (!response?.ok) {
      if (response?.code === 'duplicate_barcode') toast.error('Bu barkod zaten kayıtlı')
      if (response?.code === 'price_required') toast.error('Satış fiyatı zorunlu')
      if (response?.code === 'category_not_found') toast.error('Seçilen kategori bulunamadı')
      setError(response?.message || 'Ürün eklenemedi')
      return
    }

    resetCreateForm()
    load(branchId)
    toast.success('Ürün eklendi')
  }

  const openEdit = (item) => {
    setEditId(String(item?.id || ''))
    setEditName(String(item?.name || ''))
    setEditBarcode(String(item?.barcode || ''))
    setEditBuyPrice(String(item?.costPrice ?? ''))
    setEditSellPrice(String(item?.price ?? ''))
    setEditImageUrl(String(item?.imageUrl || ''))
    setEditCategoryId(String(item?.categoryId || ''))
    setEditStockTrackingEnabled(item?.stockTrackingEnabled === true)
    setEditStockQty(String(item?.stockQty ?? ''))
    setEditOpen(true)
  }

  const submitEdit = async () => {
    if (!canManage) return
    const branchId = String(selectedBranchId || '').trim()
    const id = String(editId || '').trim()
    if (!branchId || !id) return

    const normalizedBarcode = String(editBarcode || '').trim()
    if (!normalizedBarcode) {
      toast.error('Barkod zorunlu')
      return
    }

    const price = Number(String(editSellPrice || '').replace(',', '.'))
    const cost = Number(String(editBuyPrice || '').replace(',', '.'))
    const nextStock = Number(String(editStockQty || '').replace(',', '.'))
    const response = await api(`/api/canteen/products/${encodeURIComponent(id)}?branchId=${encodeURIComponent(branchId)}`, {
      method: 'PUT',
      data: {
        name: String(editName || '').trim(),
        barcode: normalizedBarcode,
        price: Number.isFinite(price) ? price : 0,
        costPrice: Number.isFinite(cost) ? cost : 0,
        imageUrl: String(editImageUrl || '').trim(),
        categoryId: String(editCategoryId || '').trim() || null,
        stockTrackingEnabled: editStockTrackingEnabled === true,
        stockQty: Number.isFinite(nextStock) ? nextStock : 0
      },
      silent: true
    })

    if (!response?.ok) {
      if (response?.code === 'duplicate_barcode') toast.error('Bu barkod zaten kayıtlı')
      else if (response?.code === 'category_not_found') toast.error('Seçilen kategori bulunamadı')
      else toast.error(response?.message || 'Kaydedilemedi')
      return
    }

    toast.success('Ürün güncellendi')
    setEditOpen(false)
    load(branchId)
  }

  const remove = async (id) => {
    if (!canManage) return
    const branchId = String(selectedBranchId || '').trim()
    if (!branchId) return
    if (!window.confirm('Ürünü silmek istiyor musun?')) return
    setError('')
    const response = await api(`/api/canteen/products/${id}?branchId=${encodeURIComponent(branchId)}`, { method: 'DELETE', silent: true })
    if (!response?.ok) {
      setError(response?.message || 'Silinemedi')
      return
    }
    load(branchId)
    toast.success('Ürün pasife alındı')
  }

  const openNewCategory = () => {
    setCategoryForm(EMPTY_CATEGORY_FORM)
    setCategoryModalOpen(true)
  }

  const openEditCategory = (category) => {
    setCategoryForm({
      id: String(category?.id || ''),
      name: String(category?.name || ''),
      description: String(category?.description || ''),
      imageUrl: String(category?.imageUrl || ''),
      sortOrder: String(category?.sortOrder ?? '0')
    })
    setCategoryModalOpen(true)
  }

  const submitCategory = async () => {
    if (!canManage) return
    const branchId = String(selectedBranchId || '').trim()
    if (!branchId) {
      toast.error('Önce şube seçin')
      return
    }
    if (!String(categoryForm.name || '').trim()) {
      toast.error('Kategori adı zorunlu')
      return
    }
    setCategorySaving(true)
    const isEdit = !!String(categoryForm.id || '').trim()
    const response = await api(
      isEdit
        ? `/api/canteen/categories/${encodeURIComponent(categoryForm.id)}?branchId=${encodeURIComponent(branchId)}`
        : `/api/canteen/categories?branchId=${encodeURIComponent(branchId)}`,
      {
        method: isEdit ? 'PUT' : 'POST',
        data: {
          name: categoryForm.name,
          description: categoryForm.description,
          imageUrl: categoryForm.imageUrl,
          sortOrder: parseLocaleNumber(categoryForm.sortOrder) || 0
        },
        silent: true
      }
    )
    setCategorySaving(false)
    if (!response?.ok) {
      toast.error(response?.message || 'Kategori kaydedilemedi')
      return
    }
    setCategoryModalOpen(false)
    await loadCategories(branchId)
    toast.success(isEdit ? 'Kategori güncellendi' : 'Kategori eklendi')
  }

  const removeCategory = async (category) => {
    if (!canManage) return
    const branchId = String(selectedBranchId || '').trim()
    const id = String(category?.id || '').trim()
    if (!branchId || !id) return
    if (!window.confirm(`"${category.name}" kategorisini pasife almak istiyor musun?`)) return
    const response = await api(`/api/canteen/categories/${encodeURIComponent(id)}?branchId=${encodeURIComponent(branchId)}`, {
      method: 'DELETE',
      silent: true
    })
    if (!response?.ok) {
      toast.error(response?.message || 'Kategori pasife alınamadı')
      return
    }
    if (String(categoryId) === id) setCategoryId('')
    if (String(editCategoryId) === id) setEditCategoryId('')
    await load(branchId)
    toast.success('Kategori pasife alındı')
  }

  return (
    <div className="canteen-settings-products-page" style={{ display: 'grid', gap: 12 }}>
      <style>{`
        .canteen-settings-products-page .card {
          background: linear-gradient(180deg, var(--app-surface), var(--app-surface-soft, var(--panelElevated))) !important;
          color: var(--app-text) !important;
        }
        .canteen-settings-products-page .input,
        .canteen-settings-products-page input,
        .canteen-settings-products-page textarea,
        .canteen-settings-products-page select {
          background: var(--app-surface) !important;
          color: var(--app-text) !important;
          border-color: var(--app-border, var(--border)) !important;
        }
        .canteen-settings-products-page [style*='var(--muted)'] {
          color: var(--app-text-secondary, var(--muted)) !important;
        }
        .canteen-settings-products-page button:not(.btn--primary):not(.btn--danger) {
          color: var(--app-text) !important;
        }
        .canteen-settings-products-page .products-row-card {
          min-width: 0;
        }
        @media (max-width: 768px) {
          .canteen-settings-products-page .products-row-card {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .canteen-settings-products-page .products-row-main {
            min-width: 0;
          }
          .canteen-settings-products-page .products-row-actions {
            width: 100%;
            justify-content: stretch;
            flex-wrap: wrap;
          }
          .canteen-settings-products-page .products-row-actions > * {
            flex: 1 1 140px;
          }
        }
      `}</style>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700 }}>Ürün ve Kategori Ayarları</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ürünler ve kategoriler seçili şubeye göre yönetilir. QR sipariş ekranındaki kategori kartları bu alanlardan beslenir.</div>
        </div>
        <button className="btn btn--compact" type="button" onClick={() => load(selectedBranchId)} disabled={loading}>
          {loading ? '...' : 'Yenile'}
        </button>
      </div>

      {!!error ? <div className="card" style={{ borderColor: 'color-mix(in srgb, #ef4444 35%, var(--app-border))', background: 'color-mix(in srgb, #ef4444 10%, var(--app-surface))', color: 'var(--app-text)' }}>{error}</div> : null}

      {branches.length === 0 ? (
        <div className="card" style={{ borderColor: 'color-mix(in srgb, #f59e0b 35%, var(--app-border))', background: 'color-mix(in srgb, #f59e0b 10%, var(--app-surface))', color: 'var(--app-text)' }}>
          Şube yok, önce Şube Ayarları bölümünden şube ekleyin.
        </div>
      ) : null}

      {me?.role !== 'tenant_admin' && Array.isArray(allowedIds) && allowedIds.length === 0 && branches.length > 0 ? (
        <div className="card" style={{ borderColor: 'color-mix(in srgb, #f59e0b 35%, var(--app-border))', background: 'color-mix(in srgb, #f59e0b 10%, var(--app-surface))', color: 'var(--app-text)' }}>
          Yetkili şube yok.
        </div>
      ) : null}

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginRight: 6 }}>Şubeler</div>
        {visibleBranches.map((branch) => {
          const id = String(branch.id)
          const active = id === String(selectedBranchId)
          return (
            <button
              key={id}
              type="button"
              className="btn"
              onClick={() => {
                setSelectedBranchId(id)
                resetCreateForm()
                setQ('')
              }}
              aria-pressed={active}
            >
              {branch.name}
            </button>
          )
        })}
        {visibleBranches.length === 0 && branches.length > 0 ? <div style={{ color: 'var(--muted)' }}>Yetkili şube yok.</div> : null}
      </div>

      {canManage ? <CanteenBulkProductsExcelCard branchId={selectedBranchId} onImportDone={() => load(selectedBranchId)} /> : null}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'minmax(0, 1.2fr) minmax(0, 0.8fr)' }}>
        <form className="card" onSubmit={create}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Yeni Ürün</div>
          <div className="productsCreateGrid">
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} disabled={!canManage} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Barkod</div>
              <input className="input" value={barcode} onChange={(event) => setBarcode(event.target.value)} disabled={!canManage} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Alış Fiyatı</div>
              <input className="input" value={buyPrice} onChange={(event) => setBuyPrice(event.target.value)} disabled={!canManage} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Satış Fiyatı</div>
              <input className="input" value={sellPrice} onChange={(event) => setSellPrice(event.target.value)} disabled={!canManage} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kategori</div>
              <select style={selectStyles} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={!canManage}>
                <option value="">Diğer Ürünler fallback</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Resim URL</div>
              <input className="input" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} disabled={!canManage} placeholder="https://..." />
            </label>
            <button className="btn btn--primary btn--full" type="submit" disabled={!isCreateFormValid}>Ekle</button>
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={stockTrackingEnabled} onChange={(event) => setStockTrackingEnabled(event.target.checked)} disabled={!canManage} />
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Stok takibi</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Başlangıç stok</span>
              <input className="input" value={stockQty} onChange={(event) => setStockQty(event.target.value)} disabled={!canManage} style={{ width: '100%', maxWidth: 180, height: 38 }} />
            </label>
          </div>
        </form>

        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Kategoriler</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Firma kendi kategorilerini buradan yönetir.</div>
            </div>
            <button className="btn btn--primary btn--compact" type="button" onClick={openNewCategory} disabled={!canManage}>Kategori Ekle</button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {categories.map((category) => (
              <CategoryCard key={category.id} category={category} onEdit={openEditCategory} onRemove={removeCategory} canManage={canManage} />
            ))}
            {!loading && categories.length === 0 ? <div style={{ color: 'var(--muted)' }}>Bu şubede kategori yok. Ürünler fallback olarak Diğer Ürünler altında görünür.</div> : null}
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ara</div>
          <input className="input" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Ürün adı, kategori veya barkod" />
        </label>
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map((item) => (
            <div key={item.id} className="products-row-card" style={{ display: 'grid', gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : '1fr auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 12, alignItems: 'center' }}>
              <div className="products-row-main" style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                <img
                  src={item.imageUrl || PRODUCT_PLACEHOLDER}
                  onError={(event) => { event.currentTarget.src = PRODUCT_PLACEHOLDER }}
                  alt={item.name}
                  style={{ width: 54, height: 54, borderRadius: 16, objectFit: 'cover', background: '#f8fafc', flexShrink: 0 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{item.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{item.categoryName || 'Diğer Ürünler'}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>Barkod: {item.barcode || '-'}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>Stok: {Number(item.stockQty || 0)}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>Satış: {Number(item.price || 0).toFixed(2)} ₺</div>
                </div>
              </div>
              <div className="products-row-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: isCompact ? 'stretch' : 'flex-end' }}>
                <button className="btn btn--compact" type="button" onClick={() => openEdit(item)} disabled={!canManage}>Düzenle</button>
                <button className="btn btn--danger btn--compact" type="button" onClick={() => remove(item.id)} disabled={!canManage}>Sil</button>
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 ? <div style={{ color: 'var(--muted)' }}>Bu şubede ürün yok</div> : null}
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Ürün Düzenle">
        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={editName} onChange={(event) => setEditName(event.target.value)} disabled={!canManage} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Barkod</div>
            <input className="input" value={editBarcode} onChange={(event) => setEditBarcode(event.target.value)} disabled={!canManage} />
          </label>
          <div className="productsEditPriceGrid">
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Alış Fiyatı</div>
              <input className="input" value={editBuyPrice} onChange={(event) => setEditBuyPrice(event.target.value)} disabled={!canManage} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Satış Fiyatı</div>
              <input className="input" value={editSellPrice} onChange={(event) => setEditSellPrice(event.target.value)} disabled={!canManage} />
            </label>
          </div>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kategori</div>
            <select style={selectStyles} value={editCategoryId} onChange={(event) => setEditCategoryId(event.target.value)} disabled={!canManage}>
              <option value="">Diğer Ürünler fallback</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Resim URL</div>
            <input className="input" value={editImageUrl} onChange={(event) => setEditImageUrl(event.target.value)} disabled={!canManage} placeholder="https://..." />
          </label>
          <div className="stackRow" style={{ justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={editStockTrackingEnabled} onChange={(event) => setEditStockTrackingEnabled(event.target.checked)} disabled={!canManage} />
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Stok takibi</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Stok</span>
              <input className="input" value={editStockQty} onChange={(event) => setEditStockQty(event.target.value)} disabled={!canManage} style={{ width: '100%', maxWidth: 180, height: 38 }} />
            </label>
          </div>
          <div className="actionWrap" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={() => setEditOpen(false)}>Vazgeç</button>
            <button className="btn btn--primary" type="button" onClick={submitEdit} disabled={!String(editName || '').trim() || !String(editBarcode || '').trim()}>
              Kaydet
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} title={categoryForm.id ? 'Kategori Düzenle' : 'Yeni Kategori'}>
        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kategori Adı</div>
            <input className="input" value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} disabled={!canManage} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Açıklama</div>
            <textarea className="input" value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} disabled={!canManage} style={{ minHeight: 96, paddingTop: 12 }} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Görsel URL</div>
            <input className="input" value={categoryForm.imageUrl} onChange={(event) => setCategoryForm((current) => ({ ...current, imageUrl: event.target.value }))} disabled={!canManage} placeholder="https://..." />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sıralama</div>
            <input className="input" value={categoryForm.sortOrder} onChange={(event) => setCategoryForm((current) => ({ ...current, sortOrder: event.target.value }))} disabled={!canManage} />
          </label>
          <div className="actionWrap" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={() => setCategoryModalOpen(false)}>Vazgeç</button>
            <button className="btn btn--primary" type="button" onClick={submitCategory} disabled={categorySaving || !String(categoryForm.name || '').trim()}>
              {categorySaving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
