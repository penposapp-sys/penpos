import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import { buildBranchQueryParams } from '../../lib/branchQuery.js'
import BranchFilterCard from '../../components/BranchFilterCard.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'

const STORAGE_KEY = 'canteen_completed_sales_branches'
const CASHIER_CART_STORAGE_KEY = 'canteen_cashier_cart_v1'

const money = (value) => Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDateTime = (value) => {
  const d = new Date(value || Date.now())
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const statusMeta = (status) => {
  const key = String(status || 'completed').toLowerCase()
  if (key === 'cancelled') return { label: 'İptal', bg: '#fee2e2', fg: '#991b1b' }
  if (key === 'reopened') return { label: 'Geri Açıldı', bg: '#dcfce7', fg: '#166534' }
  return { label: 'Tamamlandı', bg: 'color-mix(in srgb, var(--theme-accent-soft, #dbeafe) 78%, white)', fg: 'var(--theme-accent-text, #1d4ed8)' }
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
      <span style={{ minWidth: 0, color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 13, fontWeight: 700 }}>{label}</span>
      <span style={{ minWidth: 0, color: 'var(--app-text, var(--text))', fontSize: 13, fontWeight: 900, textAlign: 'right', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function SaleDetailModal({ sale, open, onClose, onCancel, onReopen, loading, isCompact = false }) {
  const status = statusMeta(sale?.status)
  const items = Array.isArray(sale?.items) ? sale.items : []
  const isCreditSale = ['account', 'credit'].includes(String(sale?.payment?.methodType || sale?.paymentMethodType || '').trim().toLowerCase()) ||
    ['account', 'credit', 'veresiye', 'cari'].includes(String(sale?.payment?.method || sale?.paymentMethod || '').trim().toLowerCase())

  return (
    <Modal open={open} onClose={onClose} title={sale?.saleNo ? `Satış Detayı ${sale.saleNo}` : 'Satış Detayı'} dialogStyle={{ width: isCompact ? 'calc(100% - 4px)' : 'min(760px, calc(100vw - 24px))', maxWidth: '100%', maxHeight: isCompact ? 'calc(100dvh - 4px)' : 'calc(100dvh - 24px)', justifySelf: 'center' }} bodyStyle={{ padding: isCompact ? 2 : 22 }}>
      {!sale ? (
        <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))' }}>Detay yükleniyor...</div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ borderRadius: 999, padding: '6px 12px', background: status.bg, color: status.fg, fontSize: 12, fontWeight: 900 }}>{status.label}</span>
            <span style={{ borderRadius: 999, padding: '6px 12px', background: 'var(--app-surface-soft, var(--panelElevated))', color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 12, fontWeight: 800 }}>
              {sale.branchName || '-'}
            </span>
            <span style={{ borderRadius: 999, padding: '6px 12px', background: 'var(--app-surface-soft, var(--panelElevated))', color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 12, fontWeight: 800 }}>
              {sale.cashierName || '-'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ border: '1px solid var(--app-border, var(--border))', borderRadius: 18, padding: 14, background: 'var(--app-surface, var(--card-bg))' }}>
              <DetailRow label="Satış No" value={sale.saleNo || '-'} />
              <DetailRow label="Tarih" value={fmtDateTime(sale.createdAt)} />
              <DetailRow label="Ödeme" value={sale.paymentType || '-'} />
            </div>
            <div style={{ border: '1px solid var(--app-border, var(--border))', borderRadius: 18, padding: 14, background: 'var(--app-surface, var(--card-bg))' }}>
              <DetailRow label="Ara Toplam" value={`${money(sale.subTotal || 0)} TL`} />
              <DetailRow label="İndirim" value={`${money(sale.discountTotal || 0)} TL`} />
              <DetailRow label="Toplam" value={`${money(sale.total || 0)} TL`} />
            </div>
          </div>

          {sale.note ? (
            <div style={{ border: '1px solid var(--app-border, var(--border))', borderRadius: 16, padding: 14, background: 'var(--app-surface-soft, var(--panelElevated))', color: 'var(--app-text, var(--text))' }}>
              <b>Not:</b> {sale.note}
            </div>
          ) : null}

          <div style={{ border: '1px solid var(--app-border, var(--border))', borderRadius: 18, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 440, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '38%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '24%' }} />
                </colgroup>
              <thead>
                <tr style={{ background: 'var(--app-surface-soft, var(--panelElevated))' }}>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12 }}>Ürün</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12 }}>Adet</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12 }}>Birim</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12 }}>Tutar</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 14, color: 'var(--app-text-secondary, var(--text-secondary))' }}>Ürün bilgisi bulunamadı.</td>
                  </tr>
                ) : items.map((item, index) => (
                  <tr key={`${item.productId || item.name || index}`}>
                    <td style={{ padding: '10px 14px', borderTop: '1px solid var(--app-border, var(--border))', fontWeight: 800, overflowWrap: 'anywhere' }}>{item.name || '-'}</td>
                    <td style={{ padding: '10px 14px', borderTop: '1px solid var(--app-border, var(--border))', textAlign: 'right', whiteSpace: 'nowrap' }}>{Number(item.qty || 0)}</td>
                    <td style={{ padding: '10px 14px', borderTop: '1px solid var(--app-border, var(--border))', textAlign: 'right', whiteSpace: 'nowrap' }}>{money(item.unitPrice || 0)} TL</td>
                    <td style={{ padding: '10px 14px', borderTop: '1px solid var(--app-border, var(--border))', textAlign: 'right', fontWeight: 900, whiteSpace: 'nowrap' }}>{money(item.lineTotal || 0)} TL</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--app-text-secondary, var(--text-secondary))' }}>
              <div>Sube: <b>{sale.branchName || '-'}</b></div>
              <div>Personel: <b>{sale.cashierName || '-'}</b></div>
              {isCreditSale ? <div>Veresiye satisi yapilan cari: <b>{sale.customerName || '-'}</b></div> : null}
              <div>Ödeme yöntemi: <b>{sale.payment?.methodName || sale.payment?.method || '-'}</b></div>
              <div>Ödeme tutarı: <b>{money(sale.payment?.amount || sale.total || 0)} TL</b></div>
              {sale.payment?.note ? <div>Ödeme notu: <b>{sale.payment.note}</b></div> : null}
              {sale.cancelReason ? <div>İptal nedeni: <b>{sale.cancelReason}</b></div> : null}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" className="btn" onClick={onReopen} disabled={loading}>Geri Aç</button>
              <button type="button" className="btn btn--danger" onClick={onCancel} disabled={loading}>Sil / İptal Et</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function CanteenSalesPage() {
  const { me, session } = useOutletContext()
  const navigate = useNavigate()
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const isCompact = isMobilePortrait || isTablet

  const canView = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && (me.permissions.includes('canteen_sales_view') || me.permissions.includes('canteen_reports_view')))

  const [branchOptions, setBranchOptions] = useState([])
  const [selectedBranchIds, setSelectedBranchIds] = useState([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [loading, setLoading] = useState(false)
  const [savingAction, setSavingAction] = useState(false)
  const [error, setError] = useState('')
  const [sales, setSales] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailSale, setDetailSale] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false)
  const [actionTarget, setActionTarget] = useState(null)

  const allowedBranchIds = useMemo(
    () => Array.isArray(session?.allowedBranchIds) ? session.allowedBranchIds.map(String).filter(Boolean) : [],
    [session?.allowedBranchIds]
  )

  useEffect(() => {
    let cancelled = false
    const loadBranches = async () => {
      const sessionBranches = (Array.isArray(session?.allowedBranches) ? session.allowedBranches : [])
        .map((branch) => ({ id: String(branch?.id || branch?._id || ''), name: String(branch?.name || '') }))
        .filter((branch) => branch.id && branch.name)
      if (sessionBranches.length > 0) {
        if (!cancelled) setBranchOptions(sessionBranches)
        return
      }
      if (allowedBranchIds.length === 0) return
      setLoadingBranches(true)
      try {
        const res = await api('/api/canteen/branches', { silent: true, skipBranchHeader: true, portalOverride: 'canteen' })
        if (cancelled || !res?.ok) return
        const list = (Array.isArray(res?.branches) ? res.branches : [])
          .map((branch) => ({ id: String(branch?.id || branch?._id || ''), name: String(branch?.name || '') }))
          .filter((branch) => branch.id && branch.name)
        if (!cancelled) setBranchOptions(list)
      } finally {
        if (!cancelled) setLoadingBranches(false)
      }
    }
    loadBranches()
    return () => { cancelled = true }
  }, [allowedBranchIds, session?.allowedBranches])

  useEffect(() => {
    if (branchOptions.length === 0) {
      setSelectedBranchIds([])
      return
    }
    let stored = []
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      stored = Array.isArray(stored) ? stored.map((value) => String(value || '').trim()).filter(Boolean) : []
    } catch {
      stored = []
    }
    const ids = branchOptions.map((branch) => branch.id)
    const validStored = stored.filter((id) => ids.includes(id))
    if (validStored.length > 0) {
      setSelectedBranchIds(validStored)
      return
    }
    setSelectedBranchIds(ids)
  }, [branchOptions])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedBranchIds)) } catch {}
    setPage(1)
  }, [selectedBranchIds])

  const branchQuery = useMemo(() => buildBranchQueryParams(selectedBranchIds), [selectedBranchIds])

  const listParams = useMemo(() => {
    const params = new URLSearchParams()
    if (branchQuery.params) {
      for (const [k, v] of branchQuery.params.entries()) params.set(k, v)
    }
    params.set('page', String(page))
    params.set('limit', '20')
    return params
  }, [branchQuery.params, page])

  const loadSales = async () => {
    if (branchOptions.length === 0) return
    setLoading(true)
    setError('')
    try {
      const res = await api(`/api/canteen/sales/completed?${listParams.toString()}`, {
        silent: true,
        skipBranchHeader: true,
        suppressBranchModal: true,
        portalOverride: 'canteen'
      })
      if (!res?.ok) {
        setSales([])
        setTotal(0)
        setPages(1)
        setError(String(res?.message || 'Satışlar alınamadı'))
        return
      }
      setSales(Array.isArray(res?.items) ? res.items : [])
      setTotal(Number(res?.total || 0))
      setPages(Math.max(1, Number(res?.pages || 1)))
    } catch (err) {
      setSales([])
      setTotal(0)
      setPages(1)
      setError(String(err?.message || 'Satışlar alınamadı'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSales()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listParams.toString(), branchOptions.length])

  const openDetail = async (sale) => {
    if (!sale?.id) return
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailSale(sale)
    setDetailError('')
    try {
      const params = new URLSearchParams()
      if (sale.branchId) params.set('branchId', sale.branchId)
      const res = await api(`/api/canteen/sales/${sale.id}${params.toString() ? `?${params.toString()}` : ''}`, {
        silent: true,
        skipBranchHeader: true,
        suppressBranchModal: true,
        portalOverride: 'canteen'
      })
      if (!res?.ok) {
        setDetailError(String(res?.message || 'Detay alınamadı'))
        return
      }
      setDetailSale(res.sale || res)
    } catch (err) {
      setDetailError(String(err?.message || 'Detay alınamadı'))
    } finally {
      setDetailLoading(false)
    }
  }

  const refreshAfterAction = async () => {
    await loadSales()
    if (detailSale?.id) {
      const branchId = detailSale.branchId
      const params = new URLSearchParams()
      if (branchId) params.set('branchId', branchId)
      const res = await api(`/api/canteen/sales/${detailSale.id}${params.toString() ? `?${params.toString()}` : ''}`, {
        silent: true,
        skipBranchHeader: true,
        suppressBranchModal: true,
        portalOverride: 'canteen'
      })
      if (res?.ok) setDetailSale(res.sale || res)
    }
  }

  const requestCancel = (sale) => {
    setActionTarget(sale)
    setCancelConfirmOpen(true)
  }

  const requestReopen = (sale) => {
    setActionTarget(sale)
    setReopenConfirmOpen(true)
  }

  const doCancel = async () => {
    if (!actionTarget?.id) return
    setSavingAction(true)
    try {
      const params = new URLSearchParams()
      if (actionTarget.branchId) params.set('branchId', actionTarget.branchId)
      const res = await api(`/api/canteen/sales/${actionTarget.id}${params.toString() ? `?${params.toString()}` : ''}`, {
        method: 'DELETE',
        silent: true,
        skipBranchHeader: true,
        suppressBranchModal: true,
        portalOverride: 'canteen'
      })
      if (!res?.ok) throw new Error(String(res?.message || 'İptal edilemedi'))
      setCancelConfirmOpen(false)
      await refreshAfterAction()
    } catch (err) {
      setError(String(err?.message || 'İptal edilemedi'))
    } finally {
      setSavingAction(false)
    }
  }

  const doReopen = async () => {
    if (!actionTarget?.id) return
    setSavingAction(true)
    try {
      const params = new URLSearchParams()
      if (actionTarget.branchId) params.set('branchId', actionTarget.branchId)
      const res = await api(`/api/canteen/sales/${actionTarget.id}/reopen${params.toString() ? `?${params.toString()}` : ''}`, {
        method: 'POST',
        silent: true,
        skipBranchHeader: true,
        suppressBranchModal: true,
        portalOverride: 'canteen'
      })
      if (!res?.success && !res?.ok) throw new Error(String(res?.message || 'Geri açılamadı'))
      try {
        const branchId = String(actionTarget?.branchId || detailSale?.branchId || '').trim()
        const saleSource = detailSale?.id === actionTarget?.id ? detailSale : actionTarget
        const items = Array.isArray(saleSource?.items) ? saleSource.items : []
        const restoredCart = items
          .map((item) => {
            const productId = String(item?.productId || '').trim()
            const qty = Math.max(1, Number(item?.qty || 0))
            if (!productId || qty <= 0) return null
            return {
              productId,
              name: String(item?.name || item?.productName || ''),
              barcode: String(item?.barcode || ''),
              unitPrice: Number(item?.unitPrice || 0),
              qty,
              productBranchId: branchId || String(item?.productBranchId || '')
            }
          })
          .filter(Boolean)

        if (branchId) {
          localStorage.setItem('selectedBranchId_canteen', branchId)
          const raw = localStorage.getItem(CASHIER_CART_STORAGE_KEY)
          const parsed = raw ? JSON.parse(raw) : {}
          const next = parsed && typeof parsed === 'object' ? parsed : {}
          next[branchId] = restoredCart
          localStorage.setItem(CASHIER_CART_STORAGE_KEY, JSON.stringify(next))
          try { window.dispatchEvent(new CustomEvent('canteen_branch_changed', { detail: { branchId } })) } catch {}
        }
      } catch {}
      setReopenConfirmOpen(false)
      setDetailOpen(false)
      await refreshAfterAction()
      navigate('/canteen/kasa')
    } catch (err) {
      setError(String(err?.message || 'Geri açılamadı'))
    } finally {
      setSavingAction(false)
    }
  }

  if (!canView) return <div className="card">403 - Bu sayfaya yetkin yok</div>

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ borderRadius: 28, border: '1px solid var(--app-border, var(--border))', background: 'var(--app-surface, var(--card-bg))', padding: 20, boxShadow: 'var(--card-shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 950, color: 'var(--app-text, var(--text))' }}>Yapılan Satışlar</div>
            <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: 'var(--app-text-secondary, var(--text-secondary))' }}>
              Tamamlanan satışları inceleyin, detayını açın veya gerekirse geri açın.
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--app-text-secondary, var(--text-secondary))' }}>
            Toplam {total} satış
          </div>
        </div>
      </div>

      {loadingBranches ? <div className="card">Şube listesi hazırlanıyor...</div> : null}

      <div style={{ display: 'grid', gap: 14 }}>
        <BranchFilterCard
          branchOptions={branchOptions}
          selectedBranches={selectedBranchIds}
          setSelectedBranches={setSelectedBranchIds}
          title="Şube Seç"
          compact={isCompact}
          hideSummary
        />

        <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr auto', gap: 10, alignItems: 'end' }}>
          <button type="button" className="btn" onClick={() => { setPage(1); loadSales() }} disabled={loading} style={{ height: 44, fontWeight: 900 }}>Yenile</button>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--app-text-secondary, var(--text-secondary))', justifySelf: isCompact ? 'start' : 'end', alignSelf: 'center' }}>
            Sayfa {page} / {pages}
          </div>
        </div>
      </div>

      {!!error ? <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#7f1d1d' }}>{error}</div> : null}

      {loading ? <div className="card">Satışlar yükleniyor...</div> : null}

      {!loading && sales.length === 0 ? (
        <div className="card">Tamamlanan satış bulunamadı.</div>
      ) : null}

      {!loading && sales.length > 0 && !isCompact ? (
        <div style={{ border: '1px solid var(--app-border, var(--border))', borderRadius: 24, overflow: 'hidden', background: 'var(--app-surface, var(--card-bg))', boxShadow: 'var(--card-shadow)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--app-surface-soft, var(--panelElevated))' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12 }}>Tarih / Saat</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12 }}>Satış No</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12 }}>Şube</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12 }}>Kasiyer</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12 }}>Toplam</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12 }}>Ödeme</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12 }}>Adet</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12 }}>Durum</th>
                <th style={{ textAlign: 'right', padding: '12px 14px', fontSize: 12 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const meta = statusMeta(sale.status)
                return (
                  <tr key={sale.id} style={{ borderTop: '1px solid var(--app-border, var(--border))' }}>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>{fmtDateTime(sale.createdAt)}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 900 }}>{sale.saleNo || '-'}</td>
                    <td style={{ padding: '12px 14px' }}>{sale.branchName || '-'}</td>
                    <td style={{ padding: '12px 14px' }}>{sale.cashierName || '-'}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900 }}>{money(sale.total || 0)} TL</td>
                    <td style={{ padding: '12px 14px' }}>{sale.paymentType || '-'}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>{Number(sale.itemCount || 0)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ borderRadius: 999, padding: '6px 10px', background: meta.bg, color: meta.fg, fontSize: 12, fontWeight: 900 }}>{meta.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn" onClick={() => openDetail(sale)} style={{ marginRight: 8 }}>Detay Gör</button>
                      <button type="button" className="btn" onClick={() => requestReopen(sale)} style={{ marginRight: 8 }}>Geri Aç</button>
                      <button type="button" className="btn btn--danger" onClick={() => requestCancel(sale)}>İptal</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && sales.length > 0 && isCompact ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {sales.map((sale) => {
            const meta = statusMeta(sale.status)
            return (
              <button
                key={sale.id}
                type="button"
                onClick={() => openDetail(sale)}
                style={{
                  border: '1px solid var(--app-border, var(--border))',
                  borderRadius: 22,
                  background: 'var(--app-surface, var(--card-bg))',
                  color: 'var(--app-text, var(--text))',
                  padding: 14,
                  textAlign: 'left',
                  display: 'grid',
                  gap: 10,
                  cursor: 'pointer',
                  boxShadow: 'var(--card-shadow)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 950 }}>{sale.saleNo || '-'}</div>
                  <span style={{ borderRadius: 999, padding: '6px 10px', background: meta.bg, color: meta.fg, fontSize: 12, fontWeight: 900 }}>{meta.label}</span>
                </div>
                <div style={{ color: 'var(--app-text-secondary, var(--text-secondary))', fontSize: 12 }}>{fmtDateTime(sale.createdAt)}</div>
                <div style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>
                  <div>Şube: {sale.branchName || '-'}</div>
                  <div>Kasiyer: {sale.cashierName || '-'}</div>
                  <div>Ödeme: {sale.paymentType || '-'}</div>
                  <div>Adet: {Number(sale.itemCount || 0)} • Tutar: {money(sale.total || 0)} TL</div>
                </div>
              </button>
            )
          })}
        </div>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading}>Önceki</button>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--app-text-secondary, var(--text-secondary))' }}>Sayfa {page} / {pages}</div>
        <button type="button" className="btn" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages || loading}>Sonraki</button>
      </div>

      <SaleDetailModal
        sale={detailSale}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailSale(null); setDetailError('') }}
        onCancel={() => {
          setActionTarget(detailSale)
          setCancelConfirmOpen(true)
        }}
        onReopen={() => {
          setActionTarget(detailSale)
          setReopenConfirmOpen(true)
        }}
        loading={detailLoading || savingAction}
        isCompact={isCompact}
      />

      {detailError ? (
        <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#7f1d1d' }}>
          {detailError}
        </div>
      ) : null}

      <ConfirmModal
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        title="Satışı İptal Et?"
        description="Bu satış iptal edilecek/silinecek, emin misiniz?"
        confirmText="Evet, İptal Et"
        danger
        onConfirm={doCancel}
        confirmDisabled={savingAction}
      />

      <ConfirmModal
        open={reopenConfirmOpen}
        onClose={() => setReopenConfirmOpen(false)}
        title="Satışı Geri Aç?"
        description="Bu satış geri açılacak, emin misiniz?"
        confirmText="Evet, Geri Aç"
        onConfirm={doReopen}
        confirmDisabled={savingAction}
      />
    </div>
  )
}
