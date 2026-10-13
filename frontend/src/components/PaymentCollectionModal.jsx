import React, { useEffect, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import SalesEntryDateButton from './SalesEntryDateButton.jsx'
import { inferPaymentMethodType } from '../lib/paymentMethods.js'

const money = (value) => `${Number(value || 0).toFixed(2)} TL`

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
  const paymentAmountKeypadEditedRef = useRef(false)
  const grossTotal = Number(order?.total ?? order?.totals?.total ?? order?.totals?.grandTotal ?? 0)
  const discountTotal = Number(order?.discountTotal ?? order?.totals?.discountTotal ?? 0)
  const netTotal = Number(order?.netTotal ?? order?.totals?.netTotal ?? grossTotal)
  const paidTotal = Number(order?.paidTotal ?? order?.totals?.paidTotal ?? 0)
  const balanceDue = Math.max(0, Number(order?.balanceDue ?? order?.totals?.balanceDue ?? (netTotal - paidTotal)))
  const metaLabel = order?.orderNo ? `Sipariş ${order.orderNo}` : `Sipariş #${String(order?.id || '').slice(-6)}`
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

  useEffect(() => {
    if (!open) return
    paymentAmountKeypadEditedRef.current = false
    setPaymentNoteOpen(false)
  }, [open])

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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ödeme Al"
      backdropClose={false}
      dialogStyle={{ width: 'min(700px, calc(100vw - 32px))', ...(dialogStyle || {}) }}
      bodyStyle={{ paddingTop: 10, paddingInline: 16, paddingBottom: 14 }}
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
          <div className="payment-meta-line">
            {customerLabel} - {order?.customerName || 'Müşteri'} - {metaLabel}
          </div>

          <div className="payment-panel payment-entry-pane">
            <div className="payment-panel-body">
              <div className="payment-split-order-summary">
                <div className="payment-summary-row">
                  <span>Ara Toplam</span>
                  <strong>{money(grossTotal)}</strong>
                </div>
                {showDiscount ? (
                <div className="payment-summary-row payment-summary-row--editor">
                  <label className="payment-field-label">İndirim (%)</label>
                  <div className="payment-summary-actions">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="input"
                      value={discountDraft}
                      onChange={(event) => onDiscountDraftChange?.(event.target.value)}
                      disabled={!canTakePayment || busy}
                    />
                    <button className="btn btn--compact" type="button" onClick={onApplyDiscount} disabled={!canTakePayment || busy}>
                      Uygula
                    </button>
                  </div>
                </div>
                ) : null}
                {showDiscount ? (
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
                ) : (
                  <div className="payment-summary-row payment-summary-row--net">
                    <span>Net</span>
                    <strong>{money(netTotal)}</strong>
                  </div>
                )}
              </div>

              {historyLines.length > 0 ? (
                <div className="payment-panel payment-history-panel">
                  <div className="payment-panel-body">
                    <div className="payment-split-title">Önceki Ödemeler</div>
                <div className="payment-history-list">
                  {historyLines.map((line) => (
                    <div key={`${line.kind}:${line.id}`} className="payment-history-row">
                      <div style={{ display: 'grid' }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(line.createdAt || Date.now()).toLocaleString('tr-TR')}</div>
                        <div style={{ fontWeight: 600 }}>
                          {money(line.amount)} - {line.label}
                          {(line.accountName && line.accountName !== '-') ? ` - ${line.accountName}` : ''}
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
              ) : null}

              <div>
                <div className="payment-field-label">Ödeme Yöntemi</div>
                <div className="payment-method-grid">
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
                <button className="payment-key payment-key--submit" type="button" onClick={onSubmit} disabled={!canTakePayment || busy || balanceDue <= 0.01}>
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
                    <span>Ödenen</span><strong>{money(paidTotal)}</strong>
                  </div>
                  <div className="payment-summary-row">
                    <span>Kalan</span><strong>{money(balanceDue)}</strong>
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
                  <div>Para üstü</div>
                  <div style={{ fontWeight: 600 }}>{money(changeDue)}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
