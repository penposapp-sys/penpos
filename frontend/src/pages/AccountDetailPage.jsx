import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import { useAuth } from '../context/AuthContext.jsx'
import { trStatusLabel } from '../i18n/tr.js'
import Modal from '../components/Modal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'

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
  const [collectForm, setCollectForm] = useState({ amount: '', method: 'cash', note: '' })
  const [collectMethods, setCollectMethods] = useState([])
  const [collectDiscountDraft, setCollectDiscountDraft] = useState('0')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualForm, setManualForm] = useState({ amount: '', type: 'debit', note: '' })

  const [catalogLoading, setCatalogLoading] = useState(false)
  const [categories, setCategories] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [activeCategoryId, setActiveCategoryId] = useState('')
  const [cartItems, setCartItems] = useState([])
  const [cartSubmitting, setCartSubmitting] = useState(false)

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
        const def = methods.find((m) => m.isDefault && m.isEnabled)
        if (def?.key) {
          setCollectForm((prev) => ({ ...prev, method: def.key }))
        }
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
        return { name, qty, unit, line }
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

  const cartTotal = useMemo(
    () => (cartItems || []).reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0),
    [cartItems]
  )
  const collectGross = Math.max(0, Number(account?.balance || 0))
  const collectDiscountPercent = Math.max(0, Math.min(100, toNumberInput(collectDiscountDraft) || 0))
  const collectDiscountAmount = Number(((collectGross * collectDiscountPercent) / 100).toFixed(2))
  const collectNet = Math.max(0, Number((collectGross - collectDiscountAmount).toFixed(2)))
  const collectAmountValue = Math.max(0, toNumberInput(collectForm.amount || 0))
  const collectRemaining = Math.max(0, Number((collectGross - collectDiscountAmount - collectAmountValue).toFixed(2)))

  const txRows = useMemo(() => (Array.isArray(tx) ? tx : []), [tx])

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
    const amt = toNumberInput(collectForm.amount)
    if (!Number.isFinite(amt) || amt < 0 || (amt + collectDiscountAmount) <= 0) {
      toast.error('Tutar geçersiz')
      return
    }
    try {
      await api(`/api/accounts/${accountId}/collect`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          discountAmount: collectDiscountAmount,
          method: collectForm.method,
          note: collectForm.note,
          orderId: orderIdFromUrl || undefined
        })
      })
      toast.success('Tahsilat kaydedildi')
      setCollectOpen(false)
      setCollectForm({ amount: '', method: 'cash', note: '' })
      setCollectDiscountDraft('0')
      await reloadAccount(accountId)
    } catch (err) {
      toast.error(err?.message || 'Tahsilat alınamadı')
    }
  }

  const applyCollectDiscount = async () => {
    const accountId = String(account?.id || '').trim()
    if (!accountId) return
    if (collectDiscountAmount <= 0) {
      toast.error('İndirim tutarı geçersiz')
      return
    }
    try {
      await api(`/api/accounts/${accountId}/collect`, {
        method: 'POST',
        body: JSON.stringify({
          amount: 0,
          discountAmount: collectDiscountAmount,
          method: collectForm.method || 'other',
          note: collectForm.note || 'Cari indirimi',
          orderId: orderIdFromUrl || undefined
        })
      })
      toast.success('İndirim uygulandı')
      setCollectDiscountDraft('0')
      setCollectForm((prev) => ({ ...prev, amount: String(Math.max(0, Number(account?.balance || 0) - collectDiscountAmount).toFixed(2)), note: '' }))
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
          note: '',
          isActive: item.isActive !== false
        }
      ]
    })
  }

  const updateCartQty = (menuItemId, nextQty) => {
    const qty = Number(nextQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      setCartItems((prev) => prev.filter((entry) => String(entry.menuItemId) !== String(menuItemId)))
      return
    }
    setCartItems((prev) => prev.map((entry) => String(entry.menuItemId) === String(menuItemId) ? { ...entry, qty } : entry))
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
      const res = await api(`/api/kermes/cari/transactions/${txId}`, { method: 'DELETE', silent: true })
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
    } finally {
      setDeleteLoading(false)
    }
  }

  const header = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <button className="btn" type="button" onClick={() => nav('/kermes/app/accounts')}>← Cari Listesi</button>
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
    <div className="card" style={{ display: 'grid', gap: 14, alignSelf: 'start', minHeight: isMobilePortrait ? undefined : 520 }}>
      <div>
        <div style={{ fontWeight: 800 }}>Kategoriler</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Aktif ve pasif kategorilerden ürün seçebilirsiniz.</div>
      </div>
      <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
        {categories.map((category) => (
          <button
            key={category.id}
            className="btn"
            type="button"
            style={{
              textAlign: 'left',
              justifyContent: isMobilePortrait ? 'center' : 'flex-start',
              fontWeight: String(activeCategoryId) === String(category.id) ? 800 : 600,
              opacity: category.isActive === false ? 0.75 : 1,
              minHeight: isMobilePortrait ? 64 : undefined,
              whiteSpace: 'normal',
              lineHeight: 1.05,
              padding: isMobilePortrait ? '8px 6px' : undefined,
              fontSize: isMobilePortrait ? 13 : undefined
            }}
            onClick={() => setActiveCategoryId(category.id)}
          >
            {category.name}{category.isActive === false ? ' (Pasif)' : ''}
          </button>
        ))}
      </div>
    </div>
  ) : null

  const debtPanel = (
    <div className="card account-tx-card" style={{ minHeight: isMobilePortrait ? undefined : 520 }}>
      <div style={{ fontWeight: 800 }}>Borç Detayları</div>
      {txRows.length === 0 ? (
        <div className="account-tx-empty">Hareket yok</div>
      ) : (
        <div className="account-tx-list">
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
                  <div className="txLeft breakAny">{txTitle} • {money(amount)}</div>
                  <div className="txRight" style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
                    <div>{new Date(t?.createdAt || Date.now()).toLocaleString()}</div>
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
                                <div>{Number(line?.qty || 0)} × {money(line?.price || 0)}</div>
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
                                  <div>{it.qty} × {money(it.unit)}</div>
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
    <div className="card" style={{ display: 'grid', gap: 14, alignSelf: 'start', alignContent: 'start', justifyContent: 'stretch', width: '100%', minHeight: isMobilePortrait ? undefined : 520 }}>
      <div>
        <div style={{ fontWeight: 800 }}>Ürünler</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Mutfağı etkilemez. Ürüne tıklayınca sepete eklenir.</div>
      </div>
      {catalogLoading ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Ürünler yükleniyor...</div>
      ) : filteredItems.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Bu kategoride ürün yok</div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobilePortrait ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(145px, 165px))',
            gap: 10,
            justifyContent: 'start',
            alignContent: 'start',
            justifyItems: 'stretch',
            maxHeight: isMobilePortrait ? 'none' : 520,
            overflowY: 'auto'
          }}
        >
          {filteredItems.map((item) => (
            <button
              key={item.id}
              className="btn"
              type="button"
              style={{
                textAlign: 'left',
                display: 'grid',
                alignContent: 'end',
                justifyItems: 'start',
                minHeight: isMobilePortrait ? 96 : 98,
                borderRadius: isMobilePortrait ? 16 : 14,
                overflow: 'hidden',
                position: 'relative',
                border: '1px solid rgba(255,255,255,0.12)',
                background: item.imageUrl
                  ? `linear-gradient(180deg, rgba(15,23,42,0.12) 0%, rgba(15,23,42,0.78) 100%), url(${item.imageUrl}) center/cover`
                  : 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
                color: '#fff',
                boxShadow: '0 16px 28px rgba(15, 23, 42, 0.18)',
                padding: isMobilePortrait ? 9 : 10
              }}
              onClick={() => addToCart(item)}
            >
              <span style={{ fontWeight: 900, fontSize: isMobilePortrait ? 11 : 12, lineHeight: 1.05, textShadow: '0 2px 10px rgba(0,0,0,0.45)' }}>{item.name}</span>
              <span style={{ fontSize: isMobilePortrait ? 10 : 11, color: 'rgba(255,255,255,0.92)', fontWeight: 700, textShadow: '0 2px 10px rgba(0,0,0,0.35)' }}>
                {money(item.price)}{item.isActive === false ? ' • Pasif ürün' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  ) : null

  const cartPanel = canManageAccount ? (
    <div className="card" style={{ display: 'grid', gap: 14, alignSelf: 'start', position: isMobilePortrait ? 'static' : 'sticky', top: 16, boxShadow: '0 14px 34px rgba(15, 23, 42, 0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800 }}>Sepet</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Seçtiğiniz ürünler burada birikir.</div>
        </div>
        <div style={{ fontWeight: 900, fontSize: 18 }}>{money(cartTotal)}</div>
      </div>
      {cartItems.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Henüz ürün eklenmedi</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {cartItems.map((entry) => (
            <div key={entry.menuItemId} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 8, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="breakAny" style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.1 }}>{entry.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{money(entry.price)}{entry.isActive === false ? ' • Pasif' : ''}</div>
                </div>
                <button className="btn btn--danger" type="button" style={{ padding: '8px 12px', minHeight: 36 }} onClick={() => removeCartItem(entry.menuItemId)}>Sil</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : '96px 1fr', gap: 8 }}>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  className="input"
                  style={{ minHeight: 38, paddingBlock: 8 }}
                  value={entry.qty}
                  onChange={(e) => updateCartQty(entry.menuItemId, e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Not"
                  style={{ minHeight: 38, paddingBlock: 8 }}
                  value={entry.note}
                  onChange={(e) => updateCartNote(entry.menuItemId, e.target.value)}
                />
              </div>
              <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 13 }}>{money(Number(entry.qty || 0) * Number(entry.price || 0))}</div>
            </div>
          ))}
          <button className="btn" type="button" disabled={cartSubmitting} onClick={submitCart}>
            {cartSubmitting ? 'Ekleniyor...' : 'Sepeti Cariye Ekle'}
          </button>
        </div>
      )}
    </div>
  ) : null

  const catalogGridStyle = isMobilePortrait || !canManageAccount
    ? { display: 'grid', gridTemplateColumns: '1fr', gap: 18, alignItems: 'start', width: '100%' }
    : { display: 'grid', gridTemplateColumns: 'minmax(200px, 0.72fr) minmax(220px, 0.82fr) minmax(0, 1.8fr) minmax(300px, 0.9fr)', gap: 18, alignItems: 'start', width: '100%' }

  const mobileCatalogTopStyle = {
    display: 'grid',
    gridTemplateColumns: '104px minmax(0, 1fr)',
    gap: 12,
    alignItems: 'start',
    width: '100%'
  }

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
            <button className="btn" type="button" onClick={() => nav('/kermes/app/accounts')}>Cari Listesi</button>
            <button className="btn" type="button" onClick={() => window.location.reload()}>Yenile</button>
          </div>
        </div>
      ) : !account ? (
        <div className="card" style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 800 }}>Cari bulunamadı</div>
          <div style={{ color: 'var(--muted)' }}>Kayıt silinmiş olabilir veya erişiminiz olmayabilir.</div>
          <button className="btn" type="button" onClick={() => nav('/kermes/app/accounts')}>Cari Listesi</button>
        </div>
      ) : (
        <>
          {balanceCard}

          {canManageAccount && isMobilePortrait ? (
            <>
              <div style={mobileCatalogTopStyle}>
                {categoriesPanel}
                {productsPanel}
              </div>
              {debtPanel}
              {cartPanel}
            </>
          ) : (
            <div style={catalogGridStyle}>
              {debtPanel}
              {categoriesPanel}
              {canManageAccount ? (
                <>
                  {productsPanel}
                  {cartPanel}
                </>
              ) : null}
            </div>
          )}
        </>
      )}

      <Modal open={collectOpen} onClose={() => setCollectOpen(false)} title="Tahsilat Al">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Cari: {account?.name || '-'} • Güncel Bakiye: {money(account?.balance || 0)}
          </div>

          <div className="card" style={{ borderColor: 'var(--border)' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>Brüt</div>
                <div style={{ fontWeight: 600 }}>{money(collectGross)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ color: 'var(--muted)' }}>İndirim (%)</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input"
                    style={{ width: 120 }}
                    value={collectDiscountDraft}
                    onChange={(e) => setCollectDiscountDraft(e.target.value)}
                  />
                  <button
                    className="btn"
                    type="button"
                    onClick={applyCollectDiscount}
                  >
                    Uygula
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>İndirim Tutarı</div>
                <div style={{ fontWeight: 600 }}>{money(collectDiscountAmount)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>Net</div>
                <div style={{ fontWeight: 700 }}>{money(collectNet)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>Bakiye</div>
                <div style={{ fontWeight: 700 }}>{money(collectGross)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--muted)' }}>Kalan</div>
                <div style={{ fontWeight: 700 }}>{money(collectRemaining)}</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ borderColor: 'var(--border)' }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Yöntem</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(collectMethods.length > 0 ? collectMethods : [
                    { key: 'cash', label: 'Nakit' },
                    { key: 'card', label: 'Kart' },
                    { key: 'transfer', label: 'Havale' },
                    { key: 'other', label: 'Diğer' }
                  ]).map((m) => {
                    const active = collectForm.method === m.key
                    return (
                      <button
                        key={m.key}
                        type="button"
                        className="btn"
                        onClick={() => setCollectForm({ ...collectForm, method: m.key })}
                        style={{
                          minWidth: 96,
                          fontWeight: active ? 800 : 600,
                          background: active ? '#111827' : undefined,
                          color: active ? '#fff' : undefined,
                          borderColor: active ? '#111827' : undefined
                        }}
                      >
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tutar</div>
                <input type="number" className="input" value={collectForm.amount} onChange={(e) => setCollectForm({ ...collectForm, amount: e.target.value })} placeholder="Tutar giriniz" />
              </label>

              <label>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not (opsiyonel)</div>
                <input className="input" value={collectForm.note} onChange={(e) => setCollectForm({ ...collectForm, note: e.target.value })} />
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={collect}>Tahsilat Ekle</button>
                <button className="btn" onClick={() => setCollectOpen(false)}>Kapat</button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

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
