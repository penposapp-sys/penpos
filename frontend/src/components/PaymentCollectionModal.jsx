import React, { useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import SalesEntryDateButton from './SalesEntryDateButton.jsx'
import ProductImage from './ProductImage.jsx'
import { buildCartRows } from '../lib/cartItemRows.js'
import { servingTypeLabelTR } from '../utils/servingType.js'
import { inferPaymentMethodType } from '../lib/paymentMethods.js'

const money = (value) => `${Number(value || 0).toFixed(2)} TL`
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100

export default function PaymentCollectionModal({
  open,
  onClose,
  order,
  customerLabel = 'Paket',
  payMethods = [],
  paymentMethod = '',
  onPaymentMethodChange,
  paymentAmount = '',
  onPaymentAmountChange,
  paymentDate = '',
  onPaymentDateChange,
  showPaymentDate = false,
  paymentNote = '',
  onPaymentNoteChange,
  canTakePayment = false,
  busy = false,
  previousLines = [],
  onDeleteLine,
  selectedPaymentIsCash = false,
  changeDue = 0,
  onSubmit,
  submitLabel = 'Ödeme Ekle',
  showDiscount = false,
  discountDraft = '',
  onDiscountDraftChange,
  onApplyDiscount,
  showVeresiye = false,
  onOpenVeresiye,
  dialogStyle = null
}) {
  const [paymentNoteOpen, setPaymentNoteOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [splitSelection, setSplitSelection] = useState({})
  const [splitDraftCounts, setSplitDraftCounts] = useState({})
  const paymentAmountKeypadEditedRef = useRef(false)

  const grossTotal = Number(order?.total ?? order?.totals?.total ?? order?.totals?.grandTotal ?? 0)
  const discountPercent = Number(order?.discountPercent ?? 0)
  const discountTotal = Number(order?.discountTotal ?? order?.totals?.discountTotal ?? ((grossTotal * discountPercent) / 100))
  const netTotal = Number(order?.netTotal ?? order?.totals?.netTotal ?? Math.max(0, grossTotal - discountTotal))
  const paidTotal = Number(order?.paidTotal ?? order?.totals?.paidTotal ?? 0)
  const balanceDue = Math.max(0, netTotal - paidTotal)
  const signedBalance = (() => {
    const value = round2(netTotal - paidTotal)
    return Math.abs(value) <= 0.01 ? 0 : value
  })()
  const signedBalanceLabel = signedBalance < -0.01 ? 'Fazla' : 'Kalan'
  const signedBalanceValue = signedBalance < -0.01 ? Math.abs(signedBalance) : signedBalance
  const metaLabel = order?.orderNo ? `Sipariş ${order.orderNo}` : `Sipariş #${String(order?.id || '').slice(-6)}`
  const headerLabel = /masasız/i.test(String(customerLabel || '')) ? 'Masasız' : (customerLabel || 'Paket')
  const headerMeta = `${headerLabel} · ${order?.orderNo ? `Sipariş ${order.orderNo}` : 'Sipariş —'}`
  const discountHistoryLine = discountTotal > 0
    ? {
        kind: 'discount',
        id: `discount:${String(order?.id || order?._id || metaLabel)}`,
        createdAt: order?.updatedAt || order?.createdAt || null,
        amount: discountTotal,
        label: 'İndirim',
        note: Number(order?.discountPercent || 0) > 0 ? `%${Number(order.discountPercent || 0)} indirim uygulandı` : '',
        accountName: '',
        canDelete: !!(showDiscount && canTakePayment && onDeleteLine)
      }
    : null
  const historyLines = discountHistoryLine ? [discountHistoryLine, ...previousLines] : previousLines
  const visiblePayMethods = (Array.isArray(payMethods) ? payMethods : []).filter((method) => inferPaymentMethodType(method) !== 'credit')

  const splitRows = useMemo(() => {
    const items = Array.isArray(order?.items) ? order.items : []
    return buildCartRows(
      items.filter((item) => item && item.status !== 'cancelled' && Number(item?.qty || 0) > 0),
      'separate',
      'split'
    )
  }, [order?.items])

  const paidSplitUnitCounts = useMemo(() => {
    const counts = new Map()
    const payments = Array.isArray(order?.payments) ? order.payments : []
    for (const payment of payments) {
      const allocations = Array.isArray(payment?.itemAllocations) ? payment.itemAllocations : []
      for (const allocation of allocations) {
        const itemId = String(allocation?.itemId || '').trim()
        const qty = Math.max(0, Math.floor(Number(allocation?.qty || 0)))
        if (!itemId || qty <= 0) continue
        counts.set(itemId, (counts.get(itemId) || 0) + qty)
      }
    }
    return counts
  }, [order?.payments])

  const payableSplitRows = useMemo(() => {
    const usedCounts = new Map()
    return splitRows.filter((row) => {
      const itemId = String(row?.itemId || row?.repr?._id || row?.repr?.id || '').trim()
      if (!itemId) return true
      const alreadyPaidQty = paidSplitUnitCounts.get(itemId) || 0
      const seenQty = usedCounts.get(itemId) || 0
      usedCounts.set(itemId, seenQty + 1)
      return seenQty >= alreadyPaidQty
    })
  }, [splitRows, paidSplitUnitCounts])

  const splitCardGroups = useMemo(() => {
    const groups = new Map()
    for (const row of splitRows) {
      const item = row?.repr || {}
      const recordId = String(row?.itemId || item?._id || item?.id || '')
      const productId = String(item?.menuItemId || item?.productId || item?.product?._id || '').trim()
      const productName = String(item?.nameSnapshot || item?.name || '').trim().toLocaleLowerCase('tr-TR')
      const quantity = Math.max(1, Math.floor(Number(item?.qty || 0) || 1))
      const unitPrice = Number(item?.priceSnapshot ?? (quantity > 0 ? Number(item?.subtotal || 0) / quantity : 0))
      const groupKey = JSON.stringify([
        productId || productName || recordId || String(row?.key || ''),
        unitPrice,
        String(item?.servingType || ''),
        String(item?.note || '').trim(),
        Boolean(item?.isWeightBased)
      ])
      const itemId = groupKey
      if (!groups.has(itemId)) {
        groups.set(itemId, { itemId, recordId, item, rows: [], records: [], quantity: 0, lineTotal: 0 })
      }
      const group = groups.get(itemId)
      group.rows.push(row)
      if (recordId && !group.records.some((record) => record.recordId === recordId)) {
        group.records.push({ recordId, item })
        group.quantity += quantity
        group.lineTotal += Number(item?.subtotal ?? unitPrice * quantity)
      }
    }
    return Array.from(groups.values())
  }, [splitRows])

  const splitSelectedRows = useMemo(
    () => payableSplitRows.filter((row) => splitSelection?.[row.key] === true),
    [payableSplitRows, splitSelection]
  )
  const splitSelectedSubtotal = useMemo(
    () => splitSelectedRows.reduce((sum, row) => sum + (Number(row?.subtotal || row?.repr?.subtotal || 0) || 0), 0),
    [splitSelectedRows]
  )
  const splitSelectedAmount = useMemo(() => {
    const subtotal = Math.max(0, splitSelectedSubtotal)
    const discount = Math.max(0, Math.min(100, Number(discountPercent || 0)))
    const net = subtotal - ((subtotal * discount) / 100)
    return Math.max(0, Math.round(net * 100) / 100)
  }, [splitSelectedSubtotal, discountPercent])
  const canSplitOrder = !!order && (order.status === 'open' || order.status === 'sent') && payableSplitRows.length > 0 && signedBalance > 0.01

  useEffect(() => {
    if (!open) return
    paymentAmountKeypadEditedRef.current = false
    setPaymentNoteOpen(false)
    setSplitOpen(false)
    setSplitSelection({})
    setSplitDraftCounts({})
  }, [open, order?.id])

  const applyPaymentKey = (key) => {
    const currentAmount = paymentAmountKeypadEditedRef.current ? String(paymentAmount || '') : ''
    paymentAmountKeypadEditedRef.current = true
    if (key === 'back') {
      onPaymentAmountChange?.(currentAmount.slice(0, -1))
      return
    }
    if (key === '.') {
      if (currentAmount.includes('.')) return
      onPaymentAmountChange?.(currentAmount ? `${currentAmount}.` : '0.')
      return
    }
    onPaymentAmountChange?.(currentAmount === '0' ? key : `${currentAmount}${key}`)
  }

  const openSplit = () => {
    setSplitSelection((current) => {
      if (Object.keys(current || {}).length > 0) return current
      return Object.fromEntries(payableSplitRows.map((row) => [row.key, false]))
    })
    setSplitOpen((current) => !current)
  }

  const submitSplit = () => {
    if (splitSelectedRows.length === 0) return
    onPaymentAmountChange?.(splitSelectedAmount > 0 ? String(splitSelectedAmount) : '')
    paymentAmountKeypadEditedRef.current = false
    setSplitOpen(false)
  }

  const handleSubmit = () => {
    const amount = Number(paymentAmount || 0)
    const useAllocations = splitSelectedRows.length > 0 && Math.abs(round2(amount) - splitSelectedAmount) <= 0.01
    const allocationMap = new Map()
    if (useAllocations) {
      for (const row of splitSelectedRows) {
        const itemId = String(row?.itemId || row?.repr?._id || row?.repr?.id || '')
        if (!itemId) continue
        const current = allocationMap.get(itemId) || {
          itemId,
          menuItemId: String(row?.menuItemId || row?.repr?.menuItemId || ''),
          qty: 0,
          subtotal: 0
        }
        current.qty += 1
        current.subtotal += Number(row?.subtotal || row?.repr?.subtotal || 0) || 0
        allocationMap.set(itemId, current)
      }
    }
    onSubmit?.({ itemAllocations: Array.from(allocationMap.values()) })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ödeme Al"
      headerActions={<span className="payment-modal-header-meta">{headerMeta}</span>}
      backdropClose={false}
      dialogStyle={{ width: 'min(1080px, calc(100vw - 40px))', maxHeight: '88dvh', ...(dialogStyle || {}) }}
      bodyStyle={{ paddingTop: 10, paddingInline: 16, paddingBottom: 14, maxHeight: 'calc(88dvh - 76px)' }}
    >
      {!order ? <div>Yükleniyor...</div> : (
        <div className="payment-modal-stack">
          <div className="payment-amount-banner">
            <span className="payment-amount-icon" aria-hidden="true">▣</span>
            <span className="payment-amount-copy">
              <span>Ödenecek Tutar</span>
              <strong>{money(balanceDue)}</strong>
            </span>
            {showPaymentDate ? (
              <div className="payment-amount-date">
                <span className="payment-amount-date-label">Ödeme Tarihi</span>
                <SalesEntryDateButton
                  value={paymentDate}
                  onChange={onPaymentDateChange}
                  title="Ödeme tarihini seç"
                  showValue
                />
              </div>
            ) : null}
          </div>

          <div className="payment-modal-layout">
            <section className="payment-panel payment-split-pane">
              {historyLines.length > 0 && (
                <div className="payment-panel payment-history-panel">
                  <div className="payment-panel-body">
                    <div className="payment-split-title">Önceki Ödemeler</div>
                    <div className="payment-history-list">
                      {historyLines.map((line) => (
                        <div key={`${line.kind}:${line.id}`} className="payment-history-row">
                          <div style={{ display: 'grid' }}>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(line.createdAt || Date.now()).toLocaleString()}</div>
                            <div style={{ fontWeight: 600 }}>
                              {money(line.amount)} • {line.label}
                              {(line.accountName && line.accountName !== '-') ? ` • ${line.accountName}` : ''}
                            </div>
                            {!!line.note && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{line.note}</div>}
                          </div>
                          {line.canDelete && onDeleteLine ? (
                            <button className="btn btn--compact" onClick={() => onDeleteLine(line)} disabled={busy}>Sil</button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="payment-panel-body">
                <div className="payment-split-heading">
                  <div>
                    <div className="payment-split-title">Ödeme Bölme</div>
                    <div className="payment-split-caption">
                      {splitSelectedRows.length > 0
                        ? `${splitSelectedRows.length} adet seçildi • ${money(splitSelectedAmount)}`
                        : 'Ödenecek ürün ve adetleri seçin.'}
                    </div>
                  </div>
                  <button
                    className="btn btn--compact payment-split-toggle"
                    type="button"
                    onClick={openSplit}
                    aria-expanded={splitOpen}
                    aria-controls="payment-split-content"
                    disabled={!canSplitOrder || busy}
                  >
                    {splitOpen ? 'Bölmeyi Kapat' : 'Bölme Düzeni'}
                  </button>
                </div>
                <div id="payment-split-content" className={`payment-split-content${splitOpen ? ' is-open' : ''}`}>
                  <div className="payment-split-list">
                    {splitCardGroups.map((group) => {
                      const item = group.item || {}
                      const itemId = group.itemId
                      const groupRecordIds = new Set(group.records.map((record) => record.recordId))
                      const splitRowsForItem = payableSplitRows.filter((row) => groupRecordIds.has(String(row?.itemId || row?.repr?._id || row?.repr?.id || row?.key || '')))
                      const selectedQty = splitRowsForItem.filter((row) => splitSelection?.[row.key] === true).length
                      const draftQty = Math.min(splitRowsForItem.length, Math.max(0, Math.floor(Number(splitDraftCounts?.[itemId] || 0))))
                      const paidQty = group.records.reduce((sum, record) => sum + (paidSplitUnitCounts.get(record.recordId) || 0), 0)
                      const itemQty = group.quantity
                      const selected = draftQty > 0 && selectedQty === draftQty
                      const servingLabel = servingTypeLabelTR(item?.servingType || order?.servingType, { fallback: '' })
                      const unitPrice = Number(item?.priceSnapshot ?? (itemQty > 0 ? Number(item?.subtotal || 0) / itemQty : 0))
                      const lineTotal = group.lineTotal
                      const note = String(item?.note || '').trim()
                      return (
                        <article key={itemId} className="payment-split-product">
                          <div className="payment-split-product-main">
                            <div className="payment-split-product-info-row">
                              <ProductImage
                                className="payment-split-product-image"
                                product={item}
                                alt={item?.nameSnapshot || item?.productName || 'Ürün'}
                                loading="lazy"
                              />
                              <div className="payment-split-product-heading">
                                <div className="payment-split-item">
                                  <div className="payment-split-item-name">{item?.nameSnapshot || item?.productName || 'Ürün'}</div>
                                  <div className="payment-split-item-meta">
                                    {unitPrice.toFixed(2)} TL{item?.isWeightBased ? '/KG' : ''}
                                    {servingLabel ? ` • ${servingLabel}` : ''}
                                  </div>
                                  {note ? <div className="payment-split-item-meta">Not: {note}</div> : null}
                                </div>
                                <strong className="payment-split-product-total">{lineTotal.toFixed(2)} TL</strong>
                              </div>
                            </div>
                            <div className="payment-split-product-actions-row">
                              <div className="payment-split-product-controls">
                                <div className="payment-split-quantity" aria-label={`Bölünecek adet ${draftQty}`}>
                                  <button
                                    type="button"
                                    className="payment-split-quantity-decrease"
                                    aria-label={`${item?.nameSnapshot || 'Ürün'} bölünecek adedini azalt`}
                                    onClick={() => {
                                      setSplitDraftCounts((prev) => ({ ...(prev || {}), [itemId]: Math.max(0, draftQty - 1) }))
                                      setSplitSelection((prev) => {
                                        const next = { ...(prev || {}) }
                                        for (const row of group.rows) delete next[row.key]
                                        return next
                                      })
                                    }}
                                    disabled={draftQty <= 0 || busy}
                                  >
                                    −
                                  </button>
                                  <span>{draftQty}</span>
                                  <button
                                    type="button"
                                    className="payment-split-quantity-increase"
                                    aria-label={`${item?.nameSnapshot || 'Ürün'} bölünecek adedini artır`}
                                    onClick={() => {
                                      setSplitDraftCounts((prev) => ({ ...(prev || {}), [itemId]: Math.min(splitRowsForItem.length, draftQty + 1) }))
                                      setSplitSelection((prev) => {
                                        const next = { ...(prev || {}) }
                                        for (const row of group.rows) delete next[row.key]
                                        return next
                                      })
                                    }}
                                    disabled={draftQty >= splitRowsForItem.length || busy}
                                  >
                                    +
                                  </button>
                                </div>
                                <span className="payment-split-allocation">
                                  Bölünen {Math.min(paidQty, itemQty)}/{itemQty}
                                  {selectedQty > 0 ? ` · Seçilen ${selectedQty}` : ''}
                                </span>
                              </div>
                              <div className="payment-split-unit-list">
                                <button
                                  type="button"
                                  className={`payment-split-select${selected ? ' is-selected' : ''}`}
                                  aria-pressed={selected}
                                  onClick={() => {
                                    setSplitSelection((prev) => {
                                      const next = { ...(prev || {}) }
                                      for (const row of group.rows) delete next[row.key]
                                      if (!selected) {
                                        for (const row of splitRowsForItem.slice(0, draftQty)) next[row.key] = true
                                      }
                                      return next
                                    })
                                  }}
                                  disabled={!canSplitOrder || busy || draftQty === 0}
                                >
                                  {selected ? 'Seçildi' : `Böl ${draftQty}`}
                                </button>
                                {splitRowsForItem.length === 0 ? (
                                  <span className="payment-split-paid-label">Tüm adetler ödendi</span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                    {splitCardGroups.length === 0 ? (
                      <div className="payment-split-empty">Siparişte ürün bulunmuyor.</div>
                    ) : null}
                  </div>
                  <div className="payment-split-footer">
                    <div className="payment-split-total">
                      <span>Seçilen ürünlerin net tutarı</span>
                      <strong>{money(splitSelectedAmount)}</strong>
                    </div>
                    <div className="payment-split-actions">
                      {splitSelectedRows.length > 0 ? (
                        <button
                          className="btn btn--compact"
                          type="button"
                          onClick={() => {
                            setSplitSelection({})
                            setSplitDraftCounts({})
                            onPaymentAmountChange?.(balanceDue > 0 ? String(balanceDue) : '')
                            paymentAmountKeypadEditedRef.current = false
                          }}
                          disabled={busy}
                        >
                          Seçimi Temizle
                        </button>
                      ) : null}
                      <button className="btn btn--compact" type="button" onClick={submitSplit} disabled={payableSplitRows.length === 0 || busy}>
                        Tutarı Uygula
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="payment-entry-pane">
              <div className="payment-panel">
                <div className="payment-panel-body">
                  <div className="payment-split-order-summary">
                    <div className="payment-summary-row">
                      <span>Ara Toplam</span>
                      <strong>{money(grossTotal)}</strong>
                    </div>
                    {showDiscount ? (
                      <>
                        <div className="payment-summary-row payment-summary-row--editor">
                          <label className="payment-field-label" htmlFor="payment-discount-percent">İndirim (%)</label>
                          <div className="payment-summary-actions">
                            <input
                              id="payment-discount-percent"
                              type="number"
                              min="0"
                              max="100"
                              className="input"
                              value={discountDraft}
                              onChange={(event) => onDiscountDraftChange?.(event.target.value)}
                              disabled={!canTakePayment || busy}
                            />
                            <button className="btn btn--compact" type="button" onClick={() => onApplyDiscount?.()} disabled={!canTakePayment || busy}>
                              Uygula
                            </button>
                          </div>
                        </div>
                        <div className="payment-discount-presets" aria-label="Hazır indirim oranları">
                          {[1, 5, 10, 15, 20, 25, 30].map((percent) => (
                            <button
                              key={percent}
                              type="button"
                              onClick={() => {
                                onDiscountDraftChange?.(String(percent))
                                onApplyDiscount?.(percent)
                              }}
                              disabled={!canTakePayment || busy}
                            >
                              %{percent}
                            </button>
                          ))}
                        </div>
                        <div className="payment-summary-totals">
                          <div className="payment-summary-row">
                            <span>İndirim Tutarı</span>
                            <strong>{money(discountTotal)}</strong>
                          </div>
                          <div className="payment-summary-row payment-summary-row--net">
                            <span>Net</span>
                            <strong>{money(netTotal)}</strong>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="payment-summary-row payment-summary-row--net">
                        <span>Net</span>
                        <strong>{money(netTotal)}</strong>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="payment-field-label">Ödeme Yöntemi</div>
                    <div id="payment-method-grid" className="payment-method-grid">
                      {visiblePayMethods.map((method) => {
                        const key = String(method?.key || method?.id || '')
                        const label = method?.label || method?.name || key
                        const active = String(paymentMethod || '') === key
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`btn payment-method-btn ${active ? 'is-active' : ''}`}
                            disabled={!canTakePayment || busy}
                            onClick={() => onPaymentMethodChange?.(key)}
                          >
                            {label}
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
                      value={paymentAmount}
                      onChange={(event) => {
                        paymentAmountKeypadEditedRef.current = true
                        onPaymentAmountChange?.(event.target.value)
                      }}
                      placeholder="Tutar giriniz"
                      disabled={!canTakePayment || busy}
                    />
                  </label>
                  <div className="payment-quick-values" aria-label="Hızlı tutarlar">
                    <button type="button" className="payment-quick-all" onClick={() => { paymentAmountKeypadEditedRef.current = true; onPaymentAmountChange?.(balanceDue > 0 ? String(balanceDue) : '') }} disabled={!canTakePayment || busy}>
                      Tamamını Al
                      <span>{money(balanceDue)}</span>
                    </button>
                    {[1000, 500, 200, 100].map((amount) => (
                      <button key={amount} type="button" onClick={() => { paymentAmountKeypadEditedRef.current = true; onPaymentAmountChange?.(String(amount)) }} disabled={!canTakePayment || busy}>
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
                        onClick={() => applyPaymentKey(key)}
                        disabled={!canTakePayment || busy}
                      >
                        {key === 'back' ? '⌫' : key === '.' ? ',' : key}
                      </button>
                    ))}
                    <button className="payment-key payment-key--submit" type="button" onClick={handleSubmit} disabled={!canTakePayment || busy || balanceDue <= 0.01}>
                      <span aria-hidden="true">✓</span>{submitLabel}
                    </button>
                    {showVeresiye ? (
                      <button className="payment-key payment-key--credit" type="button" onClick={onOpenVeresiye} disabled={busy || balanceDue <= 0.01}>
                        Veresiye Yap
                      </button>
                    ) : null}
                  </div>
                  <div className="payment-panel payment-balance-summary">
                    <div className="payment-panel-body payment-summary-card">
                      <div className="payment-summary-row">
                        <div style={{ color: 'var(--muted)' }}>Ödenen</div>
                        <div style={{ fontWeight: 600 }}>{money(paidTotal)}</div>
                      </div>
                      <div className="payment-summary-row">
                        <div style={{ color: 'var(--muted)' }}>{signedBalanceLabel}</div>
                        <div style={{ fontWeight: 700 }}>{money(signedBalanceValue)}</div>
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn payment-note-toggle"
                    type="button"
                    aria-expanded={paymentNoteOpen}
                    aria-controls="payment-note-field"
                    onClick={() => setPaymentNoteOpen((current) => !current)}
                  >
                    {paymentNoteOpen ? 'Notu Kapat' : 'Not Ekle (Opsiyonel)'}
                  </button>
                  <div id="payment-note-field" hidden={!paymentNoteOpen}>
                    <label>
                      <div className="payment-field-label">Not (opsiyonel)</div>
                      <input className="input" value={paymentNote} onChange={(event) => onPaymentNoteChange?.(event.target.value)} disabled={!canTakePayment || busy} />
                    </label>
                  </div>
                  {selectedPaymentIsCash ? (
                    <div className="payment-summary-row" style={{ fontSize: 12, color: 'var(--muted)' }}>
                      <div>Paraüstü</div>
                      <div style={{ fontWeight: 600 }}>{money(changeDue)}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </Modal>
  )
}
