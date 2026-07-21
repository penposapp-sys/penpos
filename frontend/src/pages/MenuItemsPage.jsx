import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import Modal from '../components/Modal.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import ProductImage from '../components/ProductImage.jsx'
import ProductImageUploadField from '../components/ProductImageUploadField.jsx'
import BranchAccessField from '../components/settings/BranchAccessField.jsx'
import { SettingsUiStyles } from '../components/settings/SettingsUi.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../lib/apiClient.js'
import { getSubscriptionStatus } from '../lib/subscription.js'
import { normalizeBranchIdList } from '../lib/branchVisibility.js'
import { optimizeProductImageForUpload } from '../lib/productImage.js'
import { toast } from '../lib/toast.js'
import { getAuthToken } from '../lib/authStorage.js'
import ProductCatalogStyles from './ProductCatalogStyles.jsx'
import {
  buildProductPayload,
  createEmptyProductForm,
  inflateProductForm,
  mergeProductSettings
} from './productCatalogShared.js'

function HorizontalScrollStrip({ className = '', children, style = {} }) {
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({ active: false, startX: 0, startLeft: 0, moved: false })

  return (
    <div
      className={className}
      style={{ ...style, userSelect: dragging ? 'none' : undefined }}
      onDragStart={(event) => event.preventDefault()}
      onMouseDown={(event) => {
        if (event.button !== 0) return
        const node = event.currentTarget
        dragRef.current = {
          active: true,
          startX: event.clientX,
          startLeft: node.scrollLeft,
          moved: false
        }
        setDragging(true)
      }}
      onMouseMove={(event) => {
        const drag = dragRef.current
        if (!drag.active) return
        const node = event.currentTarget
        const delta = event.clientX - drag.startX
        if (Math.abs(delta) > 4) drag.moved = true
        node.scrollLeft = drag.startLeft - delta
      }}
      onMouseUp={() => {
        dragRef.current.active = false
        setDragging(false)
      }}
      onMouseLeave={() => {
        dragRef.current.active = false
        setDragging(false)
      }}
      onClickCapture={(event) => {
        if (!dragRef.current.moved) return
        event.preventDefault()
        event.stopPropagation()
        dragRef.current.moved = false
      }}
    >
      {children}
    </div>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
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

function KebabMenu({ items = [], className = '' }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const [style, setStyle] = useState({ top: 0, left: 0, minWidth: 180 })
  const enabledItems = items.filter(Boolean)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || typeof window === 'undefined') return undefined

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const menuWidth = Math.max(180, menuRef.current?.offsetWidth || 180)
      const estimatedHeight = Math.max(140, Math.min(320, menuRef.current?.offsetHeight || (enabledItems.length * 44) + 16))
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
      const spaceBelow = viewportHeight - rect.bottom - 12
      const openUpward = spaceBelow < Math.min(estimatedHeight, 220) && rect.top > spaceBelow
      const top = openUpward
        ? Math.max(12, rect.top - estimatedHeight - 8)
        : Math.min(viewportHeight - estimatedHeight - 12, rect.bottom + 8)
      const left = Math.max(12, Math.min(rect.right - menuWidth, viewportWidth - menuWidth - 12))
      const maxHeight = openUpward ? Math.max(120, rect.top - 20) : Math.max(120, viewportHeight - top - 12)
      setStyle({ top, left, minWidth: menuWidth, maxHeight })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [enabledItems.length, open])

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      const target = event.target
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className={`product-kebab-portal${className ? ` ${className}` : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`product-kebab-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        ...
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
        <div ref={menuRef} className="product-kebab-menu" role="menu" style={style}>
          {enabledItems.map((item) => (
            <button
              key={item.key || item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false)
                if (!item.disabled && typeof item.onClick === 'function') item.onClick()
              }}
              style={item.danger ? { color: '#b42318' } : undefined}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      ) : null}
    </div>
  )
}

const parseFilenameFromDisposition = (value) => {
  const v = String(value || '')
  const match = v.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i)
  const raw = match?.[1] || match?.[2] || ''
  try {
    const decoded = decodeURIComponent(raw)
    return decoded || null
  } catch {
    return raw || null
  }
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

const fetchWithAuth = async (path, options = {}) => {
  const token = getAuthToken('token_restaurant')
  const selectedBranchId = localStorage.getItem('selectedBranchId')
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(selectedBranchId ? { 'x-branch-id': selectedBranchId } : {}),
    ...(options.headers || {})
  }
  return fetch(path, { ...options, headers })
}

const createEmptyCategoryForm = (category = null) => {
  const branchIds = Array.isArray(category?.branchIds) ? category.branchIds.map((branchId) => String(branchId)) : []
  return {
    id: String(category?.id || ''),
    name: String(category?.name || ''),
    sortOrder: Number(category?.sortOrder || 0),
    isActive: category?.isActive !== false,
    qrMenuVisible: category?.qrMenuVisible !== false,
    branchIds,
    allBranches: branchIds.length === 0
  }
}

function Toggle({ checked = false, onChange, disabled = false }) {
  return (
    <button
      type="button"
      className={`product-toggle ${checked ? 'active' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        justifyContent: checked ? 'flex-end' : 'flex-start',
        background: checked
          ? 'linear-gradient(135deg, #22c55e, #16a34a)'
          : '#d1d5db'
      }}
    >
      <i />
    </button>
  )
}

function Field({ label, children }) {
  return (
    <label className="product-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function ToggleCard({ title, description, checked, onChange }) {
  return (
    <div className="product-toggle-card">
      <div>
        <div style={{ fontWeight: 900, color: 'var(--app-text)' }}>{title}</div>
        <div style={{ color: 'var(--app-text-muted)', fontSize: 13, fontWeight: 700, marginTop: 4 }}>{description}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

function CategorySortModal({ open, categories, draftCategories, setDraftCategories, saving, onClose, onSave }) {
  if (!open) return null
  const move = (index, direction) => {
    const next = [...draftCategories]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setDraftCategories(next)
  }

  return (
    <Modal open={open} onClose={onClose} title="Kategori Sıralamasını Düzenle" dialogStyle={{ maxWidth: 720 }}>
      <div className="app-modal-body scrollbar-hidden" style={{ display: 'grid', gap: 12, padding: 0 }}>
        {(draftCategories.length > 0 ? draftCategories : categories).map((category, index) => (
          <div key={category.id} className="product-inline-table-row" style={{ gridTemplateColumns: '46px 1fr 48px 48px' }}>
            <div className="product-chip" style={{ background: 'var(--app-surface-2, var(--app-surface-soft))', color: 'var(--app-text)' }}>{index + 1}</div>
            <div style={{ fontWeight: 900, paddingBottom: 10 }}>{category.name}</div>
            <button type="button" className="product-secondary-btn" onClick={() => move(index, -1)}>↑</button>
            <button type="button" className="product-secondary-btn" onClick={() => move(index, 1)}>↓</button>
          </div>
        ))}
      </div>
      <div className="product-modal-footer-row">
        <button type="button" className="product-secondary-btn" onClick={onClose}>İptal</button>
        <button type="button" className="product-dark-btn" onClick={onSave} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
      </div>
    </Modal>
  )
}

export default function MenuItemsPage() {
  const navigate = useNavigate()
  const { tenantCtx } = useAuth()
  const isExpired = getSubscriptionStatus(tenantCtx) === 'expired'
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingRowId, setSavingRowId] = useState('')
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('card')
  const [activeTab, setActiveTab] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('')
  const [priceEditorItemId, setPriceEditorItemId] = useState('')
  const [priceDraft, setPriceDraft] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [createOpen, setCreateOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [sortSaving, setSortSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [createForm, setCreateForm] = useState(createEmptyProductForm())
  const [createImageFile, setCreateImageFile] = useState(null)
  const [createImageError, setCreateImageError] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [draftCategories, setDraftCategories] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkResult, setBulkResult] = useState(null)
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false)
  const [categoryForm, setCategoryForm] = useState(createEmptyCategoryForm())
  const [categoryDeleteTarget, setCategoryDeleteTarget] = useState(null)
  const [categoryDeleteLoading, setCategoryDeleteLoading] = useState(false)

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0) || String(a?.name || '').localeCompare(String(b?.name || ''), 'tr'))
  }, [categories])

  const categoryTabs = useMemo(() => ([
    { key: 'all', label: 'Tümü', special: true, category: null },
    { key: 'favorites', label: 'Favoriler', special: true, category: null },
    ...sortedCategories.map((category) => ({
      key: `category:${category.id}`,
      label: category.name,
      special: false,
      category
    }))
  ]), [sortedCategories])

  const importErrors = useMemo(() => (Array.isArray(bulkResult?.errors) ? bulkResult.errors : []), [bulkResult])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [itemRes, categoryRes, branchRes] = await Promise.all([
        api('/api/tenant/menu-items', { skipBranchHeader: true }),
        api('/api/tenant/categories', { skipBranchHeader: true }),
        api('/api/branches', { skipBranchHeader: true })
      ])
      setItems((Array.isArray(itemRes?.items) ? itemRes.items : []).filter((item) => item?.isDeleted !== true))
      setCategories((Array.isArray(categoryRes?.categories) ? categoryRes.categories : []).filter((item) => item?.isDeleted !== true))
      setBranches((Array.isArray(branchRes?.branches) ? branchRes.branches : []).filter((item) => item?.isActive !== false))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const root = document.querySelector('.page-scroll-area')
    if (root) root.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const handleMenuItemUpdated = (event) => {
      const nextItem = event?.detail?.item
      if (!nextItem?.id) return
      setItems((prev) => prev.map((item) => (String(item.id) === String(nextItem.id) ? nextItem : item)))
    }
    window.addEventListener('menu_item_updated', handleMenuItemUpdated)
    return () => window.removeEventListener('menu_item_updated', handleMenuItemUpdated)
  }, [])

  useEffect(() => {
    const firstCategoryId = sortedCategories[0]?.id || ''
    setCreateForm((prev) => (prev.categoryId ? prev : { ...prev, categoryId: firstCategoryId }))
  }, [sortedCategories])

  useEffect(() => {
    if (!String(activeTab).startsWith('category:')) return
    const activeCategoryId = String(activeTab).slice('category:'.length)
    const exists = sortedCategories.some((category) => String(category.id) === activeCategoryId)
    if (!exists) setActiveTab('all')
  }, [activeTab, sortedCategories])

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      const settings = mergeProductSettings(item?.settings)
      const category = sortedCategories.find((entry) => String(entry.id) === String(item.categoryId))
      const activeCategoryId = String(activeTab).startsWith('category:') ? String(activeTab).slice('category:'.length) : ''
      const matchesTab = activeTab === 'all'
        ? true
        : activeTab === 'favorites'
          ? settings.isFavorite === true
          : String(item.categoryId || '') === activeCategoryId
      const matchesSearch = !searchText || `${item?.name || ''} ${category?.name || ''}`.toLocaleLowerCase('tr-TR').includes(searchText.toLocaleLowerCase('tr-TR'))
      const matchesActive = activeFilter === 'all' ? true : activeFilter === 'true' ? item?.isActive !== false : item?.isActive === false
      const branchIds = normalizeBranchIdList(item?.branchIds)
      const matchesBranch = !branchFilter ? true : branchIds.length === 0 || branchIds.includes(String(branchFilter))
      return matchesTab && matchesSearch && matchesActive && matchesBranch
    })
    return filtered.sort((a, b) => {
      const categoryA = sortedCategories.find((entry) => String(entry.id) === String(a?.categoryId || ''))
      const categoryB = sortedCategories.find((entry) => String(entry.id) === String(b?.categoryId || ''))
      const categorySort = Number(categoryA?.sortOrder ?? Number.MAX_SAFE_INTEGER) - Number(categoryB?.sortOrder ?? Number.MAX_SAFE_INTEGER)
      if (categorySort !== 0) return categorySort
      const itemSort = Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0)
      if (itemSort !== 0) return itemSort
      return String(a?.name || '').localeCompare(String(b?.name || ''), 'tr')
    })
  }, [activeFilter, activeTab, branchFilter, items, searchText, sortedCategories])

  const toggleSelected = (itemId) => {
    setSelectedIds((prev) => prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId])
  }

  const openPriceEditor = (item) => {
    setPriceEditorItemId(String(item?.id || ''))
    setPriceDraft(String(Number(item?.price || 0).toFixed(2)))
  }

  const closePriceEditor = () => {
    setPriceEditorItemId('')
    setPriceDraft('')
  }

  const saveInlinePrice = async (item) => {
    const normalizedPrice = Number(String(priceDraft || '').replace(',', '.'))
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
      toast.error('Gecerli bir fiyat girin')
      return
    }
    if (Number(item?.price || 0) === normalizedPrice) {
      closePriceEditor()
      return
    }
    await updateItem(item, { price: normalizedPrice })
    closePriceEditor()
  }

  const buildUpdatedItem = (item, patch = {}, settingsPatch = {}) => {
    const current = inflateProductForm({
      ...item,
      settings: {
        ...mergeProductSettings(item?.settings),
        ...settingsPatch
      },
      ...patch
    })
    return buildProductPayload(current)
  }

  const updateItem = async (item, patch = {}, settingsPatch = {}) => {
    setSavingRowId(String(item.id))
    setError('')
    try {
      const response = await api(`/api/tenant/menu-items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(buildUpdatedItem(item, patch, settingsPatch)),
        skipBranchHeader: true
      })
      setItems((prev) => prev.map((row) => (String(row.id) === String(item.id) ? response.item : row)))
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingRowId('')
    }
  }

  const createProduct = async (form) => {
    setSubmitting(true)
    setError('')
    try {
      const response = await api('/api/tenant/menu-items', {
        method: 'POST',
        body: JSON.stringify(buildProductPayload(form)),
        skipBranchHeader: true
      })
      let createdItem = response?.item || null
      if (createdItem?.id && createImageFile) {
        const preparedFile = await optimizeProductImageForUpload(createImageFile)
        const formData = new FormData()
        formData.append('file', preparedFile || createImageFile)
        const uploadResponse = await api(`/api/tenant/menu-items/${createdItem.id}/image`, {
          method: 'POST',
          body: formData,
          skipBranchHeader: true
        })
        createdItem = uploadResponse?.item || createdItem
      }
      await loadData()
      return createdItem
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setSubmitting(false)
    }
  }

  const createCategory = async () => {
    if (!categoryName.trim()) {
      setError('Kategori adı zorunlu.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api('/api/tenant/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: categoryName.trim(),
          sortOrder: sortedCategories.length,
          qrMenuVisible: true
        }),
        skipBranchHeader: true
      })
      setCategoryName('')
      setCategoryOpen(false)
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const saveCategoryOrder = async () => {
    setSortSaving(true)
    setError('')
    try {
      for (let index = 0; index < draftCategories.length; index += 1) {
        const category = draftCategories[index]
        await api(`/api/tenant/categories/${category.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: category.name,
            sortOrder: index,
            isActive: category.isActive !== false,
            qrMenuVisible: category.qrMenuVisible !== false,
            allBranches: Array.isArray(category.branchIds) ? category.branchIds.length === 0 : true,
            branchIds: Array.isArray(category.branchIds) ? category.branchIds : []
          }),
          skipBranchHeader: true
        })
      }
      setSortOpen(false)
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSortSaving(false)
    }
  }

  const saveCategoryDetail = async () => {
    if (!categoryForm.id) return
    if (!categoryForm.name.trim()) {
      setError('Kategori adı zorunlu.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api(`/api/tenant/categories/${categoryForm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: categoryForm.name.trim(),
          sortOrder: Number(categoryForm.sortOrder || 0),
          isActive: categoryForm.isActive !== false,
          qrMenuVisible: categoryForm.qrMenuVisible !== false,
          allBranches: categoryForm.allBranches !== false,
          branchIds: categoryForm.allBranches ? [] : (Array.isArray(categoryForm.branchIds) ? categoryForm.branchIds : [])
        }),
        skipBranchHeader: true
      })
      setCategoryEditorOpen(false)
      setCategoryForm(createEmptyCategoryForm())
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const deleteCategory = async () => {
    if (!categoryDeleteTarget?.id) return
    setCategoryDeleteLoading(true)
    setError('')
    try {
      const result = await api(`/api/tenant/categories/${categoryDeleteTarget.id}`, { method: 'DELETE', skipBranchHeader: true })
      setCategoryDeleteTarget(null)
      setCategoryEditorOpen(false)
      setCategoryForm(createEmptyCategoryForm())
      if (activeTab === `category:${categoryDeleteTarget.id}`) setActiveTab('all')
      toast.success(`Kategori silindi${Number(result?.deletedItemCount || 0) > 0 ? `, ${Number(result.deletedItemCount)} ürün de kaldırıldı` : ''}`)
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setCategoryDeleteLoading(false)
    }
  }

  const onDownloadExcel = async (path, fallbackName) => {
    setBulkBusy(true)
    try {
      const res = await fetchWithAuth(path)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'İndirme başarısız')
      }
      const filename = parseFilenameFromDisposition(res.headers.get('content-disposition')) || fallbackName
      const blob = await res.blob()
      downloadBlob(blob, filename)
      toast.success('İndirme başladı')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBulkBusy(false)
    }
  }

  const onUploadExcel = async (event) => {
    event.preventDefault()
    if (!bulkFile) {
      toast.error('Lütfen bir dosya seçin')
      return
    }
    setBulkBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', bulkFile)
      const res = await fetchWithAuth('/api/settings/products/import', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.success === false) {
        throw new Error(data.message || 'Yükleme başarısız')
      }
      setBulkResult(data)
      setResultOpen(true)
      setImportOpen(false)
      setBulkFile(null)
      await loadData()
      toast.success('Excel içe aktarma tamamlandı')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBulkBusy(false)
    }
  }

  const deleteItem = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setError('')
    try {
      await api(`/api/tenant/menu-items/${deleteTarget.id}`, { method: 'DELETE', skipBranchHeader: true })
      setDeleteTarget(null)
      setItems((prev) => prev.filter((item) => String(item.id) !== String(deleteTarget.id)))
      toast.success('Ürün kalıcı olarak silindi')
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  const openSortModal = () => {
    setDraftCategories(sortedCategories.map((category) => ({ ...category })))
    setSortOpen(true)
  }

  const openCategoryEditor = (category) => {
    setCategoryForm(createEmptyCategoryForm(category))
    setCategoryEditorOpen(true)
  }

  const deleteItemConfirmTitle = 'Ürünü Kalıcı Sil'
  const deleteItemConfirmMessage = 'Bu ürün menüden tamamen silinecek. Geçmiş satış ve rapor kayıtlarındaki ürün adı korunur, ancak ürün kartının kendisi geri gelmez.'
  const deleteItemConfirmText = 'Ürünü Sil'
  const deleteCategoryConfirmTitle = 'Kategoriyi Kalıcı Sil'
  const deleteCategoryConfirmMessage = `${categoryDeleteTarget?.name || 'Bu kategori'} kalıcı olarak silinecek.${Number(categoryDeleteTarget?.itemCount || 0) > 0 ? ` Altındaki ${Number(categoryDeleteTarget?.itemCount || 0)} ürün de birlikte silinecek.` : ''} Geçmiş sipariş ve raporlardaki isimler korunur. Emin misiniz?`

  const formatCategoryBadge = (category) => {
    if (!category) return 'Kategori yok'
    const orderLabel = typeof category?.sortOrder === 'number' ? `#${category.sortOrder + 1}` : null
    const nameLabel = String(category?.name || '').trim() || null
    if (orderLabel && nameLabel) return `${orderLabel} · ${nameLabel}`
    if (nameLabel) return nameLabel
    if (orderLabel) return orderLabel
    return 'Kategori yok'
  }

  const formatCategoryMeta = (category) => {
    if (!category) return 'Kategori yok'
    const orderLabel = typeof category?.sortOrder === 'number' ? `Kategori ${category.sortOrder + 1}` : null
    const nameLabel = String(category?.name || '').trim() || null
    if (orderLabel && nameLabel) return `${orderLabel} · ${nameLabel}`
    if (nameLabel) return nameLabel
    if (orderLabel) return orderLabel
    return 'Kategori yok'
  }

  const renderProductCard = (item) => {
    const settings = mergeProductSettings(item?.settings)
    const isSaving = savingRowId === String(item.id)
    const category = sortedCategories.find((entry) => String(entry.id) === String(item.categoryId))
    const thumbText = String(item?.name || 'U').slice(0, 2).toUpperCase()
    const categoryBadgeText = formatCategoryBadge(category)
    const categoryMetaText = formatCategoryMeta(category)
    const actionItems = [
      {
        key: 'settings',
        label: 'Ürün Ayarları',
        onClick: () => navigate(`/kermes/settings/catalog/items/${item.id}`)
      },
      {
        key: 'active',
        label: item.isActive === false ? 'Aktif Yap' : 'Pasife Al',
        onClick: () => updateItem(item, { isActive: item.isActive === false })
      },
      viewMode === 'list'
        ? {
            key: 'favorite',
            label: settings.isFavorite ? 'Favoriden Çıkar' : 'Favori Yap',
            onClick: () => updateItem(item, {}, { isFavorite: !settings.isFavorite })
          }
        : null,
      viewMode === 'list'
        ? {
            key: 'qr',
            label: settings.qrMenuVisible ? 'QR Menüyü Gizle' : 'QR Menüde Göster',
            onClick: () => updateItem(item, {}, { qrMenuVisible: !settings.qrMenuVisible })
          }
        : null,
      {
        key: 'delete',
        label: 'Sil',
        danger: true,
        onClick: () => setDeleteTarget(item)
      }
    ].filter(Boolean)

    if (viewMode === 'card') {
      return (
        <article key={item.id} className="product-card product-card-grid">
          <div className="product-card-header">
            <div className="product-card-meta-top" title={categoryBadgeText}>{categoryBadgeText}</div>
            <KebabMenu items={actionItems} />
            <details className="product-kebab">
              <summary>...</summary>
              <div className="product-kebab-menu">
                <button type="button" onClick={() => navigate(`/kermes/settings/catalog/items/${item.id}`)}>Ürün Ayarları</button>
                <button type="button" onClick={() => updateItem(item, { isActive: item.isActive === false })}>{item.isActive === false ? 'Aktif Yap' : 'Pasife Al'}</button>
                <button type="button" onClick={() => setDeleteTarget(item)} style={{ color: '#b42318' }}>Sil</button>
              </div>
            </details>
          </div>
          <div className="product-thumb product-thumb--card">
            {item.imageUrl ? <ProductImage product={item} alt={item.name} fallbackText={thumbText} fallbackClassName="product-thumb-fallback" /> : thumbText}
          </div>
          <div className="product-card-copy">
            <div className="product-card-title" title={item.name}>{item.name}</div>
            <div className="product-card-meta" title={categoryMetaText}>{categoryMetaText}</div>
          </div>
          <div className="product-card-stats">
            <div className="product-chip product-money-chip" style={{ width: '100%' }}>{Number(item.price || 0).toFixed(2)} TL</div>
            <div className="product-chip product-stock-chip" style={{ width: '100%' }}>Stok: {Number(settings.stockQty || 0)}</div>
          </div>
          <button className="product-dark-btn product-card-settings-btn" type="button" disabled={isSaving} onClick={() => navigate(`/kermes/settings/catalog/items/${item.id}`)}>Ürün Ayarları</button>
        </article>
      )
    }

    return (
      <article key={item.id} className="product-card">
        <div className="product-list-row-wrap scrollbar-hidden">
          <div className="product-card-list">
            <input className="product-list-check" type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} />
            <div className="product-thumb product-list-thumb">{item.imageUrl ? <ProductImage product={item} alt={item.name} fallbackText={thumbText} fallbackClassName="product-thumb-fallback" /> : thumbText}</div>
            <div className="product-name-cell product-list-name">
              <div className="product-name-text">{item.name}</div>
              <div className="product-name-subtext">{categoryMetaText}</div>
            </div>
            <div className="product-chip product-list-category-chip" title={categoryBadgeText}>{categoryBadgeText}</div>
            <div className="product-list-price-chip-wrap">
              {priceEditorItemId === String(item.id) ? (
                <input
                  className="product-input product-list-price-input"
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  value={priceDraft}
                  onChange={(event) => setPriceDraft(event.target.value)}
                  onBlur={() => saveInlinePrice(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      saveInlinePrice(item)
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      closePriceEditor()
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="product-chip product-money-chip product-list-price-chip product-list-price-edit-btn"
                  onClick={() => openPriceEditor(item)}
                  title="Fiyati duzenle"
                >
                  {Number(item.price || 0).toFixed(2)} TL
                </button>
              )}
            </div>
            <div className="product-chip product-stock-chip product-list-stock-chip">{Number(settings.stockQty || 0)}</div>
            <div className="product-toggle-cell product-toggle-cell--active">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Toggle checked={item.isActive !== false} disabled={isExpired || isSaving} onChange={(checked) => updateItem(item, { isActive: checked })} />
                <span className="product-toggle-label">Aktif</span>
              </div>
            </div>
            <div className="product-toggle-cell product-toggle-cell--qr">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Toggle checked={!!settings.qrMenuVisible} disabled={isExpired || isSaving} onChange={(checked) => updateItem(item, {}, { qrMenuVisible: checked })} />
                <span className="product-toggle-label">QR Menü</span>
              </div>
            </div>
            <div className="product-row-actions product-list-actions">
              <button type="button" className="product-dark-btn" onClick={() => navigate(`/kermes/settings/catalog/items/${item.id}`)}>Ürün Ayarları</button>
            </div>
            <KebabMenu className="product-list-kebab" items={actionItems} />
            <details className="product-kebab">
              <summary>...</summary>
              <div className="product-kebab-menu">
                <button type="button" onClick={() => navigate(`/kermes/settings/catalog/items/${item.id}`)}>Ürün Ayarları</button>
                <button type="button" onClick={() => updateItem(item, { isActive: item.isActive === false })}>{item.isActive === false ? 'Aktif Yap' : 'Pasife Al'}</button>
                <button type="button" onClick={() => updateItem(item, {}, { isFavorite: !settings.isFavorite })}>{settings.isFavorite ? 'Favoriden Çıkar' : 'Favori Yap'}</button>
                <button type="button" onClick={() => updateItem(item, {}, { qrMenuVisible: !settings.qrMenuVisible })}>{settings.qrMenuVisible ? 'QR Menüyü Gizle' : 'QR Menüde Göster'}</button>
                <button type="button" onClick={() => setDeleteTarget(item)} style={{ color: '#b42318' }}>Sil</button>
              </div>
            </details>
          </div>
        </div>
      </article>
    )
  }

  return (
    <div className="page-scroll-area scrollbar-hidden">
      <ProductCatalogStyles />
      <SettingsUiStyles />
      <div className="product-catalog-page">
        <div className="product-shell">
          <section className="product-panel">
            <div className="product-header-stack">
              <div className="product-page-heading">
                <h1 className="product-page-title">Ürün & Kategori</h1>
                <div className="product-page-subtitle">Ürün, kategori, görünüm ve sıralama ayarları</div>
              </div>
              <div className="product-header-controls">
                <div className="product-toolbar-field product-toolbar-search">
                  <input
                    className="product-input"
                    placeholder="Ürün veya kategori ara"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                  />
                </div>
                <div className="product-toolbar-field product-toolbar-status">
                  <select className="product-select" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
                    <option value="all">Tümü</option>
                    <option value="true">Aktif</option>
                    <option value="false">Pasif</option>
                  </select>
                </div>
                <div className="product-toolbar-field product-toolbar-branch">
                  <select className="product-select" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
                    <option value="">Tüm Şubeler</option>
                    {branches.map((branch) => <option key={branch._id || branch.id} value={branch._id || branch.id}>{branch.name}</option>)}
                  </select>
                </div>
                <button type="button" className="product-dark-btn product-header-back-btn" onClick={() => navigate('/kermes/settings')}>← Ayarlara Dön</button>
              </div>
              <HorizontalScrollStrip className="product-toolbar product-toolbar-scroll scrollbar-hidden">
                <button type="button" className="product-action-btn" disabled={isExpired} onClick={() => setCreateOpen(true)}>+ Yeni Ürün Ekle</button>
                <button type="button" className="product-secondary-btn" onClick={() => setCategoryOpen(true)}>+ Yeni Kategori Ekle</button>
                <button type="button" className="product-secondary-btn" disabled={bulkBusy} onClick={() => setImportOpen(true)}>Excel ile Ürün Yükle</button>
                <button type="button" className="product-secondary-btn" disabled={bulkBusy} onClick={() => onDownloadExcel('/api/settings/products/template?format=xlsx', 'products_template.xlsx')}>Örnek Excel İndir</button>
                <button type="button" className="product-secondary-btn" disabled={bulkBusy} onClick={() => onDownloadExcel('/api/settings/products/export?format=xlsx', 'products_export.xlsx')}>Mevcut Ürünleri İndir</button>
                <button type="button" className={`product-pill-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>Liste Görünümü</button>
                <button type="button" className={`product-pill-btn ${viewMode === 'card' ? 'active' : ''}`} onClick={() => setViewMode('card')}>Kart Görünümü</button>
                <button type="button" className="product-secondary-btn" onClick={openSortModal}>Sıralamayı Düzenle</button>
                <div className="product-chip product-toolbar-badge">Seçili: {selectedIds.length}</div>
              </HorizontalScrollStrip>
            </div>
          </section>

          <section className="product-panel">
            <HorizontalScrollStrip className="product-category-bar scrollbar-hidden">
              {categoryTabs.map((tab) => (
                <div key={tab.key} className={`product-category-pill ${activeTab === tab.key ? 'active' : ''}`}>
                  <button type="button" className="product-category-pill-trigger" onClick={() => setActiveTab(tab.key)}>
                    <span className="product-category-pill-name">{tab.label}</span>
                  </button>
                  {!tab.special ? (
                    <button
                      type="button"
                      className="product-category-edit-btn"
                      aria-label={`${tab.label} kategorisini düzenle`}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        openCategoryEditor(tab.category)
                      }}
                    >
                      <PencilIcon />
                    </button>
                  ) : null}
                </div>
              ))}
            </HorizontalScrollStrip>
          </section>

          {error ? <div className="product-panel" style={{ color: '#b42318', fontWeight: 900 }}>{error}</div> : null}
          {loading ? <div className="product-panel">Yükleniyor...</div> : null}
          {!loading && visibleItems.length === 0 ? <div className="product-panel">Filtreye uygun ürün bulunamadı.</div> : null}
          {!loading && visibleItems.length > 0 ? (
            <section className={viewMode === 'list' ? 'product-list' : 'product-grid'}>
              {visibleItems.map(renderProductCard)}
            </section>
          ) : null}
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yeni Ürün Ekle" dialogStyle={{ maxWidth: 900 }}>
        <div className="product-form-grid cols-2">
          <Field label="Ürün Adı"><input className="product-input" value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} /></Field>
          <Field label="Kategori">
            <select className="product-select" value={createForm.categoryId} onChange={(event) => setCreateForm({ ...createForm, categoryId: event.target.value })}>
              <option value="">Kategori seçin</option>
              {sortedCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </Field>
          <Field label="Ürün Fiyatı"><input className="product-input" type="number" min="0" step="0.01" value={createForm.price} onChange={(event) => setCreateForm({ ...createForm, price: event.target.value })} /></Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <ProductImageUploadField
              currentImageUrl=""
              file={createImageFile}
              error={createImageError}
              disabled={submitting}
              onFileChange={(nextFile, validationMessage) => {
                setCreateImageError(validationMessage || '')
                setCreateImageFile(validationMessage ? null : nextFile)
              }}
              onClearFile={() => {
                setCreateImageFile(null)
                setCreateImageError('')
              }}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Açıklama"><textarea className="product-textarea" value={createForm.description} onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })} /></Field>
          </div>
          <ToggleCard title="Aktif" description="Satış ekranlarında görünsün." checked={!!createForm.isActive} onChange={(checked) => setCreateForm({ ...createForm, isActive: checked })} />
          <ToggleCard title="Favori" description="Hızlı erişimde görünsün." checked={!!createForm.isFavorite} onChange={(checked) => setCreateForm({ ...createForm, isFavorite: checked })} />
          <ToggleCard title="QR Menü" description="Dijital menüde görünsün." checked={!!createForm.qrMenuVisible} onChange={(checked) => setCreateForm({ ...createForm, qrMenuVisible: checked })} />
          <div style={{ gridColumn: '1 / -1' }}>
            <BranchAccessField
              label="Şube Görünürlüğü"
              hint="Şube seçmezseniz ürün tüm şubelerde kullanılır."
              branches={branches}
              value={createForm.visibility}
              onChange={(visibility) => setCreateForm({ ...createForm, visibility })}
              allLabel="Tüm Şubelerde Geçerli"
            />
          </div>
        </div>
        <div className="product-modal-footer-row">
          <button type="button" className="product-secondary-btn" onClick={() => setCreateOpen(false)}>İptal</button>
          <button type="button" className="product-dark-btn" disabled={submitting} onClick={async () => {
            if (createImageError) {
              setError(createImageError)
              return
            }
            const createdItem = await createProduct(createForm)
            if (!createdItem?.id) return
            setCreateOpen(false)
            setCreateForm(createEmptyProductForm(sortedCategories[0]?.id || ''))
            setCreateImageFile(null)
            setCreateImageError('')
            navigate(`/kermes/settings/catalog/items/${createdItem.id}`)
          }}>{submitting ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </Modal>

      <Modal open={categoryOpen} onClose={() => setCategoryOpen(false)} title="Yeni Kategori Ekle" dialogStyle={{ maxWidth: 520 }}>
        <div className="product-form-grid">
          <Field label="Kategori Adı"><input className="product-input" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /></Field>
        </div>
        <div className="product-modal-footer-row">
          <button type="button" className="product-secondary-btn" onClick={() => setCategoryOpen(false)}>İptal</button>
          <button type="button" className="product-dark-btn" disabled={submitting} onClick={createCategory}>{submitting ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </Modal>

      <Modal open={categoryEditorOpen} onClose={() => setCategoryEditorOpen(false)} title="Kategori Düzenle" dialogStyle={{ maxWidth: 560 }}>
        <div className="product-form-grid cols-2">
          <Field label="Kategori Adı">
            <input
              className="product-input"
              value={categoryForm.name}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </Field>
          <Field label="Sıra Numarası">
            <input
              className="product-input"
              type="number"
              min="0"
              step="1"
              value={categoryForm.sortOrder}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
            />
          </Field>
          <ToggleCard
            title="Aktif"
            description="Kategori satış ekranında filtre olarak görünsün."
            checked={!!categoryForm.isActive}
            onChange={(checked) => setCategoryForm((prev) => ({ ...prev, isActive: checked }))}
          />
          <ToggleCard
            title="QR Menüde Göster"
            description="Kategori dijital menüde yayınlansın veya gizlensin."
            checked={!!categoryForm.qrMenuVisible}
            onChange={(checked) => setCategoryForm((prev) => ({ ...prev, qrMenuVisible: checked }))}
          />
        </div>
        <div className="product-modal-footer-row">
          <button
            type="button"
            className="product-secondary-btn"
            style={{ marginRight: 'auto', color: '#b42318', borderColor: '#fecaca', background: '#fff5f5' }}
            disabled={!categoryForm.id || submitting}
            onClick={() => setCategoryDeleteTarget({
              id: categoryForm.id,
              name: categoryForm.name,
              itemCount: items.filter((item) => String(item.categoryId || '') === String(categoryForm.id)).length
            })}
          >
            Sil
          </button>
          <button type="button" className="product-secondary-btn" onClick={() => setCategoryEditorOpen(false)}>İptal</button>
          <button type="button" className="product-dark-btn" disabled={submitting} onClick={saveCategoryDetail}>{submitting ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Excel ile Ürün Yükle" dialogStyle={{ maxWidth: 620 }}>
        <form onSubmit={onUploadExcel} className="product-form-grid">
          <div style={{ fontSize: 13, color: 'var(--app-text)', fontWeight: 700 }}>
            Desteklenen format: `.xlsx` veya `.csv`. Eski toplu ürün endpointi kullanılır.
          </div>
          <input
            className="product-input"
            type="file"
            accept=".xlsx,.csv"
            onChange={(event) => setBulkFile(event.target.files?.[0] || null)}
          />
          <div className="product-modal-footer-row">
            <button type="button" className="product-secondary-btn" onClick={() => setImportOpen(false)}>İptal</button>
            <button type="submit" className="product-dark-btn" disabled={bulkBusy}>{bulkBusy ? 'Yükleniyor...' : 'Yükle'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={resultOpen} onClose={() => setResultOpen(false)} title="Excel İşlem Sonucu" dialogStyle={{ maxWidth: 880 }}>
        <div className="product-form-grid">
          <div className="product-inline-table-row" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            <div><div style={{ fontSize: 12, color: 'var(--app-text)', fontWeight: 900 }}>Toplam Satır</div><div style={{ marginTop: 6, fontWeight: 900 }}>{bulkResult?.totalRows ?? 0}</div></div>
            <div><div style={{ fontSize: 12, color: 'var(--app-text)', fontWeight: 900 }}>Eklenen</div><div style={{ marginTop: 6, fontWeight: 900, color: '#16a34a' }}>{bulkResult?.created ?? 0}</div></div>
            <div><div style={{ fontSize: 12, color: 'var(--app-text)', fontWeight: 900 }}>Güncellenen</div><div style={{ marginTop: 6, fontWeight: 900 }}>{bulkResult?.updated ?? 0}</div></div>
            <div><div style={{ fontSize: 12, color: 'var(--app-text-muted)', fontWeight: 900 }}>Hatalı</div><div style={{ marginTop: 6, fontWeight: 900, color: importErrors.length ? '#dc2626' : 'var(--app-text)' }}>{bulkResult?.failed ?? importErrors.length}</div></div>
          </div>
          {importErrors.length > 0 ? (
            <div className="product-inline-table">
              {importErrors.slice(0, 100).map((entry, index) => (
                <div key={`${entry.row}-${index}`} className="product-inline-table-row" style={{ gridTemplateColumns: '90px 140px 1fr' }}>
                  <div><strong>Satır</strong><div>{entry.row}</div></div>
                  <div><strong>Alan</strong><div>{entry.field}</div></div>
                  <div><strong>Mesaj</strong><div>{entry.message}</div></div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Modal>

      <CategorySortModal
        open={sortOpen}
        categories={sortedCategories}
        draftCategories={draftCategories}
        setDraftCategories={setDraftCategories}
        saving={sortSaving}
        onClose={() => setSortOpen(false)}
        onSave={saveCategoryOrder}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        loading={deleteLoading}
        title={deleteItemConfirmTitle}
        message={deleteItemConfirmMessage}
        confirmText={deleteItemConfirmText}
        onConfirm={deleteItem}
        onClose={() => {
          if (deleteLoading) return
          setDeleteTarget(null)
        }}
      />

      <ConfirmDialog
        open={!!categoryDeleteTarget}
        loading={categoryDeleteLoading}
        title={deleteCategoryConfirmTitle}
        message={deleteCategoryConfirmMessage}
        onConfirm={deleteCategory}
        onClose={() => {
          if (categoryDeleteLoading) return
          setCategoryDeleteTarget(null)
        }}
      />
    </div>
  )
}
