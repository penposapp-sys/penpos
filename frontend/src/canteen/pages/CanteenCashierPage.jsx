import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import Modal from '../../components/Modal.jsx'

const money = (n) => {
  const v = Number(n || 0)
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const normalize = (s) => String(s || '').toLowerCase().trim()

export default function CanteenCashierPage() {
  const { me, session } = useOutletContext()
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [q, setQ] = useState('')
  const [barcode, setBarcode] = useState('')
  const [cart, setCart] = useState([])
  const [payMethod, setPayMethod] = useState('cash')
  const [payNote, setPayNote] = useState('')
  const [saleNote, setSaleNote] = useState('')
  const [payAccordionOpen, setPayAccordionOpen] = useState(false)
  const [customerQuery, setCustomerQuery] = useState('')
  const [debouncedCustomerQuery, setDebouncedCustomerQuery] = useState('')
  const [customers, setCustomers] = useState([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [openNewCustomer, setOpenNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lastSale, setLastSale] = useState(null)

  const customerAbortRef = useRef(null)
  const lastCustomerKeyRef = useRef('')

  const barcodeInputRef = useRef(null)
  const scanInFlightRef = useRef(new Set())
  const scanCountsRef = useRef(new Map())
  const errorTimerRef = useRef(null)
  const scanBufRef = useRef('')
  const scanLastAtRef = useRef(0)
  const scanSessionRef = useRef(false)
  const scanTimerRef = useRef(null)
  const scanConfirmTimerRef = useRef(null)
  const scanRestoreRef = useRef(null)
  const scanBarcodeRef = useRef(null)
  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    try {
      return String(localStorage.getItem('selectedBranchId_canteen') || '')
    } catch {
      return ''
    }
  })

  const [branchModalOpen, setBranchModalOpen] = useState(false)

  const scheduleBarcodeFocus = (delayMs = 250) => {
    setTimeout(() => {
      const el = (() => {
        try { return document.activeElement } catch { return null }
      })()
      const tag = String(el?.tagName || '').toLowerCase()
      const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable
      if (isEditable) return
      if (!String(selectedBranchId || '').trim()) return
      if (branchModalOpen) return
      try { barcodeInputRef.current?.focus() } catch {}
    }, delayMs)
  }

  const allowedBranches = Array.isArray(session?.allowedBranches) ? session.allowedBranches : []
  const allowedIds = Array.isArray(session?.allowedBranchIds) ? session.allowedBranchIds.map(String).filter(Boolean) : []

  const canPos = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && me.permissions.includes('canteen_pos_access'))

  const loadProducts = async () => {
    setLoadingProducts(true)
    setError('')
    const qs = allowedIds.length > 0 ? `?branchIds=${encodeURIComponent(allowedIds.join(','))}` : ''
    const res = await api(`/api/canteen/products${qs}`, { silent: true })
    setProducts(Array.isArray(res?.products) ? res.products : [])
    setLoadingProducts(false)
  }

  useEffect(() => {
    loadProducts()
  }, [session?.allowedBranchIds])

  useEffect(() => {
    const handler = () => {
      try {
        setSelectedBranchId(String(localStorage.getItem('selectedBranchId_canteen') || ''))
      } catch {
        setSelectedBranchId('')
      }
    }
    window.addEventListener('canteen_branch_changed', handler)
    return () => window.removeEventListener('canteen_branch_changed', handler)
  }, [])

  useEffect(() => {
    if (selectedBranchId) return
    if (allowedIds.length !== 1) return
    const v = String(allowedIds[0] || '').trim()
    if (!v) return
    try { localStorage.setItem('selectedBranchId_canteen', v) } catch {}
    setSelectedBranchId(v)
  }, [allowedIds, selectedBranchId])

  useEffect(() => {
    if (selectedBranchId) {
      setBranchModalOpen(false)
      return
    }
    if (allowedIds.length > 1) {
      setBranchModalOpen(true)
    }
  }, [allowedIds.length, selectedBranchId])




  const filteredProducts = useMemo(() => {
    const nq = normalize(q)
    if (!nq) return products
    return products.filter(p => normalize(p.name).includes(nq))
  }, [products, q])

  const total = useMemo(() => {
    return cart.reduce((sum, it) => sum + Number(it.unitPrice || 0) * Number(it.qty || 0), 0)
  }, [cart])

  const cartBranchIds = useMemo(() => {
    const ids = cart.map(it => String(it.productBranchId || '')).filter(Boolean)
    return Array.from(new Set(ids))
  }, [cart])

  const addToCart = (p, qtyAdd = 1) => {
    const id = String(p?.id || p?._id || '')
    if (!id) return
    const addQty = Math.max(1, Number(qtyAdd || 1))
    setCart(prev => {
      const next = prev.map(x => ({ ...x }))
      const idx = next.findIndex(x => x.productId === id)
      if (idx >= 0) {
        next[idx].qty += addQty
        return next
      }
      next.unshift({ productId: id, name: p.name, barcode: String(p.barcode || ''), unitPrice: Number(p.price || 0), qty: addQty, productBranchId: p?.branchId ? String(p.branchId) : null })
      return next
    })
  }

  const scanBarcode = async (raw, opts = {}) => {
    const code = String(raw || '').trim()
    if (!code) return
    if (!String(selectedBranchId || '').trim()) return

    const final = opts?.final === true

    if (cart.some(it => String(it.barcode || '').trim() === code)) {
      setCart(prev => prev.map(it => String(it.barcode || '').trim() === code ? { ...it, qty: Number(it.qty || 0) + 1 } : it))
      return
    }

    const prevCount = scanCountsRef.current.get(code) || 0
    scanCountsRef.current.set(code, prevCount + 1)
    if (scanInFlightRef.current.has(code)) return
    scanInFlightRef.current.add(code)

    try {
      const res = await api(`/api/canteen/products/by-barcode/${encodeURIComponent(code)}`, { silent: true, headers: { 'x-branch-id': String(selectedBranchId) } })
      if (!res?.ok || !res?.product) {
        if (final && res?.code === 'not_found') {
          setError('Barkod bulunamadı')
          try { clearTimeout(errorTimerRef.current) } catch {}
          errorTimerRef.current = setTimeout(() => setError(''), 2000)
        }
        scanCountsRef.current.delete(code)
        return
      }
      const times = Number(scanCountsRef.current.get(code) || 1)
      scanCountsRef.current.delete(code)
      addToCart({ ...res.product, branchId: String(selectedBranchId) }, times)
    } finally {
      scanInFlightRef.current.delete(code)
    }
  }

  scanBarcodeRef.current = scanBarcode

  const resetScanSession = () => {
    scanBufRef.current = ''
    scanLastAtRef.current = 0
    scanSessionRef.current = false
    scanRestoreRef.current = null
    try { clearTimeout(scanTimerRef.current) } catch {}
    scanTimerRef.current = null
    try { clearTimeout(scanConfirmTimerRef.current) } catch {}
    scanConfirmTimerRef.current = null
  }

  const restoreToTarget = () => {
    const snap = scanRestoreRef.current
    const buf = String(scanBufRef.current || '')
    if (!snap || !buf) return
    const el = snap.el
    const tag = String(el?.tagName || '').toLowerCase()
    if (tag !== 'input' && tag !== 'textarea') return
    try {
      const cur = String(snap.value || '')
      const start = Number(snap.start || 0)
      const end = Number(snap.end || 0)
      const next = cur.slice(0, start) + buf + cur.slice(end)
      el.value = next
      const caret = start + buf.length
      if (typeof el.setSelectionRange === 'function') el.setSelectionRange(caret, caret)
      try { el.dispatchEvent(new Event('input', { bubbles: true })) } catch {}
    } catch {}
  }

  const finalizeScan = (buffer) => {
    const code = String(buffer || '').trim()
    if (!/^[0-9]+$/.test(code)) return
    if (code.length < 8 || code.length > 32) return
    setBarcode('')
    scanBarcodeRef.current?.(code, { source: 'scanner', final: true })
  }

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented) return
      if (e.ctrlKey || e.metaKey || e.altKey) {
        resetScanSession()
        return
      }

      const target = e.target
      if (target?.dataset?.allowManualNumeric === 'true') {
        resetScanSession()
        return
      }

      const now = Date.now()
      const key = String(e.key || '')
      const isEnter = key === 'Enter'
      const isEscape = key === 'Escape'
      const isChar = key.length === 1
      const isDigit = isChar && key >= '0' && key <= '9'

      const idleMs = 110
      const sessionStartMs = 50
      const humanBreakMs = 70

      if (isEscape) {
        resetScanSession()
        return
      }

      if (isEnter && scanSessionRef.current === true) {
        e.preventDefault()
        e.stopPropagation()
        const buf = String(scanBufRef.current || '')
        resetScanSession()
        finalizeScan(buf)
        return
      }

      if (!isDigit) {
        if (scanSessionRef.current === true && String(scanBufRef.current || '').length > 0) {
          const bufLen = String(scanBufRef.current || '').length
          if (bufLen < 8) restoreToTarget()
          resetScanSession()
        }
        return
      }

      const delta = scanLastAtRef.current ? now - scanLastAtRef.current : 0
      const shouldStartOrContinue = scanSessionRef.current === true || (scanLastAtRef.current > 0 && delta < sessionStartMs)

      if (!shouldStartOrContinue) {
        scanBufRef.current = ''
        scanLastAtRef.current = now
        scanSessionRef.current = true
        const tag = String(e.target?.tagName || '').toLowerCase()
        if (tag === 'input' || tag === 'textarea') {
          try {
            scanRestoreRef.current = {
              el: e.target,
              value: String(e.target.value || ''),
              start: Number(e.target.selectionStart || 0),
              end: Number(e.target.selectionEnd || 0)
            }
          } catch {
            scanRestoreRef.current = null
          }
        } else {
          scanRestoreRef.current = null
        }

        e.preventDefault()
        e.stopPropagation()
        scanBufRef.current += key

        try { clearTimeout(scanConfirmTimerRef.current) } catch {}
        scanConfirmTimerRef.current = setTimeout(() => {
          if (scanSessionRef.current !== true) return
          if (String(scanBufRef.current || '').length >= 2) return
          restoreToTarget()
          resetScanSession()
        }, sessionStartMs)

        try { clearTimeout(scanTimerRef.current) } catch {}
        scanTimerRef.current = setTimeout(() => {
          if (scanSessionRef.current !== true) return
          const buf = String(scanBufRef.current || '')
          if (buf.length >= 8) finalizeScan(buf)
          else restoreToTarget()
          resetScanSession()
        }, idleMs)
        return
      }

      if (scanSessionRef.current === true && delta && delta > humanBreakMs) {
        restoreToTarget()
        resetScanSession()
        return
      }

      scanSessionRef.current = true
      scanLastAtRef.current = now

      e.preventDefault()
      e.stopPropagation()
      scanBufRef.current += key
      if (scanBufRef.current.length > 32) scanBufRef.current = scanBufRef.current.slice(-32)

      try { clearTimeout(scanConfirmTimerRef.current) } catch {}
      scanConfirmTimerRef.current = null

      try { clearTimeout(scanTimerRef.current) } catch {}
      scanTimerRef.current = setTimeout(() => {
        if (scanSessionRef.current !== true) return
        const buf = String(scanBufRef.current || '')
        if (buf.length >= 8) finalizeScan(buf)
        else restoreToTarget()
        resetScanSession()
      }, idleMs)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const activeBranchName = useMemo(() => {
    const id = String(selectedBranchId || '').trim()
    if (!id) return ''
    return String(allowedBranches.find(b => String(b.id) === id)?.name || '')
  }, [allowedBranches, selectedBranchId])

  const inc = (productId) => {
    setCart(prev => prev.map(it => it.productId === productId ? { ...it, qty: Number(it.qty || 0) + 1 } : it))
  }

  const dec = (productId) => {
    setCart(prev => {
      const next = prev.map(it => it.productId === productId ? { ...it, qty: Number(it.qty || 0) - 1 } : it)
      return next.filter(it => Number(it.qty || 0) > 0)
    })
  }

  const setQty = (productId, nextQty) => {
    const raw = String(nextQty ?? '').replace(/[^\d]/g, '')
    const qty = raw === '' ? 0 : Math.floor(Number(raw))
    setCart(prev => {
      if (!Number.isFinite(qty) || qty < 0) return prev
      return prev.map(it => it.productId === productId ? { ...it, qty } : it)
    })
  }

  const removeLine = (productId) => {
    setCart(prev => prev.filter(it => it.productId !== productId))
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCustomerQuery(String(customerQuery || '').trim()), 350)
    return () => clearTimeout(t)
  }, [customerQuery])

  useEffect(() => {
    if (payMethod !== 'account') return
    const term = String(debouncedCustomerQuery || '').trim()

    if (term.length < 2) {
      setCustomers([])
      setLoadingCustomers(false)
      lastCustomerKeyRef.current = ''
      try { customerAbortRef.current?.abort() } catch {}
      customerAbortRef.current = null
      return
    }

    const key = `customers:${term.toLowerCase()}`
    if (lastCustomerKeyRef.current === key) return
    lastCustomerKeyRef.current = key

    try { customerAbortRef.current?.abort() } catch {}
    const controller = new AbortController()
    customerAbortRef.current = controller
    setLoadingCustomers(true)

    api(`/api/canteen/customers?q=${encodeURIComponent(term)}`, { silent: true, signal: controller.signal })
      .then((res) => {
        setCustomers(Array.isArray(res?.customers) ? res.customers : [])
        setLoadingCustomers(false)
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          try { console.debug('[CANTEEN_CUSTOMER_SEARCH_ERR]', err) } catch {}
        }
        setLoadingCustomers(false)
      })

    return () => {
      try { controller.abort() } catch {}
    }
  }, [debouncedCustomerQuery, payMethod])

  const submitNewCustomer = async () => {
    const name = String(newCustomerName || '').trim()
    if (!name) return
    const res = await api('/api/canteen/customers', {
      method: 'POST',
      data: { name, phone: String(newCustomerPhone || '').trim() },
      silent: true
    })
    if (res?.ok && res?.customer?.id) {
      setCustomerId(String(res.customer.id))
      setOpenNewCustomer(false)
      setNewCustomerName('')
      setNewCustomerPhone('')
      setCustomerQuery(String(name))
    } else {
      setError(res?.message || 'Cari eklenemedi')
    }
  }

  const completeSale = async () => {
    if (cart.length === 0) return
    if (payMethod === 'account' && !customerId) {
      setError('Cari seçmelisin')
      return
    }
    const missingBranch = cart.find(it => !String(it.productBranchId || '').trim())
    if (missingBranch) {
      setError('Ürün şubesi bulunamadı. Listeyi yenileyip tekrar deneyin.')
      return
    }

    const saleCart = cart.filter(it => Number(it.qty || 0) > 0)
    if (saleCart.length === 0) {
      setError('Sepette satışa uygun ürün yok')
      return
    }

    const groups = new Map()
    for (const it of saleCart) {
      const bid = String(it.productBranchId || '').trim()
      if (!bid) continue
      if (!groups.has(bid)) groups.set(bid, [])
      groups.get(bid).push(it)
    }
    const branchIds = Array.from(groups.keys())
    if (branchIds.length === 0) return

    const totalsByBranch = branchIds.map(bid => ({
      branchId: bid,
      subTotal: groups.get(bid).reduce((sum, it) => sum + Number(it.unitPrice || 0) * Number(it.qty || 0), 0)
    }))

    const grand = totalsByBranch.reduce((sum, x) => sum + Number(x.subTotal || 0), 0)
    if (!Number.isFinite(grand) || grand <= 0) return

    const allocations = totalsByBranch.map(x => ({ ...x, payAmount: Number(x.subTotal || 0) }))

    setSaving(true)
    setError('')
    setLastSale(null)

    const created = []
    const stockUpdatesAll = []
    for (const row of allocations) {
      const bid = row.branchId
      const items = (groups.get(bid) || []).map(it => ({ productId: it.productId, qty: Number(it.qty || 0) }))
      const payload = {
        items,
        payment: {
          method: payMethod,
          amount: row.payAmount,
          note: String(payNote || '').trim(),
          customerId: payMethod === 'account' ? String(customerId) : undefined
        },
        note: String(saleNote || '').trim()
      }

      const res = await api(`/api/canteen/sales?branchId=${encodeURIComponent(String(bid))}`, { method: 'POST', data: payload, silent: true })
      if (!res?.ok || !res?.sale) {
        const bname = allowedBranches.find(b => String(b.id) === String(bid))?.name || bid
        setError(`${bname} satışında hata: ${res?.message || 'Satış oluşturulamadı'}`)
        setSaving(false)
        return
      }
      created.push({ branchId: bid, sale: res.sale })
      if (Array.isArray(res.sale?.stockUpdates)) {
        for (const u of res.sale.stockUpdates) {
          if (!u?.productId) continue
          stockUpdatesAll.push({ branchId: String(bid), productId: String(u.productId), stockQty: Number(u.stockQty || 0) })
        }
      }
      if (import.meta.env.DEV) {
        try { console.debug('[CANTEEN_SALE_CREATED]', { branchId: bid, saleId: res.sale?.id }) } catch {}
      }
    }

    if (stockUpdatesAll.length > 0) {
      setProducts(prev => {
        const next = Array.isArray(prev) ? prev.map(p => ({ ...p })) : []
        for (const u of stockUpdatesAll) {
          const idx = next.findIndex(p => String(p.id || p._id || '') === String(u.productId) && String(p.branchId || '') === String(u.branchId))
          if (idx >= 0) next[idx].stockQty = Number(u.stockQty || 0)
        }
        return next
      })
    }

    const breakdown = created.map(x => {
      const bname = allowedBranches.find(b => String(b.id) === String(x.branchId))?.name || x.branchId
      return { branchId: x.branchId, name: bname, total: Number(x.sale?.total || 0), id: x.sale?.id }
    })
    setLastSale({ total: total, breakdown })
    setCart([])
    setPayNote('')
    setSaleNote('')
    setCustomerId('')
    setSaving(false)

    setTimeout(() => {
      const el = (() => {
        try { return document.activeElement } catch { return null }
      })()
      const tag = String(el?.tagName || '').toLowerCase()
      const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable
      if (isEditable) return
      try { barcodeInputRef.current?.focus() } catch {}
    }, 200)
  }

  if (!canPos) return <div className="card">403 – Bu sayfaya yetkin yok</div>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Kasa</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>{activeBranchName ? `Aktif Şube: ${activeBranchName}` : ''}</div>
        </div>
        <button className="btn btn--compact" type="button" onClick={loadProducts} disabled={loadingProducts}>{loadingProducts ? '...' : 'Yenile'}</button>
      </div>

      {!!error && <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}

      <div className="kasaLayout">
        <div className="card" style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Barkod okut</div>
            </div>
            <input
              className="input"
              ref={barcodeInputRef}
              value={barcode}
              onChange={(e) => {
                const v = e.target.value
                setBarcode(v)
                if (error) setError('')
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const v = String(barcode || '').trim()
                setBarcode('')
                scanBarcode(v, { source: 'manual', final: true })
              }}
              placeholder="Barkod"
              inputMode="numeric"
            />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ürün ara</div>
            <input
              className="input"
              value={q}
              onBlur={() => scheduleBarcodeFocus(250)}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ürün adı"
            />
          </label>
          <div className="kasaProductGrid kasaProductGridScroll">
            {filteredProducts.map(p => (
              <button
                key={p.id || p._id}
                type="button"
                className="card"
                onClick={() => addToCart(p)}
                style={{ cursor: 'pointer', textAlign: 'left', display: 'grid', gap: 6, borderColor: 'var(--border)' }}
              >
                <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{p.name}</div>
                {p.branchId && (
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {(allowedBranches.find(b => String(b.id) === String(p.branchId))?.name) || 'Şube'}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>{money(p.price)} ₺</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {p.stockTrackingEnabled === true ? `Stok: ${Number(p.stockQty || 0)}` : 'Stok: —'}
                  </div>
                </div>
              </button>
            ))}
            {!loadingProducts && filteredProducts.length === 0 && <div style={{ color: 'var(--muted)' }}>Ürün yok</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div className="card" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Sepet</div>
              <div style={{ color: '#111827', fontSize: 18, fontWeight: 800 }}>Toplam: {money(total)} ₺</div>
            </div>

            <div className="kasaCartList">
              {cart.map(it => (
                <div key={it.productId} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{it.name}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{money(it.unitPrice)} ₺</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button className="btn btn--compact" type="button" onClick={() => dec(it.productId)}>-</button>
                    <input
                      className="input"
                      type="text"
                      data-allow-manual-numeric="true"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={String(it.qty)}
                      onChange={(e) => setQty(it.productId, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => scheduleBarcodeFocus(250)}
                      style={{ width: 104, height: 36, textAlign: 'right', fontWeight: 700, padding: '6px 10px' }}
                    />
                    <button className="btn btn--compact" type="button" onClick={() => inc(it.productId)}>+</button>
                    <button className="btn btn--danger btn--compact" type="button" onClick={() => removeLine(it.productId)}>Sil</button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && <div style={{ color: 'var(--muted)' }}>Sepet boş</div>}
            </div>
          </div>

          <div className="card" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Ödeme Al</div>
              <button className="btn btn--compact onlyMobile" type="button" onClick={() => setPayAccordionOpen(v => !v)} aria-pressed={payAccordionOpen}>
                {payAccordionOpen ? 'Kapat' : 'Aç'}
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10 }} className={payAccordionOpen ? '' : 'onlyDesktop'}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { key: 'cash', label: 'Nakit' },
                { key: 'pos', label: 'POS' },
                { key: 'bank', label: 'Banka' },
                { key: 'account', label: 'Cari' }
              ].map(m => (
                <button
                  key={m.key}
                  type="button"
                  className="btn"
                  onClick={() => setPayMethod(m.key)}
                  aria-pressed={payMethod === m.key}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {payMethod === 'account' && (
              <div style={{ display: 'grid', gap: 8 }}>
                <label>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Cari seç</div>
                  <input
                    className="input"
                    value={customerQuery}
                    onBlur={() => scheduleBarcodeFocus(250)}
                    onChange={(e) => {
                      const v = e.target.value
                      setCustomerQuery(v)
                    }}
                    placeholder="İsim veya telefon"
                  />
                </label>
                <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto', paddingRight: 6 }}>
                  {customers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="btn btn--full btn--between"
                      onClick={() => setCustomerId(String(c.id))}
                      data-active={customerId === String(c.id) ? 'true' : 'false'}
                      disabled={loadingCustomers}
                    >
                      <span>{c.name}</span>
                      <span style={{ color: 'var(--muted)' }}>{c.phone || ''}</span>
                    </button>
                  ))}
                  {!loadingCustomers && String(debouncedCustomerQuery || '').trim().length < 2 && <div style={{ color: 'var(--muted)' }}>Aramak için en az 2 karakter yaz</div>}
                  {!loadingCustomers && String(debouncedCustomerQuery || '').trim().length >= 2 && customers.length === 0 && <div style={{ color: 'var(--muted)' }}>Cari yok</div>}
                </div>
                <button className="btn btn--primary" type="button" onClick={() => setOpenNewCustomer(true)}>+ Yeni cari ekle</button>
              </div>
            )}

            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not</div>
              <input
                className="input"
                value={payNote}
                onBlur={() => scheduleBarcodeFocus(250)}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Ödeme notu"
              />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Satış notu</div>
              <input
                className="input"
                value={saleNote}
                onBlur={() => scheduleBarcodeFocus(250)}
                onChange={(e) => setSaleNote(e.target.value)}
                placeholder="Satış notu"
              />
            </label>

            <button className="btn btn--primary btn--large onlyDesktop" type="button" onClick={completeSale} disabled={saving || cart.length === 0}>
              {saving ? 'Kaydediliyor...' : 'Satışı tamamla'}
            </button>

            {lastSale && (
              <div className="card" style={{ background: '#ecfdf5', borderColor: '#bbf7d0' }}>
                <div style={{ fontWeight: 700, color: '#166534' }}>Satış tamamlandı</div>
                <div style={{ color: '#166534', fontSize: 13 }}>Toplam: {money(lastSale.total)} ₺</div>
                <div style={{ color: '#166534', fontSize: 13 }}>
                  {Array.isArray(lastSale.breakdown)
                    ? `Satış ${lastSale.breakdown.length} şubeye bölündü: ${lastSale.breakdown.map(x => `${x.name} ${money(x.total)}₺`).join(', ')}`
                    : ''}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      <div className="onlyMobile stickyBottom kasaBottomBar" style={{ marginTop: 4 }}>
        <div className="kasaBottomBarInner">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div style={{ fontWeight: 800 }}>Toplam</div>
            <div style={{ fontWeight: 800 }}>{money(total)} ₺</div>
          </div>
          <button className="btn btn--primary btn--large" type="button" onClick={completeSale} disabled={saving || cart.length === 0}>
            {saving ? 'Kaydediliyor...' : 'Satışı tamamla'}
          </button>
        </div>
      </div>

      <Modal open={openNewCustomer} onClose={() => setOpenNewCustomer(false)} title="Yeni Cari">
        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input
              className="input"
              value={newCustomerName}
              onBlur={() => scheduleBarcodeFocus(250)}
              onChange={(e) => setNewCustomerName(e.target.value)}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Telefon</div>
            <input
              className="input"
              value={newCustomerPhone}
              onBlur={() => scheduleBarcodeFocus(250)}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={() => setOpenNewCustomer(false)}>Vazgeç</button>
            <button className="btn btn--primary" type="button" onClick={submitNewCustomer} disabled={!String(newCustomerName || '').trim()}>Kaydet</button>
          </div>
        </div>
      </Modal>


      <Modal open={branchModalOpen} onClose={() => {}} title="Şube Seç">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Kasa için aktif şubeyi seç.</div>
          <select
            className="input"
            value={selectedBranchId}
            onChange={(e) => {
              const v = String(e.target.value || '').trim()
              try {
                if (v) localStorage.setItem('selectedBranchId_canteen', v)
                else localStorage.removeItem('selectedBranchId_canteen')
              } catch {}
              setSelectedBranchId(v)
              try { window.dispatchEvent(new CustomEvent('canteen_branch_changed', { detail: { branchId: v || null } })) } catch {}
              if (v) setBranchModalOpen(false)
            }}
          >
            <option value="">Şube seç</option>
            {allowedBranches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  )
}
