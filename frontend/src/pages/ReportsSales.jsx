import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { buildBranchQueryParams } from '../lib/branchQuery.js'
import { toast } from '../lib/toast.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { trPaymentMethodLabel, trStatusLabel } from '../i18n/tr.js'

export function ReportsSalesContent({ embedded = false }) {
  const { allowedBranchIds, user } = useAuth()

  const toYmd = (d) => {
    const dt = d instanceof Date ? d : new Date()
    const y = String(dt.getFullYear())
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const day = String(dt.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const [from, setFrom] = useState(() => toYmd(new Date()))
  const [to, setTo] = useState(() => toYmd(new Date()))
  const [summary, setSummary] = useState({ totalSales: 0, totalPaid: 0, overpayTotal: 0, count: 0 })
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const [autoLoaded, setAutoLoaded] = useState(false)

  const [expandedId, setExpandedId] = useState(null)
  const [detailsCache, setDetailsCache] = useState({})
  const [detailsLoadingId, setDetailsLoadingId] = useState(null)
  const [detailsErrorById, setDetailsErrorById] = useState({})

  const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false)
  const [reopenId, setReopenId] = useState(null)

  const canReopen = useMemo(() => {
    if (user?.role === 'tenant_admin' || user?.role === 'superadmin') return true
    return Array.isArray(user?.permissions) && user.permissions.includes('closed_tables_reopen')
  }, [user?.role, (user?.permissions || []).join(',')])

  const load = async () => {
    setError('')
    try {
      if (!Array.isArray(allowedBranchIds)) {
        setSummary({ totalSales: 0, totalPaid: 0, overpayTotal: 0, count: 0 })
        setOrders([])
        return
      }
      const qs = new URLSearchParams()
      if (from) qs.set('from', from)
      if (to) qs.set('to', to)
      const { params } = buildBranchQueryParams(allowedBranchIds)
      const qBranch = params ? `&${params.toString()}` : ''
      const sum = await api(`/api/reports/summary?${qs.toString()}${qBranch}&status=closed`, { skipBranchHeader: true, suppressBranchModal: true })
      const list = await api(`/api/reports/orders?${qs.toString()}${qBranch}&status=closed`, { skipBranchHeader: true, suppressBranchModal: true })
      if (sum?.success === false || list?.success === false) return
      setSummary(sum)
      setOrders(list.orders)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    if (autoLoaded) return
    if (!Array.isArray(allowedBranchIds)) return
    Promise.resolve(load()).finally(() => setAutoLoaded(true))
  }, [autoLoaded, allowedBranchIds])

  const onSearch = async (e) => {
    e.preventDefault()
    await load()
  }

  const filteredOrders = (orders || []).filter(o => (typeFilter === 'all' ? true : String(o.saleType || '') === typeFilter))

  const toggleExpanded = async (id) => {
    const next = expandedId === id ? null : id
    setExpandedId(next)
    if (!next) return
    if (detailsCache[next]) return
    setDetailsLoadingId(next)
    setDetailsErrorById(prev => ({ ...prev, [next]: '' }))
    const res = await api(`/api/pos/orders/${next}`, { silent: true, skipBranchHeader: true, suppressBranchModal: true })
    if (!res?.ok) {
      setDetailsErrorById(prev => ({ ...prev, [next]: String(res?.message || 'Detay alınamadı') }))
      setDetailsLoadingId(null)
      return
    }
    const order = res?.order || res?.data?.order || null
    setDetailsCache(prev => ({ ...prev, [next]: order }))
    setDetailsLoadingId(null)
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className={embedded ? undefined : 'stickyTop'} style={{ display: 'grid', gap: 10, paddingBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Kapanan Masalar</h3>
        <form onSubmit={onSearch} className="reportsFilters">
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ minWidth: 160 }} />
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ minWidth: 160 }} />
          <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="all">Hepsi</option>
            <option value="table">Masa</option>
            <option value="walkin">Masasız</option>
            <option value="delivery">Paket</option>
          </select>
          <button className="btn">Filtrele</button>
        </form>
      </div>
      {error && <div style={{ color: '#ef4444' }}>{error}</div>}
      <div className="reportsSummaryRow">
        <div className="card kpi-card" style={{ flex: 1 }}>
          <div>Toplam Ciro</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{Number(summary.totalSales || 0).toFixed(2)} TL</div>
          <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
            <div>Toplam Tahsilat</div>
            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{Number(summary.totalPaid || 0).toFixed(2)} TL</div>
          </div>
          {Number(summary.overpayTotal || 0) > 0.01 && (
            <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#b91c1c' }}>
              <div>Fazla Tahsilat</div>
              <div style={{ fontWeight: 800 }}>{Number(summary.overpayTotal || 0).toFixed(2)} TL</div>
            </div>
          )}
        </div>
        <div className="card kpi-card" style={{ flex: 1 }}>
          <div>Kapalı Sipariş Sayısı</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{summary.count}</div>
        </div>
      </div>

      <div className="card onlyDesktop desktop-only reportsTableWrap">
        <table className="table" style={{ minWidth: 980 }}>
          <thead>
            <tr>
              <th>Sipariş</th>
              <th>Tür</th>
              <th>Masa</th>
              <th>Kapanış</th>
              <th style={{ textAlign: 'right' }}>Toplam</th>
              <th style={{ textAlign: 'right' }}>Ödenen</th>
              <th style={{ textAlign: 'right' }}>Kalan/Fazla</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(o => {
                const net = Number(o.netTotal || 0)
                const paid = Number(o.paidTotal || 0)
                const signed = Number(o.balanceDueSigned || (net - paid) || 0)
                const isOver = signed < -0.01
                const label = isOver ? 'Fazla' : 'Kalan'
                const value = Math.abs(signed)
                const saleType = String(o.saleType || '')
                const typeLabel = saleType === 'delivery' ? 'Paket' : saleType === 'walkin' ? 'Masasız' : 'Masa'
                const isExpanded = expandedId === o.id
                return (
                  <React.Fragment key={o.id}>
                    <tr
                      onClick={async () => {
                        await toggleExpanded(o.id)
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{o?.orderNo ? `Sipariş ${o.orderNo}` : `#${String(o.id).slice(-6)}`}</td>
                      <td>{typeLabel}</td>
                      <td>{o.tableName || '-'}</td>
                      <td>{new Date(o.closedAt || o.createdAt).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>{net.toFixed(2)} TL</td>
                      <td style={{ textAlign: 'right' }}>{paid.toFixed(2)} TL</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: isOver ? '#b91c1c' : undefined }}>
                        {label}: {value.toFixed(2)} TL
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {canReopen && (
                          <button
                            className="btn"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setReopenId(o.id)
                              setReopenConfirmOpen(true)
                            }}
                          >
                            Geri Aç
                          </button>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={8} style={{ background: 'var(--app-surface-soft, var(--app-surface))', color: 'var(--app-text)' }}>
                          <div style={{ padding: 10, display: 'grid', gap: 8 }}>
                            <div style={{ fontWeight: 800 }}>Sipariş İçeriği</div>
                            {detailsLoadingId === o.id && <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>}
                            {!!detailsErrorById[o.id] && <div style={{ color: '#b91c1c' }}>{detailsErrorById[o.id]}</div>}
                            {detailsCache[o.id] && (() => {
                              const d = detailsCache[o.id]
                              const items = Array.isArray(d?.items) ? d.items : []
                              const statusLabel = (s) => trStatusLabel(s) || '-'
                              const methodLabel = (payment) => String(payment?.methodLabel || '').trim() || trPaymentMethodLabel(payment?.method) || '-'
                              const payments = Array.isArray(d?.payments) ? d.payments : []
                              const netTotal = Number(d?.netTotal ?? d?.totals?.grandTotal ?? 0)
                              const paidTotal = Number(d?.paidTotal ?? 0)
                              const over = Math.max(0, paidTotal - netTotal)
                              const paymentParts = payments.map(p => `${Number(p?.amount || 0).toFixed(2)} TL ${methodLabel(p)}`)
                              if (String(d?.settlementType || '') === 'veresiye' && Number(d?.veresiyeAmount || 0) > 0) {
                                paymentParts.push(`${Number(d.veresiyeAmount || 0).toFixed(2)} TL Veresiye`)
                              }
                              return (
                                <>
                                  <div style={{ display: 'grid', gap: 6 }}>
                                    {items.length === 0 && <div style={{ color: 'var(--muted)' }}>Ürün yok</div>}
                                    {items.map((it) => (
                                      <div key={it._id || `${it.menuItemId}-${it.nameSnapshot}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                        <div style={{ minWidth: 0 }}>
                                          <span style={{ fontWeight: 700 }}>{Number(it.qty || 0)}x {it.nameSnapshot}</span>
                                          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>({statusLabel(it.status)})</span>
                                        </div>
                                        <div style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{Number(it.subtotal || (Number(it.priceSnapshot || 0) * Number(it.qty || 0)) || 0).toFixed(2)} TL</div>
                                      </div>
                                    ))}
                                  </div>
                                  {Number(d?.discountPercent || 0) > 0 && (
                                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>İndirim: %{Number(d.discountPercent || 0)}</div>
                                  )}
                                  {!!String(d?.note || '').trim() && (
                                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not: {String(d.note || '').trim()}</div>
                                  )}
                                  {paymentParts.length > 0 && (
                                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ödemeler: {paymentParts.join(', ')}</div>
                                  )}
                                  {over > 0.01 && (
                                    <div style={{ fontSize: 12, color: '#b91c1c' }}>Fazla: {over.toFixed(2)} TL</div>
                                  )}
                                </>
                              )
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
          </tbody>
        </table>
      </div>

      <div className="card onlyMobile mobile-only">
        <div className="reportsCards">
          {filteredOrders.map(o => {
            const net = Number(o.netTotal || 0)
            const paid = Number(o.paidTotal || 0)
            const signed = Number(o.balanceDueSigned || (net - paid) || 0)
            const isOver = signed < -0.01
            const label = isOver ? 'Fazla' : 'Kalan'
            const value = Math.abs(signed)
            const saleType = String(o.saleType || '')
            const typeLabel = saleType === 'delivery' ? 'Paket' : saleType === 'walkin' ? 'Masasız' : 'Masa'
            const isExpanded = expandedId === o.id
            return (
              <div
                key={o.id}
                style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--app-surface, var(--panel))' }}
                onClick={async () => {
                  await toggleExpanded(o.id)
                }}
                role="button"
                tabIndex={0}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{o?.orderNo ? `Sipariş ${o.orderNo}` : `#${String(o.id).slice(-6)}`}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{typeLabel}{o.tableName ? ` • ${o.tableName}` : ''}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(o.closedAt || o.createdAt).toLocaleString()}</div>
                  </div>
                  {canReopen && (
                    <button
                      className="btn btn--compact"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setReopenId(o.id)
                        setReopenConfirmOpen(true)
                      }}
                    >
                      Geri Aç
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Toplam</div>
                    <div style={{ fontWeight: 800 }}>{net.toFixed(2)} TL</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ödenen</div>
                    <div style={{ fontWeight: 800 }}>{paid.toFixed(2)} TL</div>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontWeight: 800, color: isOver ? '#b91c1c' : undefined }}>
                  {label}: {value.toFixed(2)} TL
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Sipariş İçeriği</div>
                    {detailsLoadingId === o.id && <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>}
                    {!!detailsErrorById[o.id] && <div style={{ color: '#b91c1c' }}>{detailsErrorById[o.id]}</div>}
                    {detailsCache[o.id] && (() => {
                      const d = detailsCache[o.id]
                      const items = Array.isArray(d?.items) ? d.items : []
                      const statusLabel = (s) => {
                        const v = String(s || '')
                        if (v === 'cancelled') return 'İptal'
                        if (v === 'completed') return 'Hazır'
                        if (v === 'sent') return 'Hazırlanıyor'
                        if (v === 'open') return 'Açık'
                        return v || '-'
                      }
                      const methodLabel = (payment) => {
                        const custom = String(payment?.methodLabel || '').trim()
                        if (custom) return custom
                        const v = String(payment?.method || '')
                        if (v === 'cash') return 'cash'
                        if (v === 'card' || v === 'pos' || v === 'other') return 'pos'
                        if (v === 'transfer' || v === 'bank') return 'bank'
                        if (v === 'account' || v === 'veresiye') return 'account'
                        return v || 'pos'
                      }
                      const payments = Array.isArray(d?.payments) ? d.payments : []
                      const netTotal = Number(d?.netTotal ?? d?.totals?.grandTotal ?? 0)
                      const paidTotal = Number(d?.paidTotal ?? 0)
                      const over = Math.max(0, paidTotal - netTotal)
                      const paymentParts = payments.map(p => `${Number(p?.amount || 0).toFixed(2)} TL ${methodLabel(p)}`)
                      if (String(d?.settlementType || '') === 'veresiye' && Number(d?.veresiyeAmount || 0) > 0) {
                        paymentParts.push(`${Number(d.veresiyeAmount || 0).toFixed(2)} TL account`)
                      }
                      return (
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={{ display: 'grid', gap: 6 }}>
                            {items.length === 0 && <div style={{ color: 'var(--muted)' }}>Ürün yok</div>}
                            {items.map((it) => (
                              <div key={it._id || `${it.menuItemId}-${it.nameSnapshot}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                <div style={{ minWidth: 0 }}>
                                  <span style={{ fontWeight: 700 }}>{Number(it.qty || 0)}x {it.nameSnapshot}</span>
                                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>({statusLabel(it.status)})</span>
                                </div>
                                <div style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{Number(it.subtotal || (Number(it.priceSnapshot || 0) * Number(it.qty || 0)) || 0).toFixed(2)} TL</div>
                              </div>
                            ))}
                          </div>
                          {Number(d?.discountPercent || 0) > 0 && (
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>İndirim: %{Number(d.discountPercent || 0)}</div>
                          )}
                          {!!String(d?.note || '').trim() && (
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not: {String(d.note || '').trim()}</div>
                          )}
                          {paymentParts.length > 0 && (
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ödemeler: {paymentParts.join(', ')}</div>
                          )}
                          {over > 0.01 && (
                            <div style={{ fontSize: 12, color: '#b91c1c' }}>Fazla: {over.toFixed(2)} TL</div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
          {filteredOrders.length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
        </div>
      </div>

      <ConfirmModal
        open={reopenConfirmOpen}
        onClose={() => { setReopenConfirmOpen(false); setReopenId(null) }}
        title="Siparişi geri açmak istiyor musunuz?"
        confirmText="Evet"
        cancelText="Vazgeç"
        onConfirm={async () => {
          const id = reopenId
          setReopenConfirmOpen(false)
          setReopenId(null)
          if (!id) return
          const res = await api(`/api/pos/orders/${id}/reopen`, { method: 'PUT', silent: true })
          if (!res?.ok) {
            toast.error(res?.message || 'Geri açma başarısız')
            return
          }
          toast.success('Sipariş geri açıldı')
          setOrders(prev => (prev || []).filter(x => x.id !== id))
          setSummary(prev => ({ ...prev, count: Math.max(0, Number(prev.count || 0) - 1) }))
        }}
      />
    </div>
  )
}

export default function ReportsSales() {
  return <ReportsSalesContent />
}
