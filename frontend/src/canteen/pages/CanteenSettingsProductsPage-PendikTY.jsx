import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Suspense } from 'react'
import ProductImageUploadField from '../../components/ProductImageUploadField.jsx'
import { api } from '../../lib/apiClient.js'
import { optimizeProductImageForUpload, resolveProductImageUrl } from '../../lib/productImage.js'
import { toast } from '../../lib/toast.js'
import Modal from '../../components/Modal.jsx'
import CanteenBulkProductsExcelCard from '../components/CanteenBulkProductsExcelCard.jsx'
import { PRODUCT_PLACEHOLDER } from '../components/CanteenQrPreview.jsx'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'
import { useRef } from 'react'
const LazyCanteenStockWorkspace = React.lazy(() =>
  import('./CanteenStockPage.jsx').then((module) => ({ default: module.CanteenStockWorkspace }))
)

const normalize = (value) => String(value || '').toLowerCase().trim()
const hasValue = (value) => String(value ?? '').trim() !== ''
const parseLocaleNumber = (value) => Number(String(value || '').replace(',', '.'))
const EMPTY_CATEGORY_FORM = { id: '', name: '', description: '', imageUrl: '', sortOrder: '0', isActive: true }
const VAT_OPTIONS = [0, 1, 8, 10, 18, 20]

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

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d="M4 20l4.2-1 9.1-9.1a1.8 1.8 0 0 0 0-2.6l-.6-.6a1.8 1.8 0 0 0-2.6 0L5 15.8 4 20zm9.3-12.6 2.3 2.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
  const [imageFile, setImageFile] = useState(null)
  const [imageError, setImageError] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [vatRate, setVatRate] = useState('0')
  const [vatIncluded, setVatIncluded] = useState(true)
  const [stockTrackingEnabled, setStockTrackingEnabled] = useState(false)
  const [stockQty, setStockQty] = useState('')
  const [minimumStock, setMinimumStock] = useState('5')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('card')
  const [activeTab, setActiveTab] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])
  const [createOpen, setCreateOpen] = useState(false)
  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [stockWorkspaceRefreshKey, setStockWorkspaceRefreshKey] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState('')
  const [editName, setEditName] = useState('')
  const [editBarcode, setEditBarcode] = useState('')
  const [editBuyPrice, setEditBuyPrice] = useState('')
  const [editSellPrice, setEditSellPrice] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editImageFile, setEditImageFile] = useState(null)
  const [editImageError, setEditImageError] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editVatRate, setEditVatRate] = useState('20')
  const [editVatIncluded, setEditVatIncluded] = useState(true)
  const [editStockTrackingEnabled, setEditStockTrackingEnabled] = useState(false)
  const [editStockQty, setEditStockQty] = useState('')
  const [editMinimumStock, setEditMinimumStock] = useState('5')

  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [categoryBrowserOpen, setCategoryBrowserOpen] = useState(false)
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM)
  const [categoryImageFile, setCategoryImageFile] = useState(null)
  const [categoryImageError, setCategoryImageError] = useState('')
  const [categorySaving, setCategorySaving] = useState(false)

  const [branches, setBranches] = useState([])
  const [allowedIds, setAllowedIds] = useState([])
  const createBarcodeRef = useRef(null)
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

  useEffect(() => {
    if (!createOpen) return undefined
    const timer = setTimeout(() => {
      createBarcodeRef.current?.focus()
      createBarcodeRef.current?.select?.()
    }, 40)
    return () => clearTimeout(timer)
  }, [createOpen])

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0) || String(a?.name || '').localeCompare(String(b?.name || ''), 'tr'))
  }, [categories])

  const categoryTabs = useMemo(() => ([
    { key: 'all', label: 'Tümü' },
    ...sortedCategories.map((category) => ({ key: `category:${category.id}`, label: category.name, category }))
  ]), [sortedCategories])

  const categoryOrderMap = useMemo(() => {
    const entries = sortedCategories.map((category, index) => [
      String(category?.id || ''),
      {
        sortOrder: Number(category?.sortOrder || 0),
        index,
        name: String(category?.name || '')
      }
    ])
    return new Map(entries)
  }, [sortedCategories])

  const filtered = useMemo(() => {
    const query = normalize(q)
    return items
      .filter((item) => {
        const matchesSearch = !query || [item.name, item.categoryName, item.barcode].some((value) => normalize(value).includes(query))
        const matchesStatus = statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? item?.isActive !== false
            : item?.isActive === false
        const activeCategoryId = String(activeTab).startsWith('category:') ? String(activeTab).slice('category:'.length) : ''
        const matchesTab = activeTab === 'all' ? true : String(item.categoryId || '') === activeCategoryId
        return matchesSearch && matchesStatus && matchesTab
      })
      .sort((left, right) => {
        const leftCategory = categoryOrderMap.get(String(left?.categoryId || '')) || null
        const rightCategory = categoryOrderMap.get(String(right?.categoryId || '')) || null

        const leftSort = leftCategory?.sortOrder ?? Number.MAX_SAFE_INTEGER
        const rightSort = rightCategory?.sortOrder ?? Number.MAX_SAFE_INTEGER
        if (leftSort !== rightSort) return leftSort - rightSort

        const leftIndex = leftCategory?.index ?? Number.MAX_SAFE_INTEGER
        const rightIndex = rightCategory?.index ?? Number.MAX_SAFE_INTEGER
        if (leftIndex !== rightIndex) return leftIndex - rightIndex

        const leftCategoryName = String(leftCategory?.name || left?.categoryName || 'Diğer Ürünler')
        const rightCategoryName = String(rightCategory?.name || right?.categoryName || 'Diğer Ürünler')
        const categoryCompare = leftCategoryName.localeCompare(rightCategoryName, 'tr')
        if (categoryCompare !== 0) return categoryCompare

        return String(left?.name || '').localeCompare(String(right?.name || ''), 'tr')
      })
  }, [activeTab, categoryOrderMap, items, q, statusFilter])

  const isCreateFormValid =
    canManage &&
    hasValue(name) &&
    hasValue(barcode) &&
    hasValue(selectedBranchId) &&
    hasValue(sellPrice) &&
    Number.isFinite(parseLocaleNumber(sellPrice)) &&
    parseLocaleNumber(sellPrice) >= 0

  const resetCreateForm = ({ nextVatRate = '0' } = {}) => {
    setName('')
    setBarcode('')
    setBuyPrice('')
    setSellPrice('')
    setImageFile(null)
    setImageError('')
    setCategoryId('')
    setVatRate(String(nextVatRate))
    setVatIncluded(true)
    setStockTrackingEnabled(false)
    setStockQty('')
    setMinimumStock('5')
  }

  const openCreateModal = () => {
    resetCreateForm({ nextVatRate: '0' })
    setCreateOpen(true)
  }

  const closeCreateModal = () => {
    setCreateOpen(false)
    resetCreateForm({ nextVatRate: '0' })
  }

  const uploadProductImage = async (productId, file, branchId) => {
    if (!productId || !file || !branchId) return null
    const preparedFile = await optimizeProductImageForUpload(file)
    const formData = new FormData()
    formData.append('file', preparedFile || file)
    return api(`/api/canteen/products/${encodeURIComponent(productId)}/image?branchId=${encodeURIComponent(branchId)}`, {
      method: 'POST',
      body: formData,
      silent: true
    })
  }

  const create = async (event) => {
    event.preventDefault()
    if (!canManage) return
    if (imageError) {
      setError(imageError)
      toast.error(imageError)
      return
    }

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
        vatRate: Number(parseLocaleNumber(vatRate) || 0),
        vatIncluded,
        categoryId: String(categoryId || '').trim() || null,
        stockTrackingEnabled: stockTrackingEnabled === true,
        stockQty: Number(String(stockQty || '').replace(',', '.')) || 0,
        minimumStock: Number(String(minimumStock || '').replace(',', '.')) || 0
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

    if (response?.product?.id && imageFile) {
      const uploadResponse = await uploadProductImage(response.product.id, imageFile, branchId)
      if (!uploadResponse?.ok) {
        toast.error(uploadResponse?.message || 'Görsel yüklenemedi')
      }
    }

    resetCreateForm({ nextVatRate: vatRate })
    load(branchId)
    toast.success('Ürün eklendi')
    setTimeout(() => {
      createBarcodeRef.current?.focus()
      createBarcodeRef.current?.select?.()
    }, 40)
  }

  const openEdit = (item) => {
    setEditId(String(item?.id || ''))
    setEditName(String(item?.name || ''))
    setEditBarcode(String(item?.barcode || ''))
    setEditBuyPrice(String(item?.costPrice ?? ''))
    setEditSellPrice(String(item?.price ?? ''))
    setEditImageUrl(String(item?.imageUrl || ''))
    setEditImageFile(null)
    setEditImageError('')
    setEditCategoryId(String(item?.categoryId || ''))
    setEditVatRate(String(item?.vatRate ?? '20'))
    setEditVatIncluded(item?.vatIncluded !== false)
    setEditStockTrackingEnabled(item?.stockTrackingEnabled === true)
    setEditStockQty(String(item?.stockQty ?? ''))
    setEditMinimumStock(String(item?.minimumStock ?? '5'))
    setEditOpen(true)
  }

  const submitEdit = async () => {
    if (!canManage) return
    if (editImageError) {
      toast.error(editImageError)
      return
    }
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
        vatRate: Number(parseLocaleNumber(editVatRate) || 0),
        vatIncluded: editVatIncluded,
        categoryId: String(editCategoryId || '').trim() || null,
        stockTrackingEnabled: editStockTrackingEnabled === true,
        stockQty: Number.isFinite(nextStock) ? nextStock : 0,
        minimumStock: Number(String(editMinimumStock || '').replace(',', '.')) || 0
      },
      silent: true
    })

    if (!response?.ok) {
      if (response?.code === 'duplicate_barcode') toast.error('Bu barkod zaten kayıtlı')
      else if (response?.code === 'category_not_found') toast.error('Seçilen kategori bulunamadı')
      else toast.error(response?.message || 'Kaydedilemedi')
      return
    }

    if (editImageFile) {
      const uploadResponse = await uploadProductImage(id, editImageFile, branchId)
      if (!uploadResponse?.ok) {
        toast.error(uploadResponse?.message || 'Görsel yüklenemedi')
        return
      }
    }

    toast.success('Ürün güncellendi')
    setEditOpen(false)
    await load(branchId)
    setStockWorkspaceRefreshKey((value) => value + 1)
  }

  const removeEditImage = async () => {
    const branchId = String(selectedBranchId || '').trim()
    const id = String(editId || '').trim()
    if (!branchId || !id) return
    const response = await api(`/api/canteen/products/${encodeURIComponent(id)}/image?branchId=${encodeURIComponent(branchId)}`, {
      method: 'DELETE',
      silent: true
    })
    if (!response?.ok) {
      toast.error(response?.message || 'Görsel kaldırılamadı')
      return
    }
    setEditImageUrl('')
    setEditImageFile(null)
    setEditImageError('')
    toast.success('Görsel kaldırıldı')
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
    setCategoryBrowserOpen(false)
    setCategoryForm(EMPTY_CATEGORY_FORM)
    setCategoryImageFile(null)
    setCategoryImageError('')
    setCategoryModalOpen(true)
  }

  const openEditCategory = (category) => {
    setCategoryBrowserOpen(false)
    setCategoryForm({
      id: String(category?.id || ''),
      name: String(category?.name || ''),
      description: String(category?.description || ''),
      imageUrl: String(category?.imageUrl || ''),
      sortOrder: String(category?.sortOrder ?? '0'),
      isActive: category?.isActive !== false
    })
    setCategoryImageFile(null)
    setCategoryImageError('')
    setCategoryModalOpen(true)
  }

  const openCategoryBrowser = () => {
    setCategoryBrowserOpen(true)
  }

  const uploadCategoryImage = async (categoryIdToUpload, file, branchId) => {
    if (!categoryIdToUpload || !file || !branchId) return null
    const preparedFile = await optimizeProductImageForUpload(file)
    const formData = new FormData()
    formData.append('file', preparedFile || file)
    return api(`/api/canteen/categories/${encodeURIComponent(categoryIdToUpload)}/image?branchId=${encodeURIComponent(branchId)}`, {
      method: 'POST',
      body: formData,
      silent: true
    })
  }

  const removeCategoryImage = async () => {
    const branchId = String(selectedBranchId || '').trim()
    const id = String(categoryForm.id || '').trim()
    if (!branchId || !id) return
    const response = await api(`/api/canteen/categories/${encodeURIComponent(id)}/image?branchId=${encodeURIComponent(branchId)}`, {
      method: 'DELETE',
      silent: true
    })
    if (!response?.ok) {
      toast.error(response?.message || 'Kategori görseli kaldırılamadı')
      return
    }
    setCategoryForm((current) => ({ ...current, imageUrl: '' }))
    setCategoryImageFile(null)
    setCategoryImageError('')
    await loadCategories(branchId)
    toast.success('Kategori görseli kaldırıldı')
  }

  const submitCategory = async () => {
    if (!canManage) return
    const branchId = String(selectedBranchId || '').trim()
    if (!branchId) {
      toast.error('Önce şube seçin')
      return
    }
    if (categoryImageError) {
      toast.error(categoryImageError)
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
          imageUrl: categoryImageFile ? '' : categoryForm.imageUrl,
          sortOrder: parseLocaleNumber(categoryForm.sortOrder) || 0,
          isActive: categoryForm.isActive !== false
        },
        silent: true
      }
    )
    if (!response?.ok) {
      setCategorySaving(false)
      toast.error(response?.message || 'Kategori kaydedilemedi')
      return
    }
    const savedCategoryId = String(response?.category?.id || categoryForm.id || '').trim()
    if (savedCategoryId && categoryImageFile) {
      const uploadResponse = await uploadCategoryImage(savedCategoryId, categoryImageFile, branchId)
      if (!uploadResponse?.ok) {
        setCategorySaving(false)
        toast.error(uploadResponse?.message || 'Kategori görseli yüklenemedi')
        await loadCategories(branchId)
        return
      }
    }
    setCategorySaving(false)
    setCategoryModalOpen(false)
    setCategoryImageFile(null)
    setCategoryImageError('')
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

  const toggleSelected = (id) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  const formatCategoryLabel = (item) => {
    const category = sortedCategories.find((entry) => String(entry.id) === String(item?.categoryId || ''))
    const sortNumber = Number(category?.sortOrder || 0) + 1
    const categoryName = String(category?.name || item?.categoryName || 'Diğer Ürünler')
    return `#${sortNumber} · ${categoryName}`
  }

  const renderProductRow = (item) => {
    const selected = selectedIds.includes(item.id)
    const imageSrc = resolveProductImageUrl({ imageUrl: item.imageUrl || PRODUCT_PLACEHOLDER })
    const categoryLabel = formatCategoryLabel(item)
    const stockValue = Number(item.stockQty || 0)
    const priceValue = Number(item.price || 0).toFixed(2)

    if (viewMode === 'card') {
      return (
        <article key={item.id} className="canteen-product-card-grid-item">
          <div className="canteen-product-card-grid-thumb">
            <img
              src={imageSrc}
              onError={(event) => { event.currentTarget.src = PRODUCT_PLACEHOLDER }}
              alt={item.name}
            />
          </div>
          <div className="canteen-product-card-grid-title">{item.name}</div>
          <div className="canteen-product-card-grid-subtitle">{categoryLabel}</div>
          <div className="canteen-product-card-grid-pills">
            <span>{priceValue} TL</span>
            <span>Stok: {stockValue}</span>
          </div>
          <div className="canteen-product-card-grid-toggles">
            <label><input type="checkbox" checked={item.isActive !== false} readOnly /> Aktif</label>
            <label><input type="checkbox" checked={item.stockTrackingEnabled === true} readOnly /> Stok Takibi</label>
          </div>
          <div className="canteen-product-card-grid-actions">
            <button className="btn btn--compact" type="button" onClick={() => openEdit(item)} disabled={!canManage}>Ürün Ayarları</button>
            <button className="btn btn--danger btn--compact" type="button" onClick={() => remove(item.id)} disabled={!canManage}>Sil</button>
          </div>
        </article>
      )
    }

    return (
      <article key={item.id} className="canteen-product-list-row">
        <label className="canteen-product-list-check">
          <input type="checkbox" checked={selected} onChange={() => toggleSelected(item.id)} />
        </label>
        <div className="canteen-product-list-media">
          <img
            src={imageSrc}
            onError={(event) => { event.currentTarget.src = PRODUCT_PLACEHOLDER }}
            alt={item.name}
          />
        </div>
        <div className="canteen-product-list-main">
          <div className="canteen-product-list-name">{item.name}</div>
          <div className="canteen-product-list-sub">{categoryLabel}</div>
        </div>
        <div className="canteen-product-list-pill">{priceValue} TL</div>
        <div className="canteen-product-list-pill">{stockValue}</div>
        <div className="canteen-product-list-toggle">
          <span className={`canteen-toggle-dot ${item.isActive !== false ? 'is-on' : ''}`} />
          <span>Aktif</span>
        </div>
        <div className="canteen-product-list-toggle">
          <span className={`canteen-toggle-dot ${item.stockTrackingEnabled === true ? 'is-on' : ''}`} />
          <span>Stok Takibi</span>
        </div>
        <div className="canteen-product-list-actions">
          <button className="btn btn--compact" type="button" onClick={() => openEdit(item)} disabled={!canManage}>Düzenle</button>
          <button className="btn btn--danger btn--compact" type="button" onClick={() => remove(item.id)} disabled={!canManage}>Sil</button>
        </div>
      </article>
    )
  }

  return (
    <div className="canteen-settings-products-page" style={{ display: 'grid', gap: 12 }}>
      <style>{`
        .canteen-settings-products-page {
          --canteen-products-panel-bg: var(--card-bg);
          --canteen-products-control-bg: var(--app-input, var(--app-surface, var(--panel)));
          --canteen-products-item-bg: color-mix(in srgb, var(--app-surface, var(--panel)) 88%, var(--app-surface-soft, var(--panelElevated)) 12%);
          --canteen-products-pill-bg: color-mix(in srgb, var(--app-surface-soft, var(--panelElevated)) 82%, var(--app-surface, var(--panel)) 18%);
          --canteen-products-thumb-bg: color-mix(in srgb, var(--app-surface-3, var(--app-surface-soft, var(--panelElevated))) 74%, var(--app-surface, var(--panel)) 26%);
          --canteen-products-toggle-bg: color-mix(in srgb, var(--app-surface-3, var(--app-surface-soft, var(--panelElevated))) 70%, var(--app-surface, var(--panel)) 30%);
          --canteen-products-toggle-on-bg: var(--settings-button-bg, var(--menu-active-bg, var(--app-surface-3, #111827)));
        }
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
        .canteen-settings-products-page button:not(.btn--danger) {
          color: var(--settings-button-text, #ffffff) !important;
        }
        .canteen-settings-products-page .products-row-card {
          min-width: 0;
        }
        .canteen-products-shell {
          display: grid;
          gap: 16px;
        }
        .canteen-products-panel {
          display: grid;
          gap: 14px;
          padding: 16px;
          border-radius: 28px;
          border: 1px solid var(--app-border, var(--border));
          background: var(--canteen-products-panel-bg);
          box-shadow: 0 20px 48px rgba(15,23,42,0.08);
        }
        .canteen-products-toolbar-top,
        .canteen-products-toolbar-actions,
        .canteen-products-category-strip {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }
        .canteen-products-toolbar-top > * {
          min-width: 0;
        }
        .canteen-toolbar-search,
        .canteen-toolbar-select {
          flex: 1 1 220px;
          min-height: 48px;
          border-radius: 999px;
          padding: 0 16px;
          border: 1px solid var(--app-border, var(--border));
          background: var(--canteen-products-control-bg);
          color: var(--app-text, var(--text));
          font: inherit;
        }
        .canteen-products-action-btn,
        .canteen-products-pill-btn,
        .canteen-products-category-pill {
          min-height: 48px;
          border-radius: 999px;
          padding: 0 18px;
          border: 1px solid var(--app-border, var(--border));
          background: var(--canteen-products-control-bg);
          color: var(--app-text, var(--text));
          font: inherit;
          font-weight: 800;
        }
        .canteen-products-category-pill-wrap {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .canteen-products-category-edit-btn {
          width: 38px;
          min-width: 38px;
          height: 38px;
          border-radius: 999px;
          border: 1px solid var(--app-border, var(--border));
          background: var(--canteen-products-control-bg);
          color: var(--app-text, var(--text));
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        .canteen-products-category-pill.is-active,
        .canteen-products-pill-btn.is-active {
          background: color-mix(in srgb, var(--settings-button-bg, #111827) 88%, white 12%);
          color: var(--settings-button-text, #fff);
        }
        .canteen-products-list,
        .canteen-products-grid {
          display: grid;
          gap: 14px;
        }
        .canteen-product-list-row {
          display: grid;
          grid-template-columns: 28px 64px minmax(180px, 1.4fr) 128px 104px 116px 108px 120px;
          gap: 14px;
          align-items: center;
          padding: 12px 16px;
          border-radius: 24px;
          border: 1px solid var(--app-border, var(--border));
          background: var(--canteen-products-item-bg);
        }
        .canteen-product-list-media img,
        .canteen-product-card-grid-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 18px;
          display: block;
          background: var(--canteen-products-thumb-bg);
        }
        .canteen-product-list-media {
          width: 58px;
          height: 58px;
        }
        .canteen-product-list-name,
        .canteen-product-card-grid-title {
          font-weight: 900;
          font-size: 1.05rem;
          line-height: 1.2;
        }
        .canteen-product-list-sub,
        .canteen-product-card-grid-subtitle {
          margin-top: 4px;
          color: var(--app-text-secondary, var(--muted));
          font-weight: 700;
          font-size: 0.92rem;
        }
        .canteen-product-list-pill {
          min-height: 36px;
          padding: 0 14px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--canteen-products-pill-bg);
          font-weight: 900;
        }
        .canteen-product-list-toggle {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-weight: 800;
        }
        .canteen-toggle-dot {
          width: 26px;
          height: 26px;
          border-radius: 999px;
          background: var(--canteen-products-toggle-bg);
          border: 1px solid var(--app-border, var(--border));
          display: inline-block;
        }
        .canteen-toggle-dot.is-on {
          background: var(--canteen-products-toggle-on-bg);
        }
        .canteen-product-list-actions,
        .canteen-product-card-grid-actions,
        .canteen-product-card-grid-pills,
        .canteen-product-card-grid-toggles {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .canteen-product-list-actions {
          justify-content: flex-end;
        }
        .canteen-product-list-actions .btn {
          min-width: 0;
          white-space: nowrap;
        }
        .canteen-edit-image-field .product-image-upload {
          gap: 6px;
          padding: 10px;
          border-radius: 18px;
        }
        .canteen-edit-image-field .product-image-upload__head {
          gap: 8px;
        }
        .canteen-edit-image-field .product-image-upload__dropzone {
          display: grid;
          grid-template-columns: 112px minmax(0, 1fr);
          align-items: center;
          justify-items: stretch;
          gap: 10px;
          padding: 10px;
          min-height: 0;
          text-align: left;
        }
        .canteen-edit-image-field .product-image-upload__preview {
          width: 112px;
          border-radius: 16px;
          justify-self: start;
        }
        .canteen-edit-image-field .product-image-upload__copy {
          align-content: center;
          text-align: left;
          min-width: 0;
          gap: 4px;
        }
        .canteen-edit-image-field .product-image-upload__copy strong {
          font-size: 12px;
          line-height: 1.25;
        }
        .canteen-edit-image-field .product-image-upload__copy span {
          font-size: 11px;
          line-height: 1.35;
        }
        .canteen-edit-image-field .product-image-upload__actions {
          gap: 6px;
        }
        @media (max-width: 1280px) {
          .canteen-product-list-row {
            grid-template-columns: 24px 56px minmax(160px, 1.3fr) 116px 92px 102px 98px 108px;
            gap: 12px;
            padding: 12px 14px;
          }
          .canteen-product-list-name,
          .canteen-product-card-grid-title {
            font-size: 1rem;
          }
          .canteen-product-list-sub,
          .canteen-product-card-grid-subtitle {
            font-size: 0.88rem;
          }
          .canteen-product-list-pill {
            min-height: 34px;
            padding: 0 12px;
            font-size: 0.95rem;
          }
          .canteen-product-list-toggle {
            gap: 8px;
            font-size: 0.95rem;
          }
          .canteen-toggle-dot {
            width: 24px;
            height: 24px;
          }
        }
        @media (max-width: 1080px) {
          .canteen-product-list-row {
            grid-template-columns: 24px 52px minmax(150px, 1fr) 104px 88px 94px 94px 96px;
            gap: 10px;
            padding: 10px 12px;
          }
          .canteen-product-list-media {
            width: 52px;
            height: 52px;
          }
          .canteen-product-list-actions {
            gap: 6px;
          }
          .canteen-product-list-actions .btn {
            padding-inline: 10px;
            font-size: 0.9rem;
          }
        }
        @media (max-width: 920px) {
          .canteen-product-list-row {
            grid-template-columns: 24px 52px minmax(0, 1fr) repeat(5, minmax(0, auto));
          }
          .canteen-product-list-name,
          .canteen-product-card-grid-title {
            font-size: 0.96rem;
          }
          .canteen-product-list-sub,
          .canteen-product-card-grid-subtitle,
          .canteen-product-list-toggle,
          .canteen-product-list-actions .btn,
          .canteen-product-list-pill {
            font-size: 0.85rem;
          }
        }
        .canteen-products-grid {
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        }
        .canteen-create-modal-shell {
          display: grid;
          gap: 18px;
        }
        .canteen-create-modal-header {
          display: grid;
          gap: 6px;
          text-align: center;
        }
        .canteen-create-modal-title {
          font-size: 2rem;
          font-weight: 950;
          letter-spacing: -0.04em;
          color: #1d4ed8;
        }
        .canteen-create-modal-subtitle {
          color: #b91c1c;
          font-size: 0.98rem;
          font-weight: 700;
        }
        .canteen-create-modal-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.88fr);
          gap: 18px;
          align-items: start;
        }
        .canteen-create-modal-form,
        .canteen-create-modal-side {
          display: grid;
          gap: 12px;
          padding: 18px;
          border: 1px solid var(--app-border, var(--border));
          border-radius: 24px;
          background: var(--canteen-products-item-bg);
        }
        .canteen-create-modal-row {
          display: grid;
          grid-template-columns: 150px minmax(0, 1fr);
          gap: 12px;
          align-items: center;
        }
        .canteen-create-modal-row label {
          font-weight: 800;
          color: var(--app-text, var(--text));
        }
        .canteen-create-modal-required {
          color: #dc2626;
          margin-left: 6px;
        }
        .canteen-create-modal-note {
          color: var(--muted);
          font-size: 0.9rem;
          line-height: 1.55;
          font-weight: 700;
        }
        .canteen-create-modal-footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }
        .canteen-create-modal-status {
          color: #b91c1c;
          font-size: 0.95rem;
          font-weight: 800;
        }
        .canteen-product-card-grid-item {
          display: grid;
          gap: 12px;
          padding: 16px;
          border-radius: 24px;
          border: 1px solid var(--app-border, var(--border));
          background: var(--canteen-products-item-bg);
        }
        .canteen-product-card-grid-thumb {
          width: 72px;
          height: 72px;
        }
        .canteen-product-card-grid-pills span {
          min-height: 36px;
          padding: 0 14px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          background: var(--canteen-products-pill-bg);
          font-weight: 900;
        }
        @media (max-width: 768px) {
          .canteen-product-list-row {
            grid-template-columns: 24px 56px minmax(0, 1fr) minmax(88px, auto) minmax(72px, auto);
            grid-template-areas:
              "check media main price stock"
              ". . main active tracking"
              ". . . actions actions";
            align-items: center;
          }
          .canteen-product-list-check {
            grid-area: check;
          }
          .canteen-product-list-media {
            grid-area: media;
          }
          .canteen-product-list-main {
            grid-area: main;
          }
          .canteen-product-list-row > .canteen-product-list-pill:nth-of-type(1) {
            grid-area: price;
          }
          .canteen-product-list-row > .canteen-product-list-pill:nth-of-type(2) {
            grid-area: stock;
          }
          .canteen-product-list-row > .canteen-product-list-toggle:nth-of-type(1) {
            grid-area: active;
          }
          .canteen-product-list-row > .canteen-product-list-toggle:nth-of-type(2) {
            grid-area: tracking;
          }
          .canteen-product-list-actions {
            grid-area: actions;
            justify-content: flex-end;
          }
          .canteen-product-list-pill {
            min-width: 0;
            width: 100%;
            font-size: 0.84rem;
          }
          .canteen-product-list-toggle {
            justify-self: end;
            font-size: 0.82rem;
          }
          .canteen-product-list-actions .btn {
            flex: 0 1 auto;
          }
        }
        @media (max-width: 560px) {
          .canteen-products-panel {
            padding: 14px;
            border-radius: 22px;
          }
          .canteen-create-modal-shell {
            gap: 12px;
          }
          .canteen-product-list-row {
            grid-template-columns: 22px 48px minmax(0, 1fr) minmax(78px, auto);
            grid-template-areas:
              "check media main price"
              ". . main stock"
              ". . active tracking"
              ". . actions actions";
            gap: 8px 10px;
            padding: 10px 12px;
            border-radius: 20px;
          }
          .canteen-product-list-media {
            width: 48px;
            height: 48px;
          }
          .canteen-product-list-name,
          .canteen-product-card-grid-title {
            font-size: 0.92rem;
          }
          .canteen-product-list-sub,
          .canteen-product-card-grid-subtitle {
            font-size: 0.8rem;
          }
          .canteen-product-list-pill {
            min-height: 32px;
            padding: 0 10px;
            font-size: 0.8rem;
          }
          .canteen-product-list-toggle {
            justify-self: start;
            font-size: 0.78rem;
            gap: 6px;
          }
          .canteen-toggle-dot {
            width: 20px;
            height: 20px;
          }
          .canteen-product-list-actions {
            justify-content: stretch;
          }
          .canteen-product-list-actions .btn {
            flex: 1 1 0;
          }
          .canteen-products-category-pill,
          .canteen-products-action-btn,
          .canteen-products-pill-btn {
            min-height: 42px;
            padding: 0 14px;
            font-size: 0.9rem;
          }
          .canteen-create-modal-grid {
            grid-template-columns: 1fr;
            gap: 2px;
          }
          .canteen-create-modal-form,
          .canteen-create-modal-side {
            padding: 12px;
            border-radius: 20px;
          }
          .canteen-create-modal-row {
            grid-template-columns: 1fr;
            gap: 6px;
          }
          .canteen-create-modal-title {
            font-size: 1.6rem;
          }
        }
      `}</style>
      <div className="canteen-products-shell">
        <section className="canteen-products-panel">
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Ürün & Kategori</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ürün, kategori, görünüm ve sıralama ayarları</div>
          </div>
          <div className="canteen-products-toolbar-top">
            <input className="canteen-toolbar-search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Ürün veya kategori ara" />
            <select className="canteen-toolbar-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tümü</option>
              <option value="active">Aktif</option>
              <option value="passive">Pasif</option>
            </select>
            <select
              className="canteen-toolbar-select"
              value={selectedBranchId}
              onChange={(event) => {
                setSelectedBranchId(event.target.value)
                resetCreateForm()
                setQ('')
              }}
            >
              {visibleBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <button className="canteen-products-action-btn" type="button" onClick={() => load(selectedBranchId)} disabled={loading}>Yenile</button>
          </div>
          <div className="canteen-products-toolbar-actions">
            <button className="canteen-products-action-btn" type="button" onClick={() => setStockModalOpen(true)} disabled={!selectedBranchId}>
              Stoklar
            </button>
            <button
              className="canteen-products-action-btn"
              type="button"
              onClick={openCreateModal}
              disabled={!canManage}
            >
              + Yeni Ürün Ekle
            </button>
            <button className="canteen-products-action-btn" type="button" onClick={openNewCategory} disabled={!canManage}>+ Yeni Kategori Ekle</button>
            {canManage ? <CanteenBulkProductsExcelCard branchId={selectedBranchId} onImportDone={() => load(selectedBranchId)} compact /> : null}
            <button className={`canteen-products-pill-btn ${viewMode === 'list' ? 'is-active' : ''}`} type="button" onClick={() => setViewMode('list')}>Liste Görünümü</button>
            <button className={`canteen-products-pill-btn ${viewMode === 'card' ? 'is-active' : ''}`} type="button" onClick={() => setViewMode('card')}>Kart Görünümü</button>
            <div className="canteen-products-pill-btn">Seçili: {selectedIds.length}</div>
          </div>
        </section>

        <section className="canteen-products-panel">
          <div className="canteen-products-category-strip">
            {categoryTabs.map((tab) => (
              <div key={tab.key} className="canteen-products-category-pill-wrap">
                <button
                  type="button"
                  className={`canteen-products-category-pill ${activeTab === tab.key ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
                {tab.category ? (
                  <button
                    type="button"
                    className="canteen-products-category-edit-btn"
                    onClick={() => openEditCategory(tab.category)}
                    disabled={!canManage}
                    aria-label={`${tab.label} kategorisini düzenle`}
                    title="Kategoriyi düzenle"
                  >
                    <PencilIcon />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {!!error ? <div className="card" style={{ borderColor: 'color-mix(in srgb, #ef4444 35%, var(--app-border))', background: 'color-mix(in srgb, #ef4444 10%, var(--app-surface))', color: 'var(--app-text)' }}>{error}</div> : null}
        {branches.length === 0 ? <div className="card">Şube yok, önce Şube Ayarları bölümünden şube ekleyin.</div> : null}
        {me?.role !== 'tenant_admin' && Array.isArray(allowedIds) && allowedIds.length === 0 && branches.length > 0 ? <div className="card">Yetkili şube yok.</div> : null}

        {loading ? <div className="card">Yükleniyor...</div> : null}
        {!loading && filtered.length === 0 ? <div className="card">Filtreye uygun ürün bulunamadı.</div> : null}
        {!loading && filtered.length > 0 ? (
          <section className={viewMode === 'list' ? 'canteen-products-list' : 'canteen-products-grid'}>
            {filtered.map(renderProductRow)}
          </section>
        ) : null}

      </div>

      <Modal
        open={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        title="Stoklar"
        dialogStyle={{
          width: isMobilePortrait ? 'calc(100% - 2px)' : 'min(1240px, calc(100vw - 24px))',
          maxWidth: '100%',
          maxHeight: isMobilePortrait ? 'calc(100dvh - 2px)' : 'calc(100dvh - 20px)',
          justifySelf: 'center'
        }}
        bodyStyle={{ padding: isMobilePortrait ? 1 : 18 }}
      >
        <Suspense fallback={<div style={{ color: 'var(--muted)', padding: 12 }}>Stok ekranı yükleniyor...</div>}>
          <LazyCanteenStockWorkspace
            me={me}
            controlledBranchId={selectedBranchId}
            showBranchSelector={false}
            embedded
            refreshToken={stockWorkspaceRefreshKey}
            onCreateProduct={openCreateModal}
            onEditProduct={openEdit}
            onDeleteProduct={(item) => remove(item?.id)}
            onOpenCategories={openCategoryBrowser}
          />
        </Suspense>
      </Modal>
      <Modal
        open={categoryBrowserOpen}
        onClose={() => setCategoryBrowserOpen(false)}
        title="Ürün Grupları"
        dialogStyle={{ width: 'min(760px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 24px)' }}
        bodyStyle={{ maxHeight: 'calc(100dvh - 150px)', overflowY: 'auto' }}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Kategori seçip düzenleyebilirsin.</div>
            <button className="btn btn--primary" type="button" onClick={openNewCategory} disabled={!canManage}>+ Yeni Kategori Ekle</button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {sortedCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                className="btn btn--full btn--between"
                onClick={() => openEditCategory(category)}
                disabled={!canManage}
                style={{ justifyContent: 'space-between', minHeight: 60 }}
              >
                <span style={{ display: 'grid', textAlign: 'left' }}>
                  <span style={{ fontWeight: 800 }}>{category.name || '-'}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                    Sıra: {Number(category?.sortOrder || 0)} • Durum: {category?.isActive === false ? 'Pasif' : 'Aktif'}
                  </span>
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>Düzenle</span>
              </button>
            ))}
            {sortedCategories.length === 0 ? <div className="card">Henüz kategori yok.</div> : null}
          </div>
        </div>
      </Modal>
      <Modal
        open={createOpen}
        onClose={closeCreateModal}
        title=""
        dialogStyle={{
          width: isMobilePortrait ? 'calc(100% - 4px)' : 'min(1040px, calc(100vw - 24px))',
          maxWidth: '100%',
          maxHeight: isMobilePortrait ? 'calc(100dvh - 4px)' : 'calc(100dvh - 20px)',
          justifySelf: 'center'
        }}
        bodyStyle={{ padding: isMobilePortrait ? 2 : 22 }}
      >
        <form className="canteen-create-modal-shell" onSubmit={create}>
          <div className="canteen-create-modal-header">
            <div className="canteen-create-modal-title">ÜRÜN GİRİŞİ</div>
            <div className="canteen-create-modal-subtitle">Barkod okutun veya barkod numarası yazın</div>
          </div>

          <div className="canteen-create-modal-grid">
            <div className="canteen-create-modal-form">
              <div className="canteen-create-modal-row">
                <label htmlFor="create-barcode">Barkod No:<span className="canteen-create-modal-required">*</span></label>
                <input
                  id="create-barcode"
                  ref={createBarcodeRef}
                  className="input"
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  disabled={!canManage}
                  style={{ background: '#fff9c4' }}
                />
              </div>
              <div className="canteen-create-modal-row">
                <label htmlFor="create-name">Ürünün Adı<span className="canteen-create-modal-required">*</span></label>
                <input id="create-name" className="input" value={name} onChange={(event) => setName(event.target.value)} disabled={!canManage} />
              </div>
              <div className="canteen-create-modal-row">
                <label htmlFor="create-category">Ürün Grubu Seç</label>
                <select id="create-category" style={selectStyles} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={!canManage}>
                  <option value="">Belirtilmedi</option>
                  {sortedCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div className="canteen-create-modal-row">
                <label htmlFor="create-buy-price">Alış Fiyatı</label>
                <input id="create-buy-price" className="input" value={buyPrice} onChange={(event) => setBuyPrice(event.target.value)} disabled={!canManage} />
              </div>
              <div className="canteen-create-modal-row">
                <label>KDV Seçeneği</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className={`btn btn--compact ${vatIncluded ? 'btn--primary' : ''}`} type="button" onClick={() => setVatIncluded(true)} disabled={!canManage}>KDV Dahil</button>
                  <button className={`btn btn--compact ${vatIncluded ? '' : 'btn--primary'}`} type="button" onClick={() => setVatIncluded(false)} disabled={!canManage}>KDV Hariç</button>
                </div>
              </div>
              <div className="canteen-create-modal-row">
                <label htmlFor="create-sell-price">Satış Fiyatı<span className="canteen-create-modal-required">*</span></label>
                <input id="create-sell-price" className="input" value={sellPrice} onChange={(event) => setSellPrice(event.target.value)} disabled={!canManage} />
              </div>
              <div className="canteen-create-modal-row">
                <label htmlFor="create-vat-rate">KDV Oranı %</label>
                <select id="create-vat-rate" style={selectStyles} value={vatRate} onChange={(event) => setVatRate(event.target.value)} disabled={!canManage}>
                  {VAT_OPTIONS.map((rate) => <option key={rate} value={String(rate)}>{rate}</option>)}
                </select>
              </div>
              <div className="canteen-create-modal-row">
                <label htmlFor="create-stock-qty">Mevcut Stok Miktarı</label>
                <input
                  id="create-stock-qty"
                  className="input"
                  value={stockQty}
                  onChange={(event) => setStockQty(event.target.value)}
                  disabled={!canManage || !stockTrackingEnabled}
                  placeholder={stockTrackingEnabled ? 'Stok miktarı girin' : 'Önce stok takibini açın'}
                />
              </div>
              <div className="canteen-create-modal-row">
                <label htmlFor="create-min-stock">Asgari Stok</label>
                <input
                  id="create-min-stock"
                  className="input"
                  value={minimumStock}
                  onChange={(event) => setMinimumStock(event.target.value)}
                  disabled={!canManage || !stockTrackingEnabled}
                  placeholder={stockTrackingEnabled ? 'Asgari stok girin' : 'Önce stok takibini açın'}
                />
              </div>
              <div className="canteen-create-modal-row">
                <label>Stok Takibi</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className={`btn btn--compact ${stockTrackingEnabled ? 'btn--primary' : ''}`} type="button" onClick={() => setStockTrackingEnabled(true)} disabled={!canManage}>Stok Takibi Açık</button>
                  <button className={`btn btn--compact ${stockTrackingEnabled ? '' : 'btn--primary'}`} type="button" onClick={() => setStockTrackingEnabled(false)} disabled={!canManage}>Stok Takibi Kapalı</button>
                </div>
              </div>
            </div>

            <div className="canteen-create-modal-side">
              <ProductImageUploadField
                currentImageUrl=""
                file={imageFile}
                error={imageError}
                disabled={!canManage}
                descriptionText="Yuklenen gorsel satis ekranlarinda bu urun icin gosterilir."
                onFileChange={(nextFile, validationMessage) => {
                  setImageError(validationMessage || '')
                  setImageFile(validationMessage ? null : nextFile)
                }}
                onClearFile={() => {
                  setImageFile(null)
                  setImageError('')
                }}
              />
            </div>
          </div>

          <div className="canteen-create-modal-footer">
            <div className="canteen-create-modal-status">* Girilmesi mecburi olan alanlar</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="btn" type="button" onClick={closeCreateModal}>Vazgeç</button>
              <button className="btn btn--primary" type="submit" disabled={!isCreateFormValid}>Kaydet</button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Ürün Düzenle"
        dialogStyle={{
          width: isMobilePortrait ? 'calc(100% - 4px)' : 'min(920px, calc(100vw - 32px))',
          maxWidth: '100%',
          maxHeight: isMobilePortrait ? 'calc(100dvh - 4px)' : 'calc(100dvh - 24px)',
          justifySelf: 'center'
        }}
        bodyStyle={{
          maxHeight: 'calc(100dvh - 150px)',
          overflowY: 'auto',
          padding: isMobilePortrait ? 2 : 22,
          paddingBottom: isMobilePortrait ? 2 : 18
        }}
      >
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
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className={`btn btn--compact ${editVatIncluded ? 'btn--primary' : ''}`} type="button" onClick={() => setEditVatIncluded(true)} disabled={!canManage}>KDV Dahil</button>
            <button className={`btn btn--compact ${editVatIncluded ? '' : 'btn--primary'}`} type="button" onClick={() => setEditVatIncluded(false)} disabled={!canManage}>KDV Hariç</button>
            <select style={{ ...selectStyles, maxWidth: 180 }} value={editVatRate} onChange={(event) => setEditVatRate(event.target.value)} disabled={!canManage}>
              {VAT_OPTIONS.map((rate) => <option key={rate} value={String(rate)}>{rate}%</option>)}
            </select>
          </div>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kategori</div>
            <select style={selectStyles} value={editCategoryId} onChange={(event) => setEditCategoryId(event.target.value)} disabled={!canManage}>
              <option value="">Diğer Ürünler fallback</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <div className="stackRow" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button className={`btn btn--compact ${editStockTrackingEnabled ? 'btn--primary' : ''}`} type="button" onClick={() => setEditStockTrackingEnabled(true)} disabled={!canManage}>Stok Takibi Açık</button>
              <button className={`btn btn--compact ${editStockTrackingEnabled ? '' : 'btn--primary'}`} type="button" onClick={() => setEditStockTrackingEnabled(false)} disabled={!canManage}>Stok Takibi Kapalı</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Stok</span>
                <input
                  className="input"
                  value={editStockQty}
                  onChange={(event) => setEditStockQty(event.target.value)}
                  disabled={!canManage || !editStockTrackingEnabled}
                  placeholder={editStockTrackingEnabled ? 'Stok' : 'Takip kapalı'}
                  style={{ width: '100%', maxWidth: 180, height: 38 }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Asgari Stok</span>
                <input
                  className="input"
                  value={editMinimumStock}
                  onChange={(event) => setEditMinimumStock(event.target.value)}
                  disabled={!canManage || !editStockTrackingEnabled}
                  placeholder={editStockTrackingEnabled ? 'Asgari stok' : 'Takip kapalı'}
                  style={{ width: '100%', maxWidth: 180, height: 38 }}
                />
              </label>
            </div>
          </div>
          <label className="canteen-edit-image-field">
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Görsel Yükle</div>
            <ProductImageUploadField
              currentImageUrl={editImageUrl}
              file={editImageFile}
              error={editImageError}
              compact
              disabled={!canManage}
              descriptionText="Yuklenen gorsel satis ekranlarinda bu urun icin gosterilir."
              onFileChange={(nextFile, validationMessage) => {
                setEditImageError(validationMessage || '')
                setEditImageFile(validationMessage ? null : nextFile)
              }}
              onClearFile={() => {
                setEditImageFile(null)
                setEditImageError('')
              }}
              onRemoveExisting={removeEditImage}
            />
          </label>
          <div className="actionWrap" style={{ justifyContent: 'flex-end', position: 'sticky', bottom: 0, paddingTop: 10, background: 'linear-gradient(180deg, rgba(255,255,255,0), var(--app-surface, #fff) 38%)' }}>
            <button className="btn" type="button" onClick={() => setEditOpen(false)}>Vazgeç</button>
            <button className="btn btn--primary" type="button" onClick={submitEdit} disabled={!String(editName || '').trim() || !String(editBarcode || '').trim()}>
              Kaydet
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={categoryForm.id ? 'Kategori Düzenle' : 'Yeni Kategori'}
        dialogStyle={{
          width: isMobilePortrait ? 'calc(100% - 4px)' : 'min(920px, calc(100vw - 32px))',
          maxWidth: '100%',
          maxHeight: isMobilePortrait ? 'calc(100dvh - 4px)' : 'calc(100dvh - 24px)',
          justifySelf: 'center'
        }}
        bodyStyle={{ padding: isMobilePortrait ? 2 : 22 }}
      >
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
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sıralama</div>
            <input className="input" value={categoryForm.sortOrder} onChange={(event) => setCategoryForm((current) => ({ ...current, sortOrder: event.target.value }))} disabled={!canManage} />
          </label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className={`btn btn--compact ${categoryForm.isActive === false ? '' : 'btn--primary'}`}
              type="button"
              onClick={() => setCategoryForm((current) => ({ ...current, isActive: true }))}
              disabled={!canManage}
            >
              Aktif
            </button>
            <button
              className={`btn btn--compact ${categoryForm.isActive === false ? 'btn--danger' : ''}`}
              type="button"
              onClick={() => setCategoryForm((current) => ({ ...current, isActive: false }))}
              disabled={!canManage}
            >
              Pasif
            </button>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Durum: {categoryForm.isActive === false ? 'Pasif' : 'Aktif'}
            </div>
          </div>
          <label className="canteen-edit-image-field">
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Görsel Yükle</div>
            <ProductImageUploadField
              currentImageUrl={categoryForm.imageUrl}
              file={categoryImageFile}
              error={categoryImageError}
              compact
              disabled={!canManage || categorySaving}
              helperText="JPG, PNG veya WEBP. Maksimum 5 MB, kategori kartı için optimize edilerek saklanır."
              descriptionText="Yuklenen gorsel satis ekranlarinda bu kategori icin gosterilir."
              onFileChange={(nextFile, validationMessage) => {
                setCategoryImageError(validationMessage || '')
                setCategoryImageFile(validationMessage ? null : nextFile)
              }}
              onClearFile={() => {
                setCategoryImageFile(null)
                setCategoryImageError('')
              }}
              onRemoveExisting={categoryForm.id ? removeCategoryImage : undefined}
            />
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
