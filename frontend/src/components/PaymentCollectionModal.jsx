import React from 'react'
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
  submitLabel = 'Odeme Ekle',
  showDiscount = false,
  discountDraft = '',
  onDiscountDraftChange,
  onApplyDiscount,
  showVeresiye = false,
  onOpenVeresiye,
  dialogStyle = null
}) {
  const grossTotal = Number(order?.total ?? order?.totals?.total ?? order?.totals?.grandTotal ?? 0)
  const discountTotal = Number(order?.discountTotal ?? order?.totals?.discountTotal ?? 0)
  const netTotal = Number(order?.netTotal ?? order?.totals?.netTotal ?? grossTotal)
  const paidTotal = Number(order?.paidTotal ?? order?.totals?.paidTotal ?? 0)
  const balanceDue = Math.max(0, Number(order?.balanceDue ?? order?.totals?.balanceDue ?? (netTotal - paidTotal)))
  const metaLabel = order?.orderNo ? `Siparis ${order.orderNo}` : `Siparis #${String(order?.id || '').slice(-6)}`
  const discountHistoryLine = discountTotal > 0
    ? {
        kind: 'discount',
        id: `discount:${String(order?.id || order?._id || metaLabel)}`,
        createdAt: order?.updatedAt || order?.createdAt || null,
        amount: discountTotal,
        label: 'Indirim',
        note: Number(order?.discountPercent || 0) > 0 ? `%${Number(order.discountPercent || 0)} indirim uygulandi` : '',
        accountName: '',
        canDelete: !!(showDiscount && canTakePayment && onDeleteLine)
      }
    : null
  const historyLines = discountHistoryLine ? [discountHistoryLine, ...previousLines] : previousLines
  const visiblePayMethods = (Array.isArray(payMethods) ? payMethods : []).filter((method) => inferPaymentMethodType(method) !== 'credit')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Odeme Al"
      backdropClose={false}
      dialogStyle={{ width: 'min(700px, calc(100vw - 32px))', ...(dialogStyle || {}) }}
      bodyStyle={{ paddingTop: 10, paddingInline: 16, paddingBottom: 14 }}
    >
      {!order ? <div>Yukleniyor...</div> : (
        <div className="payment-modal-stack">
          <div className="payment-meta-line">
            {customerLabel} - {order?.customerName || 'Musteri'} - {metaLabel}
          </div>

          <div className="payment-panel">
            <div className="payment-panel-body payment-summary-card">
              <div className="payment-summary-row">
                <div style={{ color: 'var(--muted)' }}>Brut</div>
                <div style={{ fontWeight: 600 }}>{money(grossTotal)}</div>
              </div>
              {showDiscount ? (
                <div className="payment-summary-row payment-summary-row--editor">
                  <div style={{ color: 'var(--muted)' }}>Indirim (%)</div>
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
                    <button className="btn btn--compact" onClick={onApplyDiscount} disabled={!canTakePayment || busy}>
                      Uygula
                    </button>
                  </div>
                </div>
              ) : null}
              {showDiscount ? (
                <div className="payment-summary-row">
                  <div style={{ color: 'var(--muted)' }}>Indirim Tutari</div>
                  <div style={{ fontWeight: 600 }}>{money(discountTotal)}</div>
                </div>
              ) : null}
              <div className="payment-summary-row">
                <div style={{ color: 'var(--muted)' }}>Net</div>
                <div style={{ fontWeight: 700 }}>{money(netTotal)}</div>
              </div>
              <div className="payment-summary-row">
                <div style={{ color: 'var(--muted)' }}>Odenen</div>
                <div style={{ fontWeight: 600 }}>{money(paidTotal)}</div>
              </div>
              <div className="payment-summary-row">
                <div style={{ color: 'var(--muted)' }}>Kalan</div>
                <div style={{ fontWeight: 700 }}>{money(balanceDue)}</div>
              </div>
            </div>
          </div>

          {historyLines.length > 0 ? (
            <div className="payment-panel">
              <div className="payment-panel-body">
                <div style={{ fontWeight: 600, marginBottom: 2 }}>Onceki Odemeler</div>
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

          <div className="payment-panel">
            <div className="payment-panel-body">
              <div>
                <div className="payment-field-label">Yontem</div>
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
                <div className="payment-field-label">Tutar</div>
                <input
                  type="number"
                  className="input"
                  value={paymentAmount}
                  onChange={(event) => onPaymentAmountChange?.(event.target.value)}
                  placeholder="Tutar giriniz"
                  disabled={!canTakePayment || busy}
                />
              </label>
              <label>
                <div className="payment-field-label">Not (opsiyonel)</div>
                <input className="input" value={paymentNote} onChange={(event) => onPaymentNoteChange?.(event.target.value)} disabled={!canTakePayment || busy} />
              </label>
              {selectedPaymentIsCash ? (
                <div className="payment-summary-row" style={{ fontSize: 12, color: 'var(--muted)' }}>
                  <div>Parausu</div>
                  <div style={{ fontWeight: 600 }}>{money(changeDue)}</div>
                </div>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {showPaymentDate ? (
                    <SalesEntryDateButton
                      value={paymentDate}
                      onChange={onPaymentDateChange}
                      title="Odeme tarihini sec"
                      showValue
                    />
                  ) : null}
                </div>
                <div className="payment-actions app-modal-footer">
                  <button className="btn btn--compact" onClick={onSubmit} disabled={!canTakePayment || busy || balanceDue <= 0.01}>
                    {submitLabel}
                  </button>
                  {showVeresiye ? (
                    <button className="btn btn--compact" onClick={onOpenVeresiye} disabled={busy || balanceDue <= 0.01}>
                      Veresiye Yap
                    </button>
                  ) : null}
                  <button className="btn btn--compact" onClick={onClose} disabled={busy}>
                    Kapat
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
