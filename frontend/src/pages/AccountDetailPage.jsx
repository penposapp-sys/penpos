import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import { useAuth } from '../context/AuthContext.jsx'
import { trStatusLabel } from '../i18n/tr.js'
import Modal from '../components/Modal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { pickInitialPaymentMethod } from '../lib/paymentMethods.js'
import SaleCategorySidebar from '../components/SaleCategorySidebar.jsx'
import SaleCartLine from '../components/SaleCartLine.jsx'
import ProductCard from '../components/ProductCard.jsx'
import ProductConfigModal from '../components/ProductConfigModal.jsx'

const money = (value) => `${Number(value || 0).toFixed(2)} TL`
const toNumberInput = (value) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function AccountDetailPage() {
  const nav = useNavigate()
  const { id } = useParams()
  const loc = useLocation()
  const { isMobilePortrait } = useResponsiveFlags()
  const { user, allowedBranchIds } = useAuth()

  const orderIdFromUrl = useMemo(() => {
    try {
      const qs = new URLSearchParams(String(loc?.search || ''))
      return String(qs.get('orderId') || '').trim()
    } catch {
      return ''
    }
  }, [loc?.search])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [account, setAccount] = useState(null)
  const [tx, setTx] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [orderLoading, setOrderLoading] = useState(false)
  const [order, setOrder] = useState(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [collectOpen, setCollectOpen] = useState(false)
  const [collectForm, setCollectForm] = useState({ amount: '', method: '', note: '' })
  const [collectMethods, setCollectMethods] = useState([])
  const [collectDiscountDraft, setCollectDiscountDraft] = useState('0')
  const [collectAppliedDiscountPercent, setCollectAppliedDiscountPercent] = useState(0)
  const [collectNoteOpen, setCollectNoteOpen] = useState(false)
  const collectAmountKeypadEditedRef = useRef(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualForm, setManualForm] = useState({ amount: '', type: 'debit', note: '' })

  const [catalogLoading, setCatalogLoading] = useState(false)
  const [categories, setCategories] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [activeCategoryId, setActiveCategoryId] = useState('')
  const [cartItems, setCartItems] = useState([])
  const [cartSubmitting, setCartSubmitting] = useState(false)
  const [cartWeightItem, setCartWeightItem] = useState(null)
  const [cartWeightModalOpen, setCartWeightModalOpen] = useState(false)

  const hasPerm = (p) => user?.role === 'tenant_admin' || user?.role === 'superadmin' || (user?.permissions || []).includes(p)
  const canCollect = hasPerm('collect_debt')
  const canDeleteCollection = hasPerm('cari_tahsilat_sil')
  const canManageAccount = hasPerm('manage_accounts') || hasPerm('accounts_manage')

  useEffect(() => {
    const run = async () => {
      const accountId = String(id || '').trim()
      setError('')
      if (!accountId) {
        setAccount(null)
        setTx([])
        setLoading(false)
        setError('Geçersiz cari id')
        return
      }
      setLoading(true)
      try {
        const res = await api(`/api/accounts/${accountId}`)
        if (res?.success === false) {
          const msg = res?.message || 'Cari bulunamadı'
          toast.error(msg)
          setError(msg)
          setAccount(null)
          setTx([])
          return
        }
        setAccount(res?.account || null)
        setTx(Array.isArray(res?.recentTransactions) ? res.recentTransactions : [])
      } catch (err) {
        const msg = err?.message || 'Cari yüklenemedi'
        toast.error(msg)
        setError(msg)
        setAccount(null)
        setTx([])
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [id])

  useEffect(() => {
    if (!canManageAccount) return
    let cancelled = false
    const run = async () => {
      setCatalogLoading(true)
      try {
        const res = await api('/api/accounts/catalog', { silent: true })
        if (cancelled) return
        const nextCategories = Array.isArray(res?.categories) ? res.categories : []
        const nextItems = Array.isArray(res?.items) ? res.items : []
        setCategories(nextCategories)
        setMenuItems(nextItems)
        setActiveCategoryId((prev) => {
          if (prev && nextCategories.some((c) => String(c.id) === String(prev))) return prev
          return nextCategories[0]?.id || ''
        })
      } catch (err) {
        if (!cancelled) toast.error(err?.message || 'Ürün kataloğu yüklenemedi')
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [canManageAccount])

  useEffect(() => {
    if (!canCollect) return
    let cancelled = false
    const run = async () => {
      const selectedBranchId = (() => {
        try { return String(localStorage.getItem('selectedBranchId') || '').trim() } catch { return '' }
      })()
      if (!selectedBranchId) {
        setCollectMethods([])
        return
      }
      try {
        const res = await api('/api/tenant/payment-settings', { silent: true, suppressBranchModal: true })
        if (cancelled) return
        if (res?.success === false) {
          setCollectMethods([])
          return
        }
        const methods = Array.isArray(res?.methods) ? res.methods.filter((m) => m.isEnabled) : []
        setCollectMethods(methods)
        setCollectForm((prev) => ({ ...prev, method: pickInitialPaymentMethod(methods, prev.method) }))
      } catch {}
    }
    run()
    return () => { cancelled = true }
  }, [canCollect, Array.isArray(allowedBranchIds) ? allowedBranchIds.join(',') : ''])

  useEffect(() => {
    const run = async () => {
      const txId = String(expandedId || '').trim()
      if (!txId) {
        setOrder(null)
        return
      }
      const currentTx = (Array.isArray(tx) ? tx : []).find((entry) => String(entry?.id) === txId)
      const embeddedSummary = currentTx?.orderSummary || null
      setOrder(embeddedSummary)
      if (!currentTx?.orderId) return
      setOrderLoading(true)
      try {
        const res = await api(`/api/accounts/transactions/${txId}/order`, { silent: true })
        const freshOrder = res?.order || null
        setOrder(freshOrder ? { ...(embeddedSummary || {}), ...freshOrder } : embeddedSummary)
      } catch {
        setOrder(embeddedSummary)
      } finally {
        setOrderLoading(false)
      }
    }
    run()
  }, [expandedId, tx])

  const orderItems = useMemo(() => {
    const raw = Array.isArray(order?.items) ? order.items : []
    return raw
      .map((it) => {
        const name = String(it?.name ?? it?.nameSnapshot ?? '').trim()
        const qty = Number(it?.qty ?? it?.quantity ?? 0) || 0
        const unit = Number(it?.price ?? it?.priceSnapshot ?? it?.unitPrice ?? 0) || 0
        const line = Number(it?.lineTotal ?? it?.total ?? it?.subtotal ?? (qty * unit)) || 0
        const weightGrams = Number(it?.weightGrams || 0) || null
        return { name, qty, unit, line, weightGrams }
      })
      .filter((entry) => entry.name || entry.qty > 0 || entry.line > 0)
  }, [order])

  const filteredItems = useMemo(() => {
    const currentCategoryId = String(activeCategoryId || '')
    return (menuItems || []).filter((item) => {
      if (!currentCategoryId) return true
      return String(item?.categoryId || '') === currentCategoryId
    })
  }, [menuItems, activeCategoryId])
  const saleCategories = useMemo(
    () => (categories || []).map((category) => ({
      ...category,
      name: `${category.name}${category.isActive === false ? ' (Pasif)' : ''}`
    })),
    [categories]
  )

  const cartTotal = useMemo(
    () => (cartItems || []).reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0),
    [cartItems]
  )
  const collectGross = Math.max(0, Number(account?.balance || 0))
  const collectDiscountPercent = collectAppliedDiscountPercent
  const collectDiscountAmount = Number(((collectGross * collectDiscountPercent) / 100).toFixed(2))
  const collectNet = Math.max(0, Number((collectGross - collectDiscountAmount).toFixed(2)))
  const collectAmountValue = Math.max(0, toNumberInput(collectForm.amount || 0))
  const collectRemaining = Math.max(0, Number((collectGross - collectDiscountAmount - collectAmountValue).toFixed(2)))

  const txRows = useMemo(() => (Array.isArray(tx) ? tx : []), [tx])

  const updateCollectAmount = (amount) => {
    collectAmountKeypadEditedRef.current = true
    setCollectForm((previous) => ({ ...previous, amount }))
  }

  const applyCollectKey = (key) => {
    const currentAmount = collectAmountKeypadEditedRef.current ? String(collectForm.amount || '') : ''
    collectAmountKeypadEditedRef.current = true
    if (key === 'back') {
      setCollectForm((previous) => ({ ...previous, amount: currentAmount.slice(0, -1) }))
      return
    }
    if (key === '.') {
      if (currentAmount.includes('.')) return
      setCollectForm((previous) => ({ ...previous, amount: currentAmount ? `${currentAmount}.` : '0.' }))
      return
    }
    const amount = currentAmount === '0' ? key : `${currentAmount}${key}`
    setCollectForm((previous) => ({ ...previous, amount }))
  }

  const reloadAccount = async (accountId) => {
    const cleanId = String(accountId || '').trim()
    if (!cleanId) return
    try {
      const res = await api(`/api/accounts/${cleanId}`)
      if (res?.success === false) return
      setAccount(res?.account || null)
      setTx(Array.isArray(res?.recentTransactions) ? res.recentTransactions : [])
    } catch {}
  }

  const collect = async () => {
    const accountId = String(account?.id || '').trim()
    if (!accountId) return
    if (!String(collectForm.method || '').trim()) {
      toast.error('Odeme yontemi secin')
      return
    }
    const amt = toNumberInput(collectForm.amount)
    if (!Number.isFinite(amt) || amt < 0 || (amt + collectDiscountAmount) <= 0) {
      toast.error('Tutar geçersiz')
      return
    }
    try {
      const res = await api(`/api/accounts/${accountId}/collect`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          discountAmount: collectDiscountAmount,
          method: collectForm.method,
          note: collectForm.note,
          orderId: orderIdFromUrl || undefined
        }),
        silent: true
      })
      if (res?.success === false) throw new Error(res?.message || 'Tahsilat alınamadı')
      toast.success('Tahsilat kaydedildi')
      setCollectOpen(false)
      setCollectForm({ amount: '', method: 'cash', note: '' })
      setCollectDiscountDraft('0')
      setCollectAppliedDiscountPercent(0)
      await reloadAccount(accountId)
    } catch (err) {
      toast.error(err?.message || 'Tahsilat alınamadı')
    }
  }

  const applyCollectDiscount = async (percent = toNumberInput(collectDiscountDraft)) => {
    const accountId = String(account?.id || '').trim()
    if (!accountId) return
    const discountPercent = Math.max(0, Math.min(100, toNumberInput(percent)))
    const discountAmount = Number(((collectGross * discountPercent) / 100).toFixed(2))
    if (discountAmount <= 0) {
      toast.error('İndirim tutarı geçersiz')
      return
    }
    try {
      const res = await api(`/api/accounts/${accountId}/collect`, {
        method: 'POST',
        body: JSON.stringify({
          amount: 0,
          discountAmount,
          method: collectForm.method || 'cash',
          note: collectForm.note || 'Cari indirimi',
          orderId: orderIdFromUrl || undefined
        }),
        silent: true
      })
      if (res?.success === false) throw new Error(res?.message || 'İndirim uygulanamadı')
      const remainingBalance = Math.max(0, Number(res?.account?.balance ?? collectGross - discountAmount))
      setCollectDiscountDraft('0')
      setCollectAppliedDiscountPercent(0)
      setCollectForm((prev) => ({ ...prev, amount: remainingBalance.toFixed(2), note: '' }))
      collectAmountKeypadEditedRef.current = false
      toast.success('İndirim uygulandı')
      await reloadAccount(accountId)
    } catch (err) {
      toast.error(err?.message || 'İndirim uygulanamadı')
    }
  }

  const openManualModal = (type) => {
    setManualForm({ amount: '', type: type === 'credit' ? 'credit' : 'debit', note: '' })
    setManualOpen(true)
  }

  const submitManualBalance = async () => {
    const accountId = String(account?.id || '').trim()
    if (!accountId) return
    const amt = toNumberInput(manualForm.amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Tutar geçersiz')
      return
    }
    try {
      await api(`/api/accounts/${accountId}/manual-adjust`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          type: manualForm.type,
          note: manualForm.note
        })
      })
      toast.success(manualForm.type === 'debit' ? 'Manuel borç eklendi' : 'Bakiyeden düşüldü')
      setManualOpen(false)
      setManualForm({ amount: '', type: 'debit', note: '' })
      await reloadAccount(accountId)
    } catch (err) {
      toast.error(err?.message || 'Cari hareket kaydedilemedi')
    }
  }

  const addToCart = (item) => {
    const itemId = String(item?.id || '')
    if (!itemId) return
    if (item.isWeightBased) {
      setCartWeightItem(item)
      setCartWeightModalOpen(true)
      return
    }
    setCartItems((prev) => {
      const existing = prev.find((entry) => String(entry.menuItemId) === itemId)
      if (existing) {
        return prev.map((entry) => String(entry.menuItemId) === itemId ? { ...entry, qty: Number(entry.qty || 0) + 1 } : entry)
      }
      return [
        ...prev,
        {
          menuItemId: itemId,
          name: item.name,
          price: Number(item.price || 0),
          qty: 1,
          weightGrams: null,
          note: '',
          isActive: item.isActive !== false
        }
      ]
    })
  }

  const addWeightItemToCart = (payload) => {
    const item = cartWeightItem
    const menuItemId = String(payload?.menuItemId || item?.id || '').trim()
    const weightGrams = Math.round(Number(payload?.weightGrams))
    if (!item || !menuItemId || !Number.isFinite(weightGrams) || weightGrams <= 0) return false
    const qty = weightGrams / 1000
    setCartItems((prev) => {
      const existing = prev.find((entry) => String(entry.menuItemId) === menuItemId)
      if (existing) {
        return prev.map((entry) => String(entry.menuItemId) === menuItemId
          ? {
              ...entry,
              qty: Number(entry.qty || 0) + qty,
              weightGrams: Number(entry.weightGrams || 0) + weightGrams
            }
          : entry)
      }
      return [
        ...prev,
        {
          menuItemId,
          name: item.name,
          price: Number(item.price || 0),
          qty,
          weightGrams,
          isWeightBased: true,
          note: '',
          isActive: item.isActive !== false
        }
      ]
    })
    return true
  }

  const updateCartQty = (menuItemId, nextQty) => {
    const enteredValue = Number(nextQty)
    if (!Number.isFinite(enteredValue) || enteredValue <= 0) {
      setCartItems((prev) => prev.filter((entry) => String(entry.menuItemId) !== String(menuItemId)))
      return
    }
    setCartItems((prev) => prev.map((entry) => {
      if (String(entry.menuItemId) !== String(menuItemId)) return entry
      if (entry.isWeightBased) {
        const weightGrams = Math.round(enteredValue)
        return { ...entry, weightGrams, qty: weightGrams / 1000 }
      }
      return { ...entry, qty: enteredValue }
    }))
  }

  const updateCartNote = (menuItemId, note) => {
    setCartItems((prev) => prev.map((entry) => String(entry.menuItemId) === String(menuItemId) ? { ...entry, note } : entry))
  }

  const removeCartItem = (menuItemId) => {
    setCartItems((prev) => prev.filter((entry) => String(entry.menuItemId) !== String(menuItemId)))
  }

  const submitCart = async () => {
    const accountId = String(account?.id || '').trim()
    if (!accountId) return
    if (cartItems.length === 0) {
      toast.error('Sepette ürün yok')
      return
    }
    setCartSubmitting(true)
    try {
      await api(`/api/accounts/${accountId}/manual-cart`, {
        method: 'POST',
        body: JSON.stringify({
          items: cartItems.map((entry) => ({
            menuItemId: entry.menuItemId,
            qty: Number(entry.qty || 0),
            weightGrams: entry.isWeightBased ? Number(entry.weightGrams || 0) : undefined,
            note: entry.note || ''
          }))
        })
      })
      toast.success('Sepet cariye eklendi')
      setCartItems([])
      await reloadAccount(accountId)
    } catch (err) {
      toast.error(err?.message || 'Sepet cariye eklenemedi')
    } finally {
      setCartSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    const txId = String(deleteTarget?.id || '').trim()
    const accountId = String(account?.id || '').trim()
    if (!txId || !accountId) return
    setDeleteLoading(true)
    try {
      const res = await api(`/api/accounts/transactions/${txId}`, { method: 'DELETE', silent: true })
      if (!res?.ok) {
        const code = res?.code
        if (code === 'payment_locked') toast.error('Bu hareket silinemez')
        else if (code === 'forbidden') toast.error('Bu işlem için yetkiniz yok')
        else toast.error(res?.message || 'Tahsilat silinemedi')
        return
      }
      toast.success('Tahsilat silindi')
      setDeleteOpen(false)
      setDeleteTarget(null)
      await reloadAccount(accountId)
    } catch (err) {
      const code = err?.code || err?.data?.code
      if (code === 'payment_locked') toast.error('Bu hareket sipariş ödemesine bağlı olduğu için silinemez.')
      else if (code === 'forbidden') toast.error('Tahsilat silme yetkiniz bulunmuyor.')
      else toast.error(err?.data?.message || err?.message || 'Tahsilat silinemedi.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const header = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <button className="btn" type="button" onClick={() => nav('/restoran/app/accounts')}>← Cari Listesi</button>
      <div className="account-header-right">
        <div className="breakAny account-header-name">{account?.name || 'Cari'}</div>
        {((account?.phone && String(account.phone).trim()) || (account?.note && String(account.note).trim())) && (
          <div className="account-header-meta">
            {!!(account?.phone && String(account.phone).trim()) && <div className="breakAny">{account.phone}</div>}
            {!!(account?.note && String(account.note).trim()) && <div className="breakAny">{account.note}</div>}
          </div>
        )}
      </div>
    </div>
  )

  const balanceCard = (
    <div className="card account-balance-card" style={{ boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)' }}>
      <div className="account-balance-toprow">
        <div className="account-balance-left">
          <div className="account-balance-label">Bakiye</div>
          <div className="account-balance-value">{money(account?.balance || 0)}</div>
        </div>
        <div className="account-balance-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {canManageAccount && (
            <>
              <button className="btn" onClick={() => openManualModal('debit')}>+ Bakiye</button>
              <button className="btn" onClick={() => openManualModal('credit')}>- Bakiye</button>
            </>
          )}
          {canCollect && (
            <button
              className="btn account-collect-btn"
              onClick={() => {
                setCollectDiscountDraft('0')
                setCollectAppliedDiscountPercent(0)
                collectAmountKeypadEditedRef.current = false
                setCollectNoteOpen(false)
                setCollectForm((prev) => ({
                  ...prev,
                  amount: String(Math.max(0, Number(account?.balance || 0)).toFixed(2)),
                  note: ''
                }))
                setCollectOpen(true)
              }}
            >
              Tahsilat Al
            </button>
          )}
        </div>
      </div>
    </div>
  )

  const categoriesPanel = canManageAccount ? (
    <SaleCategorySidebar
      title="Kategoriler"
      categories={saleCategories}
      activeCategoryId={activeCategoryId}
      onSelect={setActiveCategoryId}
    />
  ) : null

  const debtPanel = (
    <div className="card account-tx-card">
      <div style={{ fontWeight: 800 }}>Borç Detayları</div>
      {txRows.length === 0 ? (
        <div className="account-tx-empty">Hareket yok</div>
      ) : (
        <div className="account-tx-list account-tx-list-scroll">
          {txRows.map((t) => {
            const tid = String(t?.id || '')
            const expanded = tid && expandedId === tid
            const amount = Number(t?.amount || 0)
            const debit = String(t?.type) === 'debit'
            const canDeleteThis = canDeleteCollection && (
              (!debit && t?.source === 'collection') ||
              (t?.source === 'manual' && !t?.orderId)
            )
            const txTitle = debit
              ? (t?.source === 'manual' ? 'Manuel Borç' : 'Borç')
              : (t?.source === 'manual' ? 'Manuel Düşüm' : 'Tahsilat')

            return (
              <div
                key={tid}
                className="txCard clickable"
                role="button"
                tabIndex={0}
                onClick={() => setExpandedId(expanded ? null : tid)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return
                  e.preventDefault()
                  setExpandedId(expanded ? null : tid)
                }}
              >
                <div className="txRow">
                  <div className="txLeft">{txTitle} • {money(amount)}</div>
                  <div className="txRight">
                    <div className="txDate">{new Date(t?.createdAt || Date.now()).toLocaleString()}</div>
                    {canDeleteThis && (
                      <button
                        className="btn btn--danger"
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setDeleteTarget({ id: tid, amount })
                          setDeleteOpen(true)
                        }}
                      >
                        Sil
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="account-tx-expanded" onClick={(e) => e.stopPropagation()}>
                    <div className="account-subcard">
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>İşlem Detayı</div>
                      <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ color: 'var(--muted)' }}>Tür</div>
                          <div style={{ fontWeight: 700 }}>{txTitle}</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ color: 'var(--muted)' }}>Tutar</div>
                          <div style={{ fontWeight: 700 }}>{money(amount)}</div>
                        </div>
                        {!!String(t?.note || '').trim() && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ color: 'var(--muted)' }}>Not</div>
                            <div className="breakAny" style={{ fontWeight: 700, textAlign: 'right' }}>{String(t.note).trim()}</div>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ color: 'var(--muted)' }}>Tarih</div>
                          <div style={{ fontWeight: 700 }}>{new Date(t?.createdAt || Date.now()).toLocaleString()}</div>
                        </div>
                        {!!t?.orderId && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ color: 'var(--muted)' }}>Sipariş</div>
                            <div className="breakAny" style={{ fontWeight: 700 }}>{String(t.orderId)}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {Array.isArray(t?.lines) && t.lines.length > 0 && (
                      <div className="account-subcard">
                        <div style={{ fontWeight: 800, marginBottom: 6 }}>Ürün Detayları</div>
                        <div className="account-order-items">
                          {t.lines.map((line, idx) => (
                            <div key={`${line?.menuItemId || line?.name || 'line'}-${idx}`} className="account-order-item">
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                                <div className="breakAny" style={{ fontWeight: 700 }}>{line?.name || '-'}</div>
                                <div style={{ fontWeight: 800 }}>{money(line?.lineTotal || 0)}</div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
                                <div>
                                  {line?.weightGrams
                                    ? `${line.weightGrams} gr × ${money(line?.price || 0)}/KG`
                                    : `${Number(line?.qty || 0)} × ${money(line?.price || 0)}`}
                                </div>
                                {!!String(line?.note || '').trim() && <div className="breakAny">{String(line.note).trim()}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!!t?.orderId && (
                      <div className="account-subcard">
                        <div style={{ fontWeight: 800, marginBottom: 6 }}>Sipariş Özeti</div>
                        {orderLoading ? (
                          <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>
                        ) : !order ? (
                          <div style={{ color: 'var(--muted)' }}>Sipariş bilgisi yok</div>
                        ) : (
                          <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                            <div className="breakAny" style={{ fontWeight: 800 }}>{order?.orderNo ? `Sipariş ${order.orderNo}` : 'Sipariş'}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                              <div style={{ color: 'var(--muted)' }}>Toplam</div>
                              <div style={{ fontWeight: 800 }}>{money(order?.totals?.total ?? order?.total ?? 0)}</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                              <div style={{ color: 'var(--muted)' }}>Durum</div>
                              <div style={{ fontWeight: 700 }}>{trStatusLabel(order?.status) || '-'}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!!t?.orderId && (
                      <div className="account-subcard">
                        <div style={{ fontWeight: 800, marginBottom: 6 }}>Sipariş Kalemleri</div>
                        {orderLoading ? (
                          <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>
                        ) : !order || orderItems.length === 0 ? (
                          <div style={{ color: 'var(--muted)' }}>Sipariş detayları bulunamadı</div>
                        ) : (
                          <div className="account-order-items">
                            {orderItems.map((it, idx) => (
                              <div key={`${it.name}-${idx}`} className="account-order-item">
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                                  <div className="breakAny" style={{ fontWeight: 700 }}>{it.name || '-'}</div>
                                  <div style={{ fontWeight: 800 }}>{money(it.line)}</div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
                                  <div>
                                    {it.weightGrams
                                      ? `${it.weightGrams} gr × ${money(it.unit)}/KG`
                                      : `${it.qty} × ${money(it.unit)}`}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const productsPanel = canManageAccount ? (
    <div className="card salePanel saleProductsPanel account-products-panel">
      <div className="saleProductsPanelHeader">
        <div style={{ fontWeight: 800 }}>Ürünler</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{filteredItems.length} ürün · Mutfağa gönderilmez</div>
      </div>
      {catalogLoading ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Ürünler yükleniyor...</div>
      ) : filteredItems.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Bu kategoride ürün yok</div>
      ) : (
        <div className="salePanelScroll account-products-scroll">
          <div className="posItemsGrid account-products-grid">
          {filteredItems.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              onClick={addToCart}
              showImage={!!item.imageUrl}
              statusLabel={item.isActive === false ? 'Pasif ürün' : ''}
            />
          ))}
          </div>
        </div>
      )}
    </div>
  ) : null

  const cartPanel = canManageAccount ? (
    <div className="card salePanel saleCartPanelShell account-cart-panel">
      <div className="saleCartPanelContent">
        <div className="saleCartHeader">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <h3 style={{ margin: 0 }}>Sepet</h3>
            <span className="saleCartCountLabel">{cartItems.length} ürün</span>
          </div>
        </div>
        {cartItems.length === 0 ? (
          <div className="saleCartList account-cart-list" style={{ color: 'var(--muted)' }}>Henüz ürün eklenmedi</div>
        ) : (
          <>
            <div className="saleCartList account-cart-list">
          {cartItems.map((entry) => (
            <SaleCartLine
              key={entry.menuItemId}
              className="account-cart-line"
              title={entry.name}
              detail={(
                <div className="account-cart-detail">
                  <div>
                    {money(entry.price)}{entry.isWeightBased ? '/KG' : ''}
                    {entry.isActive === false ? ' · Pasif ürün' : ''}
                  </div>
                  <div className="account-cart-item-fields">
                    <input
                      type="number"
                      min={entry.isWeightBased ? 1 : 0.001}
                      step={entry.isWeightBased ? 1 : 0.001}
                      className="input"
                      aria-label={`${entry.name} gramajı`}
                      value={entry.isWeightBased ? Number(entry.weightGrams ?? Number(entry.qty || 0) * 1000) : entry.qty}
                      onChange={(e) => updateCartQty(entry.menuItemId, e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="Not"
                      aria-label={`${entry.name} notu`}
                      value={entry.note}
                      onChange={(e) => updateCartNote(entry.menuItemId, e.target.value)}
                    />
                  </div>
                </div>
              )}
              actions={(
                <button
                  className="btn btn--danger sale-cart-line__action-btn"
                  type="button"
                  onClick={() => removeCartItem(entry.menuItemId)}
                >
                  Sil
                </button>
              )}
              price={money(Number(entry.qty || 0) * Number(entry.price || 0))}
            />
          ))}
            </div>
            <div className="saleCartFooter">
              <div className="saleCartFooterInner">
                <div className="saleCartFooterSummaryMain">
                  <span>Toplam</span>
                  <strong>{money(cartTotal)}</strong>
                </div>
                <button className="btn" type="button" disabled={cartSubmitting} onClick={submitCart}>
                  {cartSubmitting ? 'Ekleniyor...' : 'Sepeti Cariye Ekle'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  ) : null

  return (
    <div
      className={isMobilePortrait ? 'main pageMobile account-detail-scope' : 'main account-detail-scope'}
      style={isMobilePortrait ? undefined : { paddingInline: 20, paddingTop: 18 }}
    >
      {header}
      {loading ? (
        <div className="card">Yükleniyor...</div>
      ) : error ? (
        <div className="card" style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 800 }}>Hata</div>
          <div style={{ color: 'var(--muted)' }}>{error}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" type="button" onClick={() => nav('/restoran/app/accounts')}>Cari Listesi</button>
            <button className="btn" type="button" onClick={() => window.location.reload()}>Yenile</button>
          </div>
        </div>
      ) : !account ? (
        <div className="card" style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 800 }}>Cari bulunamadı</div>
          <div style={{ color: 'var(--muted)' }}>Kayıt silinmiş olabilir veya erişiminiz olmayabilir.</div>
          <button className="btn" type="button" onClick={() => nav('/restoran/app/accounts')}>Cari Listesi</button>
        </div>
      ) : (
        <>
          {balanceCard}

          {canManageAccount ? (
            <>
              <div className="account-sales-grid">
                {categoriesPanel}
                {productsPanel}
                {cartPanel}
              </div>
              {debtPanel}
            </>
          ) : debtPanel}
        </>
      )}

      <Modal open={collectOpen} onClose={() => setCollectOpen(false)} title="Tahsilat Al">
        <div className="payment-modal-stack account-collection-modal">
          <div className="payment-amount-banner">
            <span className="payment-amount-icon" aria-hidden="true">▣</span>
            <span className="payment-amount-copy">
              <span>Cari Bakiyesi</span>
              <strong>{money(collectGross)}</strong>
            </span>
          </div>
          <div className="payment-meta-line">Cari: {account?.name || '-'}</div>
          <div className="payment-panel payment-entry-pane">
            <div className="payment-panel-body">
              <div className="payment-split-order-summary">
                <div className="payment-summary-row">
                  <span>Ara Toplam</span><strong>{money(collectGross)}</strong>
                </div>
                <div className="payment-summary-row payment-summary-row--editor">
                  <label className="payment-field-label" htmlFor="collect-discount-percent">İndirim (%)</label>
                  <div className="payment-summary-actions">
                    <input
                      id="collect-discount-percent"
                      type="number"
                      min="0"
                      max="100"
                      className="input"
                      value={collectDiscountDraft}
                      onChange={(e) => setCollectDiscountDraft(e.target.value)}
                    />
                    <button className="btn btn--compact" type="button" onClick={() => applyCollectDiscount()}>Uygula</button>
                  </div>
                </div>
                <div className="payment-discount-presets" aria-label="Hazır indirim oranları">
                  {[1, 5, 10, 15, 20, 25, 30, 100].map((percent) => (
                    <button
                      key={percent}
                      type="button"
                      onClick={() => {
                        setCollectDiscountDraft(String(percent))
                        applyCollectDiscount(percent)
                      }}
                    >
                      %{percent}
                    </button>
                  ))}
                </div>
                <div className="payment-summary-totals">
                  <div className="payment-summary-row">
                    <span>İndirim Tutarı</span><strong>{money(collectDiscountAmount)}</strong>
                  </div>
                  <div className="payment-summary-row payment-summary-row--net">
                    <span>Net</span><strong>{money(collectNet)}</strong>
                  </div>
                </div>
                <div className="payment-summary-row">
                  <span>Tahsilat sonrası kalan</span><strong>{money(collectRemaining)}</strong>
                </div>
              </div>

              <div>
                <div className="payment-field-label">Ödeme Yöntemi</div>
                <div className="payment-method-grid">
                  {collectMethods.map((m) => {
                    const active = collectForm.method === m.key
                    return (
                      <button
                        key={m.key}
                        type="button"
                        className={`btn payment-method-btn ${active ? 'is-active' : ''}`}
                        onClick={() => setCollectForm({ ...collectForm, method: m.key })}
                      >
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <label>
                <div className="payment-field-label">Alınan Tutar</div>
                <input
                  type="number"
                  className="input"
                  value={collectForm.amount}
                  onChange={(e) => updateCollectAmount(e.target.value)}
                  placeholder="Tutar giriniz"
                />
              </label>
              <div className="payment-quick-values" aria-label="Hızlı tutarlar">
                <button type="button" className="payment-quick-all" onClick={() => updateCollectAmount(String(collectNet))}>
                  Tamamını Al<span>{money(collectNet)}</span>
                </button>
                {[1000, 500, 200, 100].map((amount) => (
                  <button key={amount} type="button" onClick={() => updateCollectAmount(String(amount))}>
                    {amount.toLocaleString('tr-TR')} TL
                  </button>
                ))}
              </div>
              <div className="payment-keypad" aria-label="Sayısal tuş takımı">
                {['1', '2', '3', 'back', '4', '5', '6', '7', '8', '9', '0', '.'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`payment-key${key === 'back' ? ' payment-key--back' : ''}${key === '0' ? ' payment-key--zero' : ''}`}
                    data-key={key}
                    aria-label={key === 'back' ? 'Son rakamı sil' : undefined}
                    onClick={() => applyCollectKey(key)}
                  >
                    {key === 'back' ? '⌫' : key === '.' ? ',' : key}
                  </button>
                ))}
                <button className="payment-key payment-key--submit" type="button" onClick={collect}>
                  <span aria-hidden="true">✓</span>Tahsilat Ekle
                </button>
              </div>
              <button
                className="btn payment-note-toggle"
                type="button"
                aria-expanded={collectNoteOpen}
                aria-controls="collect-payment-note-field"
                onClick={() => setCollectNoteOpen((open) => !open)}
              >
                {collectNoteOpen ? 'Notu Kapat' : 'Not Ekle (Opsiyonel)'}
              </button>
              <div id="collect-payment-note-field" hidden={!collectNoteOpen}>
                <label>
                  <div className="payment-field-label">Not (opsiyonel)</div>
                  <input className="input" value={collectForm.note} onChange={(e) => setCollectForm({ ...collectForm, note: e.target.value })} />
                </label>
              </div>
            </div>
          </div>
        </div>
      </Modal>
      <ProductConfigModal
        open={cartWeightModalOpen}
        item={cartWeightItem}
        onClose={() => {
          setCartWeightModalOpen(false)
          setCartWeightItem(null)
        }}
        onSubmit={addWeightItemToCart}
      />

      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title={manualForm.type === 'debit' ? 'Manuel Borç Ekle' : 'Bakiyeden Düş'}>
        <div style={{ display: 'grid', gap: 10 }}>
          <label>Tutar <input type="number" className="input" value={manualForm.amount} onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })} /></label>
          <label>İşlem
            <select className="input" value={manualForm.type} onChange={(e) => setManualForm({ ...manualForm, type: e.target.value })}>
              <option value="debit">+ Bakiye Ekle</option>
              <option value="credit">- Bakiye Düş</option>
            </select>
          </label>
          <label>Not <input className="input" value={manualForm.note} onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })} /></label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Bu işlem sadece cari bakiyeyi etkiler, mutfağa sipariş göndermez.</div>
          <button className="btn" onClick={submitManualBalance}>Onayla</button>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => { if (!deleteLoading) { setDeleteOpen(false); setDeleteTarget(null) } }}
        title="Tahsilatı Sil"
        description="Bu tahsilatı silmek cari bakiyeyi etkileyecektir. Devam etmek istiyor musunuz?"
        cancelText="Vazgeç"
        confirmText="Tahsilatı Sil"
        danger
        onConfirm={confirmDelete}
        confirmDisabled={deleteLoading}
        cancelDisabled={deleteLoading}
      />
    </div>
  )
}
