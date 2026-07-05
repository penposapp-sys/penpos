import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import { downloadBlob } from '../../lib/download.js'
import { toast } from '../../lib/toast.js'
import Modal from '../../components/Modal.jsx'
import CanteenBranchSelector from '../components/CanteenBranchSelector.jsx'
import useScannerCapture from '../hooks/useScannerCapture.js'
import { stockActionLabel, stockNoteLabel, stockSourceLabel } from '../utils/stockLabels.js'
import { getSaleDetail, getStockCountDetail, getStockCounts } from '../lib/api.js'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'

const money = (n) => {
  const v = Number(n || 0)
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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

const isSaleMovement = (note) => String(note || '').trim().toLowerCase().startsWith('sale:')
const isSaleRelatedMovement = (note) => {
  const normalized = String(note || '').trim().toLowerCase()
  return normalized.startsWith('sale:') || normalized.startsWith('sale_cancel:')
}
const isStockCountMovement = (note) => String(note || '').trim().toLowerCase().startsWith('stock_count:')
const dateKeyFromValue = (value) => {
  const d = new Date(value || Date.now())
  if (Number.isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const dateLabelFromKey = (key) => {
  const [year, month, day] = String(key || '').split('-')
  if (!year || !month || !day) return '-'
  return `${day}.${month}.${year}`
}

const getCountSystemQty = (item) => {
  if (item?.stockQty !== null && item?.stockQty !== undefined) return Number(item.stockQty || 0)
  if (item?.systemQty !== null && item?.systemQty !== undefined) return Number(item.systemQty || 0)
  if (item?.currentStockAtStart !== null && item?.currentStockAtStart !== undefined) return Number(item.currentStockAtStart || 0)
  return 0
}

const mapCountSummaryItems = (items) => (
  (Array.isArray(items) ? items : []).map((x) => ({
    itemId: String(x.itemId || ''),
    productId: String(x.productId || ''),
    barcode: String(x.barcode || ''),
    name: String(x.productName || x.name || ''),
    countedQty: Number(x.countedQty || 0),
    stockQty: getCountSystemQty(x),
    diff: Number(x.diff ?? ((Number(x.countedQty || 0) - getCountSystemQty(x)) || 0)),
    saving: false,
    savedAt: null
  }))
)

const getCountStatusMeta = (status, summary) => {
  const totalDiff = Number(summary?.session?.totalDiff ?? summary?.totalDiff ?? 0)
  if (status === 'finished') {
    return {
      text: 'Sayım bitirildi',
      tone: '#fff7a8',
      color: '#b45309',
      detail: totalDiff === 0 ? 'Fark yok' : `Toplam fark: ${totalDiff > 0 ? `+${totalDiff}` : totalDiff}`
    }
  }
  if (status === 'open') {
    return {
      text: 'Sayım devam ediyor',
      tone: '#dcfce7',
      color: '#166534',
      detail: 'Barkod okutmaya hazır'
    }
  }
  return {
    text: 'Sayım başlatılmadı',
    tone: '#f3f4f6',
    color: '#4b5563',
    detail: 'Başlatınca ürün saymaya başlayabilirsin'
  }
}

const getCountDiffColor = (diff) => {
  const n = Number(diff || 0)
  if (n > 0) return '#1300d8'
  if (n < 0) return '#ff1414'
  return '#15803d'
}

export function CanteenStockWorkspace({
  me,
  controlledBranchId = null,
  showBranchSelector = true,
  embedded = false,
  onCreateProduct = null,
  onEditProduct = null,
  onDeleteProduct = null,
  onOpenCategories = null,
  refreshToken = 0
}) {
  const STOCK_CONTENT_HIDDEN = false
  const { isMobilePortrait, isTablet } = useResponsiveFlags()
  const isAdmin = me?.role === 'tenant_admin'
  const perms = Array.isArray(me?.permissions) ? me.permissions : []
  const canStock = isAdmin || perms.includes('canteen_stock_manage') || perms.includes('canteen_stock_count') || perms.includes('canteen_settings_manage')

  const [tab, setTab] = useState('movements')
  const [branchId, setBranchId] = useState(() => {
    if (controlledBranchId !== null && controlledBranchId !== undefined) {
      return String(controlledBranchId || '')
    }
    try {
      return String(localStorage.getItem('selectedBranchId_canteen') || '')
    } catch {
      return ''
    }
  })

  useEffect(() => {
    if (controlledBranchId === null || controlledBranchId === undefined) return
    setBranchId(String(controlledBranchId || ''))
  }, [controlledBranchId])

  useEffect(() => {
    if (controlledBranchId !== null && controlledBranchId !== undefined) return undefined
    const handler = (e) => setBranchId(String(e?.detail?.branchId || ''))
    window.addEventListener('canteen_branch_changed', handler)
    return () => window.removeEventListener('canteen_branch_changed', handler)
  }, [controlledBranchId])

  const movementOnScanRef = useRef(null)
  const receiptOnScanRef = useRef(null)
  const countOnScanRef = useRef(null)
  const [countModalOpen, setCountModalOpen] = useState(false)
  const isCompact = isMobilePortrait || isTablet

  useScannerCapture({
    enabled: true,
    minLen: 8,
    maxLen: 32,
    idleMs: 110,
    burstDeltaMs: 50,
    humanDeltaMs: 70,
    onScan: (code) => {
      if (tab === 'movements') movementOnScanRef.current?.(code)
      else if (tab === 'receipts') receiptOnScanRef.current?.(code)
      else if (tab === 'count') countOnScanRef.current?.(code)
    }
  })

  if (!canStock) return <div className="card">403 – Bu sayfaya yetkin yok</div>

  return (
    <div className={`canteen-stock-page${embedded ? ' canteen-stock-page--embedded' : ''}${isMobilePortrait ? ' is-mobile-shell' : ''}`} style={{ display: 'grid', gap: isMobilePortrait ? 8 : 12 }}>
      <style>{`
        .canteen-stock-page {
          --legacy-bg: #dfe6ec;
          --legacy-panel: #f2f2f2;
          --legacy-line: #9ca3af;
          --legacy-line-strong: #7c8796;
          --legacy-title: #0b35ff;
          --legacy-orange: #ff8700;
          --legacy-yellow: #fff7a8;
          --legacy-green: #c9ffc7;
          --legacy-header: #d4d2ff;
          --legacy-red: #ff1414;
          --legacy-blue: #1300d8;
        }
        .canteen-stock-page:not(.canteen-stock-page--embedded) .card {
          background: var(--legacy-panel) !important;
          border: 1px solid var(--legacy-line-strong) !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        .canteen-stock-page--embedded .card {
          background: var(--app-surface, var(--panel)) !important;
          border: 1px solid var(--app-border, var(--border)) !important;
          border-radius: 18px !important;
          box-shadow: none !important;
        }
        .canteen-stock-page:not(.canteen-stock-page--embedded) .input,
        .canteen-stock-page:not(.canteen-stock-page--embedded) input,
        .canteen-stock-page:not(.canteen-stock-page--embedded) select,
        .canteen-stock-page:not(.canteen-stock-page--embedded) textarea {
          border-radius: 0 !important;
          border: 1px solid var(--legacy-line-strong) !important;
          background: #fff !important;
          min-height: 32px;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.08);
        }
        .canteen-stock-page--embedded .input,
        .canteen-stock-page--embedded input,
        .canteen-stock-page--embedded select,
        .canteen-stock-page--embedded textarea {
          border-radius: 14px !important;
          border: 1px solid var(--app-border, var(--border)) !important;
          background: var(--app-surface-soft, rgba(255,255,255,0.74)) !important;
          min-height: 42px;
          box-shadow: none !important;
        }
        .canteen-stock-page:not(.canteen-stock-page--embedded) .btn {
          border-radius: 0 !important;
          border: 1px solid var(--legacy-line-strong) !important;
          background: linear-gradient(180deg, #fafafa 0%, #e4e4e4 100%) !important;
          color: #111 !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.9);
          min-height: 40px;
        }
        .canteen-stock-page--embedded .btn {
          border-radius: 14px !important;
          border: 1px solid var(--app-border, var(--border)) !important;
          background: var(--app-surface-soft, rgba(255,255,255,0.74)) !important;
          color: var(--app-text, var(--text)) !important;
          box-shadow: none !important;
          min-height: 42px;
        }
        .canteen-stock-page:not(.canteen-stock-page--embedded) .btn[aria-pressed="true"],
        .canteen-stock-page:not(.canteen-stock-page--embedded) .btn.btn--primary {
          background: linear-gradient(180deg, #e7eefc 0%, #c9d7fb 100%) !important;
          color: #001d9a !important;
          font-weight: 900;
        }
        .canteen-stock-page--embedded .btn[aria-pressed="true"],
        .canteen-stock-page--embedded .btn.btn--primary {
          background: color-mix(in srgb, var(--theme-accent, #2563eb) 14%, var(--app-surface, #fff)) !important;
          border-color: color-mix(in srgb, var(--theme-accent, #2563eb) 34%, var(--app-border, #d0d7e2)) !important;
          color: var(--app-text, var(--text)) !important;
          font-weight: 800;
        }
        .canteen-legacy-shell {
          display: grid;
          gap: 10px;
          padding: 10px;
          background: var(--legacy-bg);
          border: 1px solid #7b8aa0;
          min-width: 0;
          width: 100%;
          overflow-x: hidden;
        }
        .canteen-stock-page--embedded .canteen-legacy-shell {
          padding: 0;
          background: transparent;
          border: 0;
        }
        .canteen-stock-page--embedded.is-mobile-shell .canteen-legacy-shell {
          gap: 1px;
        }
        .canteen-legacy-window-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 4px 8px 8px;
          color: #1f2937;
          font-weight: 700;
        }
        .canteen-legacy-window-title span:last-child {
          letter-spacing: 4px;
          font-weight: 900;
        }
        .canteen-legacy-toolbar {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .canteen-legacy-panel {
          display: grid;
          gap: 12px;
          padding: 10px;
          border: 1px solid var(--legacy-line);
          background: #efefef;
          min-width: 0;
          width: 100%;
        }
        .canteen-stock-page--embedded .canteen-legacy-panel {
          padding: 18px;
          border: 1px solid var(--app-border, var(--border));
          border-radius: 18px;
          background: var(--app-surface, var(--panel));
        }
        .canteen-stock-page--embedded.is-mobile-shell .canteen-legacy-panel {
          padding: 10px;
          border-radius: 14px;
          gap: 10px;
        }
        .canteen-legacy-top-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(220px, 0.78fr);
          gap: 10px;
          align-items: start;
          min-width: 0;
        }
        .canteen-legacy-form-grid {
          display: grid;
          gap: 8px;
          min-width: 0;
        }
        .canteen-legacy-field-row {
          display: grid;
          grid-template-columns: 110px minmax(0, 1fr);
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .canteen-legacy-field-row > * { min-width: 0; }
        .canteen-legacy-field-row label {
          color: var(--legacy-title);
          font-weight: 500;
          font-size: 0.98rem;
        }
        .canteen-legacy-double-row {
          display: grid;
          grid-template-columns: 110px minmax(0, 1fr) 120px minmax(0, 1fr);
          gap: 8px;
          align-items: center;
          min-width: 0;
        }
        .canteen-legacy-double-row > * { min-width: 0; }
        .canteen-legacy-double-row .secondary-label {
          color: var(--legacy-title);
          text-align: right;
          font-weight: 500;
        }
        .canteen-legacy-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          min-width: 0;
        }
        .canteen-legacy-action-btn {
          min-height: 56px !important;
          display: grid;
          place-items: center;
          text-align: center;
          font-weight: 700;
          line-height: 1.15;
        }
        .canteen-legacy-filters {
          display: grid;
          grid-template-columns: 1.35fr 1fr 1fr;
          gap: 12px;
          align-items: end;
        }
        .canteen-legacy-filter-title,
        .canteen-legacy-table-title {
          text-align: center;
          color: var(--legacy-title);
          font-weight: 900;
          font-size: 1rem;
        }
        .canteen-stock-page--embedded .canteen-legacy-filter-title,
        .canteen-stock-page--embedded .canteen-legacy-table-title {
          color: var(--app-text, var(--text));
        }
        .canteen-legacy-highlight {
          background: var(--legacy-yellow) !important;
        }
        .canteen-legacy-grid-table {
          border: 1px solid var(--legacy-line-strong);
          background: #fff;
          overflow: hidden;
        }
        .canteen-stock-table-frame {
          border: 1px solid var(--legacy-line-strong);
          background: #fff;
          overflow: hidden;
          min-width: 0;
          width: 100%;
        }
        .canteen-stock-table-scroll {
          overflow-x: auto;
          overflow-y: auto;
          background: linear-gradient(180deg, #fff 0%, #fff 26%, var(--legacy-orange) 26%, var(--legacy-orange) 100%);
        }
        .canteen-stock-page--embedded .canteen-stock-table-scroll {
          background: linear-gradient(180deg, #fff 0%, #fff 24%, #f59e0b 24%, #f59e0b 100%);
        }
        .canteen-stock-table-grid {
          width: 100%;
          min-width: 0;
          display: grid;
          grid-template-columns: 1.2fr 2.3fr .82fr .88fr .86fr .92fr .92fr .72fr 1.18fr;
        }
        .canteen-stock-table-head {
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .canteen-stock-table-head > div {
          background: #f7f7f7;
          color: #ff1a1a;
          font-weight: 700;
          border-right: 1px solid var(--legacy-line);
          border-bottom: 1px solid var(--legacy-line-strong);
          padding: 8px 7px;
          font-size: 0.82rem;
          line-height: 1.2;
        }
        .canteen-stock-table-row {
          display: contents;
        }
        .canteen-stock-table-row > button {
          display: contents;
        }
        .canteen-stock-table-cell {
          padding: 8px 8px;
          border-right: 1px solid #d1d5db;
          border-bottom: 1px solid #d7dde7;
          background: rgba(255,255,255,0.96);
          color: #2f3640;
          font-size: 0.88rem;
          min-height: 42px;
          display: flex;
          align-items: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .canteen-stock-table-cell.is-number {
          justify-content: flex-end;
          font-variant-numeric: tabular-nums;
        }
        .canteen-stock-table-cell.is-name,
        .canteen-stock-table-cell.is-group {
          white-space: normal;
          line-height: 1.28;
        }
        .canteen-stock-table-cell.is-clickable {
          cursor: pointer;
        }
        .canteen-stock-table-cell.is-critical {
          background: #fee2e2;
          color: #991b1b;
          font-weight: 800;
        }
        .canteen-stock-table-empty {
          padding: 16px;
          color: #fff;
          font-weight: 700;
        }
        .canteen-legacy-grid-header,
        .canteen-legacy-grid-row {
          display: grid;
          grid-template-columns: 1.2fr 2fr 1fr 1fr 1fr 1fr;
          min-width: 760px;
        }
        .canteen-legacy-grid-header > div {
          background: #fff;
          color: #ff1a1a;
          font-weight: 700;
          border-right: 1px solid var(--legacy-line);
          border-bottom: 1px solid var(--legacy-line);
          padding: 8px 6px;
          font-size: 0.9rem;
        }
        .canteen-legacy-grid-row > div {
          border-right: 1px solid #d1d5db;
          border-bottom: 1px solid #e5e7eb;
          padding: 8px 6px;
          font-size: 0.92rem;
        }
        .canteen-legacy-grid-body {
          max-height: 360px;
          overflow: auto;
          background: linear-gradient(180deg, #fff 0%, #fff 35%, var(--legacy-orange) 35%, var(--legacy-orange) 100%);
        }
        .canteen-stock-page--embedded .canteen-legacy-grid-body {
          background: var(--app-surface, #fff);
        }
        .canteen-legacy-footer {
          display: grid;
          grid-template-columns: 1.5fr 0.9fr 1fr;
          gap: 12px;
          align-items: center;
          min-width: 0;
        }
        .canteen-legacy-footer-metric-row,
        .canteen-legacy-footer-metric-row > * {
          min-width: 0;
        }
        .canteen-legacy-metric-label {
          font-size: 0.95rem;
        }
        .canteen-legacy-metric-box {
          background: var(--legacy-red);
          color: #fff;
          font-weight: 900;
          font-size: 1.1rem;
          padding: 8px 12px;
          text-align: right;
          border: 1px solid #9b0000;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          overflow: hidden;
        }
        .canteen-legacy-count-box {
          background: var(--legacy-blue);
          color: #fff;
          font-weight: 900;
          font-size: 1.1rem;
          padding: 8px 12px;
          text-align: center;
          border: 1px solid #17008a;
        }
        .canteen-legacy-status-strip {
          display: grid;
          grid-template-columns: 120px minmax(0, 1fr);
          gap: 8px;
          align-items: center;
        }
        .canteen-legacy-status-label {
          color: var(--legacy-title);
          font-weight: 500;
          text-align: right;
        }
        .canteen-stock-page--embedded .canteen-legacy-status-label {
          color: var(--app-text, var(--text));
        }
        .canteen-legacy-status-box {
          min-height: 28px;
          border: 1px solid var(--legacy-line);
          background: var(--legacy-yellow);
        }
        .canteen-legacy-last-box {
          min-height: 28px;
          border: 1px solid #93c595;
          background: var(--legacy-green);
          display: flex;
          align-items: center;
          padding: 0 8px;
          font-weight: 700;
        }
        .canteen-legacy-count-header,
        .canteen-legacy-count-row {
          display: grid;
          grid-template-columns: 1.1fr 2.2fr 1.1fr 1.1fr 1.1fr;
          min-width: 760px;
        }
        .canteen-legacy-count-header > div {
          background: var(--legacy-header);
          border-right: 1px solid var(--legacy-line-strong);
          border-bottom: 1px solid var(--legacy-line-strong);
          padding: 8px 6px;
          font-size: 0.9rem;
        }
        .canteen-legacy-count-row > div {
          border-right: 1px solid #d1d5db;
          border-bottom: 1px solid #e5e7eb;
          padding: 8px 6px;
          background: #fff;
        }
        .canteen-legacy-legend {
          display: grid;
          gap: 8px;
          align-content: start;
        }
        .canteen-legacy-legend-item {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr);
          align-items: center;
        }
        .canteen-legacy-legend-swatch {
          height: 28px;
        }
        @media (max-width: 980px) {
          .canteen-legacy-top-grid,
          .canteen-legacy-filters,
          .canteen-legacy-footer {
            grid-template-columns: 1fr;
          }
          .canteen-legacy-double-row {
            grid-template-columns: 110px minmax(0, 1fr);
          }
          .canteen-legacy-double-row .secondary-label {
            text-align: left;
          }
          .canteen-legacy-actions {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (max-width: 760px) {
          .canteen-legacy-shell {
            gap: 8px;
            padding: 6px;
            border: 0;
            background: transparent;
            width: 100%;
            max-width: 100%;
            overflow-x: hidden;
          }
          .canteen-legacy-panel {
            gap: 10px;
            padding: 10px;
            width: 100%;
            max-width: 100%;
          }
          .canteen-legacy-window-title {
            padding: 2px 2px 6px;
          }
          .canteen-legacy-toolbar {
            gap: 6px;
          }
          .canteen-legacy-toolbar > * {
            flex: 1 1 calc(50% - 6px);
          }
          .canteen-legacy-toolbar .btn {
            min-height: 42px;
          }
          .canteen-legacy-field-row,
          .canteen-legacy-double-row,
          .canteen-legacy-status-strip {
            grid-template-columns: 1fr;
            gap: 6px;
            align-items: stretch;
            width: 100%;
          }
          .canteen-legacy-field-row label,
          .canteen-legacy-double-row label,
          .canteen-legacy-double-row .secondary-label,
          .canteen-legacy-status-label {
            text-align: left;
            font-size: 0.92rem;
          }
          .canteen-legacy-actions {
            grid-template-columns: 1fr !important;
            gap: 8px;
          }
          .canteen-legacy-action-btn {
            min-height: 48px !important;
            padding: 10px 12px !important;
          }
          .canteen-legacy-filters {
            gap: 8px;
          }
          .canteen-legacy-filter-title,
          .canteen-legacy-table-title {
            font-size: 0.94rem;
          }
          .canteen-stock-table-scroll,
          .canteen-legacy-grid-body {
            max-height: 48dvh;
          }
          .canteen-stock-table-scroll {
            overflow-x: auto;
            overflow-y: auto;
          }
          .canteen-stock-table-grid,
          .canteen-legacy-grid-header,
          .canteen-legacy-grid-row,
          .canteen-legacy-count-header,
          .canteen-legacy-count-row {
            min-width: 760px;
          }
          .canteen-legacy-footer > div {
            min-width: 0;
            width: 100%;
          }
          .canteen-legacy-footer .canteen-legacy-footer-metrics {
            gap: 10px;
          }
          .canteen-legacy-footer .canteen-legacy-footer-metric-row {
            grid-template-columns: 1fr;
            gap: 8px;
            align-items: stretch;
          }
          .canteen-legacy-footer .canteen-legacy-footer-actions {
            justify-content: stretch;
            gap: 8px;
          }
          .canteen-legacy-footer .canteen-legacy-footer-actions .btn {
            width: 100%;
          }
          .canteen-stock-page,
          .canteen-stock-page .card,
          .canteen-stock-page .input,
          .canteen-stock-page input,
          .canteen-stock-page select,
          .canteen-stock-page textarea {
            max-width: 100%;
          }
          .canteen-legacy-metric-box,
          .canteen-legacy-count-box {
            font-size: 1rem;
          }
        }
      `}</style>
      {STOCK_CONTENT_HIDDEN ? null : <><div className={embedded ? '' : 'stickyTop'} style={{ display: 'grid', gap: isMobilePortrait ? 8 : 10, paddingBottom: isMobilePortrait ? 8 : 12 }}>
        {showBranchSelector ? <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Stok</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Barkod ile hareket ve sayım.</div>
          </div>
          <CanteenBranchSelector compact />
        </div> : null}

        <div className="canteen-legacy-toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" style={{ flex: isMobilePortrait ? '1 1 calc(50% - 8px)' : '0 0 auto' }} type="button" onClick={() => setTab('movements')} aria-pressed={tab === 'movements'}>Hareket</button>
          <button className="btn" style={{ flex: isMobilePortrait ? '1 1 calc(50% - 8px)' : '0 0 auto' }} type="button" onClick={() => setTab('receipts')} aria-pressed={tab === 'receipts'}>Ürün Alımı</button>
          <button className="btn" style={{ flex: isMobilePortrait ? '1 1 100%' : '0 0 auto' }} type="button" onClick={() => setTab('history')} aria-pressed={tab === 'history'}>Geçmiş</button>
        </div>
      </div>

      {tab === 'movements' && (
        <StockMovementsPanel
          branchId={branchId}
          refreshToken={refreshToken}
          onScanRef={movementOnScanRef}
          isCompact={isCompact}
          onCreateProduct={onCreateProduct}
          onEditProduct={onEditProduct}
          onDeleteProduct={onDeleteProduct}
          onOpenCategories={onOpenCategories}
          onOpenCount={() => setCountModalOpen(true)}
        />
      )}
      {tab === 'receipts' && (
        <StockReceiptsPanel
          branchId={branchId}
          refreshToken={refreshToken}
          onScanRef={receiptOnScanRef}
          isCompact={isCompact}
          onCreateProduct={onCreateProduct}
          onEditProduct={onEditProduct}
          onOpenCategories={onOpenCategories}
        />
      )}
      {tab === 'history' && <StockHistoryPanel branchId={branchId} me={me} isCompact={isCompact} />}

      <Modal
        open={countModalOpen}
        onClose={() => setCountModalOpen(false)}
        title="Sayım"
        dialogStyle={{ width: 'min(1180px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 20px)' }}
        bodyStyle={{ padding: 18 }}
      >
        <StockCountPanelLegacyLike branchId={branchId} onScanRef={countOnScanRef} me={me} isCompact={isCompact} />
      </Modal></>}
    </div>
  )
}

export default function CanteenStockPage() {
  const { me } = useOutletContext()
  return <CanteenStockWorkspace me={me} />
}

function StockMovementsPanel({
  branchId,
  refreshToken = 0,
  onScanRef,
  isCompact = false,
  onCreateProduct = null,
  onEditProduct = null,
  onDeleteProduct = null,
  onOpenCategories = null,
  onOpenCount = null
}) {
  const barcodeRef = useRef(null)
  const [barcode, setBarcode] = useState('')
  const [type, setType] = useState('in')
  const [qtyStr, setQtyStr] = useState('1')
  const [note, setNote] = useState('')
  const [product, setProduct] = useState(null)
  const [catalogItems, setCatalogItems] = useState([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [lowStockOpen, setLowStockOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptQty, setReceiptQty] = useState('1')
  const [receiptCostPrice, setReceiptCostPrice] = useState('')
  const [receiptSalePrice, setReceiptSalePrice] = useState('')
  const [receiptNote, setReceiptNote] = useState('')
  const errorTimerRef = useRef(null)

  const canUse = String(branchId || '').trim().length > 0

  const focusBarcode = () => {
    try { barcodeRef.current?.focus() } catch {}
  }

  useEffect(() => {
    const t = setTimeout(() => focusBarcode(), 0)
    return () => clearTimeout(t)
  }, [])

  const loadMovements = async () => {
    if (!canUse) {
      setItems([])
      return
    }
    const res = await api(`/api/canteen/stock/movements?branchId=${encodeURIComponent(String(branchId))}`, { silent: true })
    setItems(Array.isArray(res?.items) ? res.items : [])
  }

  const loadCatalog = async () => {
    if (!canUse) {
      setCatalogItems([])
      return
    }
    const res = await api(`/api/canteen/products?branchId=${encodeURIComponent(String(branchId))}`, { silent: true })
    setCatalogItems(Array.isArray(res?.products) ? res.products : [])
  }

  useEffect(() => {
    loadMovements()
    loadCatalog()
  }, [branchId, refreshToken])

  useEffect(() => {
    if (!product) return
    const currentId = String(product?.id || '')
    const currentBarcode = String(product?.barcode || '')
    const fullProduct = (catalogItems || []).find((item) => (
      (currentId && String(item?.id || '') === currentId) ||
      (currentBarcode && String(item?.barcode || '') === currentBarcode)
    ))
    if (!fullProduct) return
    setProduct((prev) => {
      if (!prev) return prev
      return { ...prev, ...fullProduct }
    })
  }, [catalogItems, product])

  const lookup = async (code, { final = false } = {}) => {
    const c = String(code || '').trim()
    if (!c || !canUse) return
    const res = await api(`/api/canteen/products/by-barcode/${encodeURIComponent(c)}`, { silent: true, headers: { 'x-branch-id': String(branchId) } })
    if (!res?.ok || !res?.product) {
      if (final && res?.code === 'not_found') {
        setError('Barkod bulunamadı')
        try { clearTimeout(errorTimerRef.current) } catch {}
        errorTimerRef.current = setTimeout(() => setError(''), 2000)
      }
      setProduct(null)
      return
    }
    setError('')
    setProduct(res.product)
  }

  const onSelectProduct = (p) => {
    const selectedId = String(p?.id || '')
    const selectedBarcode = String(p?.barcode || '')
    const fullProduct = (catalogItems || []).find((item) => (
      (selectedId && String(item?.id || '') === selectedId) ||
      (selectedBarcode && String(item?.barcode || '') === selectedBarcode)
    ))
    const nextProduct = fullProduct ? { ...p, ...fullProduct } : p
    setError('')
    setProduct(nextProduct)
    setBarcode(String(nextProduct?.barcode || ''))
    setTimeout(() => focusBarcode(), 0)
  }

  useEffect(() => {
    if (!onScanRef) return
    onScanRef.current = (code) => {
      if (!canUse) return
      const c = String(code || '').trim()
      if (!c) return
      setError('')
      setBarcode(c)
      lookup(c, { final: true })
      setTimeout(() => focusBarcode(), 0)
    }
    return () => {
      if (onScanRef.current) onScanRef.current = null
    }
  }, [onScanRef, canUse, branchId])

  const qtyNum = useMemo(() => {
    const n = Number(String(qtyStr || '').replace(',', '.'))
    return Number.isFinite(n) ? n : NaN
  }, [qtyStr])
  const qtyValid = String(qtyStr || '').trim() !== '' && Number.isFinite(qtyNum) && qtyNum > 0
  const productName = String(product?.name || '')
  const categoryName = String(product?.categoryName || '-')
  const sellPrice = money(product?.price || 0)
  const buyPrice = money(product?.costPrice || 0)
  const currentStock = Number(product?.stockQty || 0)
  const currentMinimumStock = Number(product?.minimumStock || 5)
  const totalCostValue = money((Number(product?.costPrice || 0) || 0) * currentStock)
  const totalSaleValue = money((Number(product?.price || 0) || 0) * currentStock)
  const lowStockItems = useMemo(() => {
    return (catalogItems || [])
      .filter((item) => item?.stockTrackingEnabled === true && Number(item?.stockQty || 0) <= Number(item?.minimumStock || 5))
      .sort((a, b) => Number(a?.stockQty || 0) - Number(b?.stockQty || 0))
  }, [catalogItems])
  const [tableSearch, setTableSearch] = useState('')
  const [tableGroup, setTableGroup] = useState('')
  const [tableSort, setTableSort] = useState('name')
  const groupOptions = useMemo(() => Array.from(new Set((catalogItems || []).map((item) => String(item?.categoryName || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr')), [catalogItems])
  const filteredTableItems = useMemo(() => {
    const query = String(tableSearch || '').trim().toLocaleLowerCase('tr-TR')
    const list = (catalogItems || []).filter((item) => {
      const matchesQuery = !query || [item?.name, item?.barcode, item?.categoryName].some((value) => String(value || '').toLocaleLowerCase('tr-TR').includes(query))
      const matchesGroup = !tableGroup || String(item?.categoryName || '') === tableGroup
      return matchesQuery && matchesGroup
    })
    const sorted = [...list]
    if (tableSort === 'barcode') sorted.sort((a, b) => String(a?.barcode || '').localeCompare(String(b?.barcode || ''), 'tr'))
    else if (tableSort === 'category') sorted.sort((a, b) => String(a?.categoryName || '').localeCompare(String(b?.categoryName || ''), 'tr'))
    else if (tableSort === 'stock') sorted.sort((a, b) => Number(b?.stockQty || 0) - Number(a?.stockQty || 0))
    else if (tableSort === 'price') sorted.sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0))
    else sorted.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'tr'))
    return sorted
  }, [catalogItems, tableGroup, tableSearch, tableSort])
  const exportTable = () => {
    const rows = [
      ['Barkod No', 'Ürünün Adı', 'Asgari Stok', 'Mevcut Stok', 'Ölçü Birimi', 'Alış Fiyatı', 'Satış Fiyatı', 'KDV Oranı', 'Ürün Grubu'],
      ...filteredTableItems.map((item) => [
        item?.barcode || '-',
        item?.name || '-',
        Number(item?.minimumStock || 5),
        Number(item?.stockQty || 0),
        'Adet',
        Number(item?.costPrice || 0),
        Number(item?.price || 0),
        Number(item?.vatRate || 0),
        item?.categoryName || '-'
      ])
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';')).join('\n')
    downloadBlob(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }), 'stok-listesi.csv')
  }

  const printBarcode = () => {
    const code = String(product?.barcode || barcode || '').trim()
    if (!code) return toast.error('Önce ürün seç')
    const w = window.open('', '_blank', 'width=420,height=320')
    if (!w) return toast.error('Yazdırma penceresi açılamadı')
    w.document.write(`<!doctype html><html><head><title>Barkod</title></head><body style="font-family:Arial,sans-serif;padding:24px;text-align:center"><div style="font-size:28px;font-weight:700;margin-bottom:16px">${product?.name || 'Ürün'}</div><div style="font-size:38px;letter-spacing:4px;margin-bottom:12px">${code}</div><div style="font-size:14px;color:#555">Barkod</div></body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  const openReceiptModal = () => {
    if (!product) {
      toast.error('Once urun sec')
      return
    }
    setReceiptQty('1')
    setReceiptCostPrice(String(product?.costPrice ?? ''))
    setReceiptSalePrice(String(product?.price ?? ''))
    setReceiptNote('')
    setReceiptOpen(true)
  }

  const submitReceipt = async () => {
    if (!canUse) return toast.error('Sube sec')
    if (!product?.id) return toast.error('Once urun sec')
    const qty = Number(String(receiptQty || '').replace(',', '.'))
    const costPrice = Number(String(receiptCostPrice || '').replace(',', '.'))
    const salePrice = Number(String(receiptSalePrice || '').replace(',', '.'))
    if (!Number.isFinite(qty) || qty <= 0) return toast.error('Miktar gecersiz')
    if (!Number.isFinite(costPrice) || costPrice < 0) return toast.error('Alis fiyati gecersiz')
    if (!Number.isFinite(salePrice) || salePrice < 0) return toast.error('Satis fiyati gecersiz')
    setLoading(true)
    const res = await api('/api/canteen/stock/receipts', {
      method: 'POST',
      headers: { 'x-branch-id': String(branchId) },
      data: {
        productId: String(product.id),
        qty,
        costPrice,
        salePrice,
        note: String(receiptNote || '').trim()
      },
      silent: true
    })
    if (!res?.ok) {
      toast.error(res?.message || 'Urun alimi kaydedilemedi')
      setLoading(false)
      return
    }
    setReceiptOpen(false)
    setProduct((prev) => prev ? {
      ...prev,
      stockQty: Number(res?.product?.stockQty || prev.stockQty || 0),
      price: Number(res?.product?.price ?? prev.price ?? 0),
      costPrice: Number(res?.product?.costPrice ?? prev.costPrice ?? 0)
    } : prev)
    await Promise.all([loadMovements(), loadCatalog()])
    setLoading(false)
    toast.success('Urun alimi kaydedildi')
  }

  const submit = async () => {
    if (!canUse) return toast.error('Şube seç')
    const bc = String(barcode || '').trim()
    if (!bc) return toast.error('Barkod zorunlu')
    if (!qtyValid) return toast.error('Miktar geçersiz')
    if (!product) return toast.error('Önce ürün bulunmalı')
    setLoading(true)
    const res = await api('/api/canteen/stock/movements', {
      method: 'POST',
      data: { type, qty: qtyNum, note: String(note || '').trim(), productId: product?.id ? String(product.id) : undefined, barcode: product?.id ? undefined : bc },
      headers: { 'x-branch-id': String(branchId) },
      silent: true
    })
    if (!res?.ok) {
      toast.error(res?.message || 'Kaydedilemedi')
      setLoading(false)
      focusBarcode()
      return
    }
    const nextQty = Number(res?.product?.stockQty || 0)
    setProduct(prev => prev ? { ...prev, stockQty: nextQty } : prev)
    setBarcode('')
    setQtyStr('1')
    setNote('')
    setError('')
    setProduct(null)
    await Promise.all([loadMovements(), loadCatalog()])
    setLoading(false)
    setTimeout(() => focusBarcode(), 150)
  }

  return (
    <div className="canteen-legacy-shell">
      <div className="card canteen-legacy-panel" style={{ display: 'grid', gap: 10 }}>
        <div className="canteen-legacy-top-grid" style={{ gridTemplateColumns: isCompact ? '1fr' : 'minmax(0, 1.8fr) minmax(260px, 0.82fr)' }}>
          <div className="canteen-legacy-form-grid">
            <div className="canteen-legacy-field-row">
              <label>Barkod No</label>
              <input
                className="input"
                ref={barcodeRef}
                value={barcode}
                onChange={(e) => {
                  const nextValue = e.target.value
                  setBarcode(nextValue)
                  if (!String(nextValue || '').trim()) setPreviewProduct(null)
                }}
                onKeyDown={async (e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  await lookup(barcode, { final: true })
                  focusBarcode()
                }}
                placeholder="Barkod"
                inputMode="numeric"
                disabled={!canUse || loading}
              />
            </div>
            <div className="canteen-legacy-field-row">
              <label>Ürünün Adı</label>
              <ProductSearchBox
                branchId={branchId}
                onSelect={onSelectProduct}
                disabled={!canUse || loading}
                selectedLabel={product?.name || ''}
                selectedKey={product?.id || product?.barcode || ''}
              />
            </div>
            <div className="canteen-legacy-field-row">
              <label>Ürün Grubu</label>
              <input className="input" value={product ? categoryName : ''} readOnly placeholder="Ürün grubu" />
            </div>
            <div className="canteen-legacy-double-row">
              <label>Satış Fiyatı</label>
              <input className="input" value={product ? sellPrice : ''} readOnly placeholder="0,00" />
            </div>
            <div className="canteen-legacy-double-row">
              <label>Alış Fiyatı</label>
              <input className="input" value={product ? buyPrice : ''} readOnly placeholder="0,00" />
              <div className="secondary-label">KDV Oranı %</div>
              <input className="input" value={product ? String(Number(product?.vatRate || 0) || 0) : ''} readOnly placeholder="0" />
            </div>
            <div className="canteen-legacy-double-row">
              <label>Mevcut Stok</label>
              <input className="input" value={product ? String(currentStock) : ''} readOnly placeholder="0" />
              <div className="secondary-label">Asgari Stok</div>
              <input className="input" value={product ? String(currentMinimumStock) : ''} readOnly placeholder="5" />
            </div>
          </div>
          <div className="canteen-legacy-actions" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={() => onEditProduct?.(product)} disabled={!product || !onEditProduct}>Ürünü Düzenlet</button>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={() => onDeleteProduct?.(product)} disabled={!product || !onDeleteProduct}>Ürünü Sil</button>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={() => onCreateProduct?.()} disabled={!onCreateProduct}>Ürün Ekle</button>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={() => onDeleteProduct?.(product)} disabled={!product || !onDeleteProduct}>Toplu Ürün Sil</button>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={() => onOpenCategories?.()} disabled={!onOpenCategories}>Ürün Grupları</button>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={printBarcode} disabled={!product && !String(barcode || '').trim()}>Barkod Yazdır</button>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={() => setDetailOpen(true)} disabled={!product}>Ürün Detayı</button>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={() => setLowStockOpen(true)} disabled={lowStockItems.length === 0}>Asgari Stok Altında Olan Ürünler</button>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={() => onOpenCount?.()} disabled={!onOpenCount}>Sayım</button>
          </div>
        </div>

        <div className="canteen-legacy-top-grid" style={{ display: 'none' }}>
          <div className="canteen-legacy-form-grid">
            <div style={{ display: 'grid', gap: 6 }}>
              <div className="canteen-legacy-filter-title">{'<<< ÜRÜN ADI İLE ARAMA >>>'}</div>
              <ProductSearchBox branchId={branchId} onSelect={onSelectProduct} disabled={!canUse || loading} inputClassName="canteen-legacy-highlight" />
            </div>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Barkod okut</div>
          <input
            className="input"
            ref={barcodeRef}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              await lookup(barcode, { final: true })
              focusBarcode()
            }}
            placeholder="Barkod"
            inputMode="numeric"
            disabled={!canUse || loading}
          />
        </label>
          </div>
          <div className="canteen-legacy-actions">
            <button className="btn canteen-legacy-action-btn" type="button" onClick={() => lookup(barcode, { final: true })} disabled={!canUse || loading || !String(barcode || '').trim()}>
              Ürünü Bul
            </button>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={loadMovements} disabled={!canUse || loading}>
              Son Hareketler
            </button>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={submit} disabled={!canUse || loading || !String(barcode || '').trim() || !product || !type || !qtyValid}>
              {loading ? 'Kaydediliyor' : 'Hareket Kaydet'}
            </button>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={() => setType('adjust')} disabled={!canUse || loading}>
              Ürün Detayı
            </button>
          </div>
        </div>

        {!!error && <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}

        {product && (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Ürün: <span style={{ color: 'var(--text)', fontWeight: 800 }}>{product.name}</span> | Mevcut Stok: <span style={{ color: 'var(--text)', fontWeight: 800 }}>{Number(product.stockQty || 0)}</span>
          </div>
        )}

        <div className="canteen-legacy-panel" style={{ gap: 12 }}>
          <div className="canteen-legacy-filters">
            <div style={{ display: 'grid', gap: 6 }}>
              <div className="canteen-legacy-filter-title">{'<<< ÜRÜN ADI İLE ARAMA >>>'}</div>
              <input className="input canteen-legacy-highlight" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} placeholder="Ürün adı ile ara" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div className="canteen-legacy-filter-title">Ürün Grubu</div>
              <select className="input canteen-legacy-highlight" value={tableGroup} onChange={(e) => setTableGroup(e.target.value)}>
                <option value="">Tümü</option>
                {groupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div className="canteen-legacy-filter-title">Sıralama Ölçütü</div>
              <select className="input canteen-legacy-highlight" value={tableSort} onChange={(e) => setTableSort(e.target.value)}>
                <option value="name">AD</option>
                <option value="category">Kategori</option>
                <option value="barcode">Barkod</option>
                <option value="stock">Stok</option>
                <option value="price">Satış Fiyatı</option>
              </select>
            </div>
          </div>

          <div className="canteen-stock-table-frame">
            <div className="canteen-stock-table-scroll">
              <div className="canteen-stock-table-grid canteen-stock-table-head">
                <div>Barkod No</div>
                <div>Ürünün Adı</div>
                <div>Asgari Stok</div>
                <div>Mevcut Stok</div>
                <div>Ölçü Birimi</div>
                <div>Alış Fiyatı</div>
                <div>Satış Fiyatı</div>
                <div>KDV Oranı</div>
                <div>Ürün Grubu</div>
              </div>
              <div className="canteen-stock-table-grid">
                {filteredTableItems.map((item) => (
                  <div key={item.id} className="canteen-stock-table-row">
                    {(() => {
                      const minimumStockLevel = Number(item?.minimumStock || 5)
                      const isCritical = Number(item?.stockQty || 0) < minimumStockLevel
                      return (
                    <button type="button" onClick={() => onSelectProduct(item)}>
                      <div className="canteen-stock-table-cell is-clickable">{item?.barcode || '-'}</div>
                      <div className="canteen-stock-table-cell is-name is-clickable">{item?.name || '-'}</div>
                      <div className={`canteen-stock-table-cell is-number is-clickable${isCritical ? ' is-critical' : ''}`}>{minimumStockLevel}</div>
                      <div className={`canteen-stock-table-cell is-number is-clickable${isCritical ? ' is-critical' : ''}`}>{Number(item?.stockQty || 0)}</div>
                      <div className="canteen-stock-table-cell is-clickable">Adet</div>
                      <div className="canteen-stock-table-cell is-number is-clickable">{money(item?.costPrice || 0)}</div>
                      <div className="canteen-stock-table-cell is-number is-clickable">{money(item?.price || 0)}</div>
                      <div className="canteen-stock-table-cell is-number is-clickable">{Number(item?.vatRate || 0)}</div>
                      <div className="canteen-stock-table-cell is-group is-clickable">{item?.categoryName || '-'}</div>
                    </button>
                      )
                    })()}
                  </div>
                ))}
              </div>
              {filteredTableItems.length === 0 ? <div className="canteen-stock-table-empty">Kayıt yok</div> : null}
            </div>
          </div>

          <div className="canteen-legacy-footer">
            <div className="canteen-legacy-footer-metrics" style={{ display: 'grid', gap: 8 }}>
              <div className="canteen-legacy-footer-metric-row" style={{ display: 'grid', gridTemplateColumns: '1fr 200px', alignItems: 'center', gap: 12 }}>
                <div className="canteen-legacy-metric-label">Mağazanızdaki Ürünlerin Alış Fiyatından Değeri</div>
                <div className="canteen-legacy-metric-box">{money(filteredTableItems.reduce((sum, item) => sum + (Number(item?.costPrice || 0) * Number(item?.stockQty || 0)), 0))} TL</div>
              </div>
              <div className="canteen-legacy-footer-metric-row" style={{ display: 'grid', gridTemplateColumns: '1fr 200px', alignItems: 'center', gap: 12 }}>
                <div className="canteen-legacy-metric-label">Mağazanızdaki Ürünlerin Satış Fiyatından Değeri</div>
                <div className="canteen-legacy-metric-box">{money(filteredTableItems.reduce((sum, item) => sum + (Number(item?.price || 0) * Number(item?.stockQty || 0)), 0))} TL</div>
              </div>
            </div>
            <div style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
              <div className="canteen-legacy-table-title">Listelenen Kayıt Sayısı</div>
              <div className="canteen-legacy-count-box">{filteredTableItems.length}</div>
            </div>
            <div className="canteen-legacy-footer-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn canteen-legacy-action-btn" type="button" onClick={loadCatalog} disabled={!canUse || loading}>Excel'den Kayıt Al</button>
              <button className="btn canteen-legacy-action-btn" type="button" onClick={exportTable}>Excel'e Kayıt Ver</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'none', gap: 8, flexWrap: 'wrap' }}>
          {[
            { key: 'in', label: 'Giriş' },
            { key: 'out', label: 'Çıkış' },
            { key: 'waste', label: 'Fire' },
            { key: 'adjust', label: 'Düzeltme' }
          ].map(x => (
            <button key={x.key} className="btn" type="button" onClick={() => setType(x.key)} aria-pressed={type === x.key} disabled={loading}>
              {x.label}
            </button>
          ))}
        </div>

        {product && (
          <div className="card" style={{ padding: 12, background: '#f9fafb' }}>
            <div style={{ fontWeight: 800 }}>{product.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Barkod: {product.barcode}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Fiyat: {money(product.price)} ₺</div>
            <div style={{ fontWeight: 700, marginTop: 6 }}>Mevcut stok: {Number(product.stockQty || 0)}</div>
          </div>
        )}

        <div style={{ display: 'none', gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : '1fr 1fr', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Miktar</div>
            <input
              className="input"
              value={qtyStr}
              inputMode="numeric"
              onChange={(e) => {
                const v = e.target.value
                if (!/^\d*$/.test(String(v))) return
                setQtyStr(v)
              }}
              disabled={!canUse || loading}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not</div>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} disabled={!canUse || loading} />
          </label>
        </div>

        <button
          style={{ display: 'none' }}
          className="btn btn--primary btn--large"
          type="button"
          onClick={submit}
          disabled={!canUse || loading || !String(barcode || '').trim() || !product || !type || !qtyValid}
        >
          {loading ? 'Kaydediliyor...' : 'Kaydet'}
        </button>

        {!canUse && <div style={{ color: 'var(--muted)' }}>Devam etmek için şube seç.</div>}
      </div>

      <div className="card" style={{ display: 'none', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontWeight: 700 }}>Son Hareketler</div>
          <button className="btn btn--compact" type="button" onClick={loadMovements} disabled={!canUse || loading}>Yenile</button>
        </div>
        <div style={{ display: 'grid', gap: 8, maxHeight: '60vh', overflowY: 'auto', paddingRight: 6 }}>
          {items.map(m => (
            <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div className="breakAny" style={{ fontWeight: 800 }}>{stockActionLabel(m.type)} • {m.productName || 'Ürün'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Barkod: {m.barcode || '-'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{m.createdAt ? new Date(m.createdAt).toLocaleString('tr-TR') : ''}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Kaynak: {stockSourceLabel(m.note)}</div>
                {!!stockNoteLabel(m.note) && <div className="breakAny" style={{ color: 'var(--muted)', fontSize: 12 }}>Not: {stockNoteLabel(m.note)}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Miktar</div>
                <div style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>{Number(m.qty || 0)}</div>
              </div>
            </div>
          ))}
          {!loading && items.length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
        </div>
      </div>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Ürün Detayı" dialogStyle={{ width: 'min(720px, calc(100vw - 24px))' }}>
        {product ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="card" style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 900, fontSize: 20 }}>{product.name || '-'}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Barkod: {product.barcode || '-'}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ürün Grubu: {categoryName || '-'}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <div className="card" style={{ padding: 12 }}>Satış Fiyatı: {sellPrice}</div>
              <div className="card" style={{ padding: 12 }}>Alış Fiyatı: {buyPrice}</div>
              <div className="card" style={{ padding: 12 }}>Mevcut Stok: {currentStock}</div>
              <div className="card" style={{ padding: 12 }}>Alıştan Değer: {totalCostValue} TL</div>
              <div className="card" style={{ padding: 12 }}>Satıştan Değer: {totalSaleValue} TL</div>
            </div>
          </div>
        ) : <div style={{ color: 'var(--muted)' }}>Detay için ürün seç.</div>}
      </Modal>

      <Modal open={receiptOpen} onClose={() => setReceiptOpen(false)} title="Urun Alimi" dialogStyle={{ width: 'min(620px, calc(100vw - 24px))' }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="card" style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontWeight: 900 }}>{product?.name || '-'}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Barkod: {product?.barcode || '-'}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Mevcut aktif satis fiyati: {money(product?.price || 0)} TL</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Bu alim ayri parti olarak kaydedilir. Eski stok bitmeden yeni fiyat satisa gecmez.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Alinan Miktar</div>
              <input className="input" value={receiptQty} onChange={(e) => setReceiptQty(e.target.value)} inputMode="decimal" />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni Alis Fiyati</div>
              <input className="input" value={receiptCostPrice} onChange={(e) => setReceiptCostPrice(e.target.value)} inputMode="decimal" />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni Satis Fiyati</div>
              <input className="input" value={receiptSalePrice} onChange={(e) => setReceiptSalePrice(e.target.value)} inputMode="decimal" />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not</div>
              <input className="input" value={receiptNote} onChange={(e) => setReceiptNote(e.target.value)} />
            </label>
          </div>
          <div className="app-modal-footer" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={() => setReceiptOpen(false)} disabled={loading}>Vazgec</button>
            <button className="btn btn--primary" type="button" onClick={submitReceipt} disabled={loading}>Kaydet</button>
          </div>
        </div>
      </Modal>
      <Modal open={lowStockOpen} onClose={() => setLowStockOpen(false)} title="Asgari Stok Altında Olan Ürünler" dialogStyle={{ width: 'min(860px, calc(100vw - 24px))' }}>
        <div style={{ display: 'grid', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
          {lowStockItems.map((item) => (
            <button key={item.id} type="button" className="btn btn--full btn--between" onClick={() => { onSelectProduct(item); setLowStockOpen(false) }} style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'grid', textAlign: 'left' }}>
                <span style={{ fontWeight: 800 }}>{item.name || '-'}</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>{item.barcode || '-'} • {item.categoryName || '-'}</span>
              </span>
              <span style={{ fontWeight: 900 }}>{Number(item.stockQty || 0)}</span>
            </button>
          ))}
          {lowStockItems.length === 0 ? <div style={{ color: 'var(--muted)' }}>Kritik stok ürünü yok.</div> : null}
        </div>
      </Modal>
    </div>
  )
}

function StockReceiptsPanel({
  branchId,
  refreshToken = 0,
  onScanRef,
  isCompact = false,
  onCreateProduct = null,
  onEditProduct = null,
  onOpenCategories = null
}) {
  const barcodeRef = useRef(null)
  const [barcode, setBarcode] = useState('')
  const [product, setProduct] = useState(null)
  const [catalogItems, setCatalogItems] = useState([])
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [productName, setProductName] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [minimumStockStr, setMinimumStockStr] = useState('5')
  const [qtyStr, setQtyStr] = useState('1')
  const [costPriceStr, setCostPriceStr] = useState('0')
  const [salePriceStr, setSalePriceStr] = useState('0')
  const [note, setNote] = useState('')
  const [salePriceMode, setSalePriceMode] = useState('new_batch_after_old_stock')
  const errorTimerRef = useRef(null)

  const canUse = String(branchId || '').trim().length > 0

  const focusBarcode = () => {
    try { barcodeRef.current?.focus() } catch {}
  }

  const clearForm = () => {
    setProduct(null)
    setBarcode('')
    setProductName('')
    setCategoryName('')
    setMinimumStockStr('5')
    setQtyStr('1')
    setCostPriceStr('0')
    setSalePriceStr('0')
    setSalePriceMode('new_batch_after_old_stock')
    setNote('')
    setError('')
  }

  useEffect(() => {
    const t = setTimeout(() => focusBarcode(), 0)
    return () => clearTimeout(t)
  }, [])

  const loadCatalog = async () => {
    if (!canUse) {
      setCatalogItems([])
      setCategories([])
      return
    }
    const [productRes, categoryRes] = await Promise.all([
      api(`/api/canteen/products?branchId=${encodeURIComponent(String(branchId))}`, { silent: true }),
      api('/api/canteen/categories', { silent: true, headers: { 'x-branch-id': String(branchId) } })
    ])
    setCatalogItems(Array.isArray(productRes?.products) ? productRes.products : [])
    setCategories(Array.isArray(categoryRes?.categories) ? categoryRes.categories : [])
  }

  const loadReceipts = async () => {
    if (!canUse) {
      setItems([])
      return
    }
    const res = await api(`/api/canteen/stock/movements?branchId=${encodeURIComponent(String(branchId))}`, { silent: true })
    const list = Array.isArray(res?.items) ? res.items : []
    setItems(list.filter((item) => String(item?.type || '') === 'in').slice(0, 12))
  }

  useEffect(() => {
    loadCatalog()
    loadReceipts()
  }, [branchId, refreshToken])

  useEffect(() => {
    if (!product) return
    const currentId = String(product?.id || '')
    const currentBarcode = String(product?.barcode || '')
    const fullProduct = (catalogItems || []).find((item) => (
      (currentId && String(item?.id || '') === currentId) ||
      (currentBarcode && String(item?.barcode || '') === currentBarcode)
    ))
    if (!fullProduct) return
    setProduct((prev) => prev ? { ...prev, ...fullProduct } : prev)
    setProductName((prev) => {
      const nextName = String(fullProduct?.name || '')
      return nextName || prev
    })
    setCategoryName((prev) => {
      const nextCategoryName = String(fullProduct?.categoryName || '').trim()
      return nextCategoryName || prev
    })
    setMinimumStockStr((prev) => {
      const nextMinimumStock = String(Number(fullProduct?.minimumStock || 5))
      return nextMinimumStock || prev
    })
  }, [catalogItems, product])

  const syncSelectedProduct = (nextProduct) => {
    setError('')
    setProduct(nextProduct)
    setBarcode(String(nextProduct?.barcode || ''))
    setProductName(String(nextProduct?.name || ''))
    setCategoryName(String(nextProduct?.categoryName || ''))
    setMinimumStockStr(String(Number(nextProduct?.minimumStock || 5)))
    setCostPriceStr('0')
    setSalePriceStr('0')
    setSalePriceMode('new_batch_after_old_stock')
  }

  const lookup = async (code, { final = false } = {}) => {
    const c = String(code || '').trim()
    if (!c || !canUse) return
    const res = await api(`/api/canteen/products/by-barcode/${encodeURIComponent(c)}`, { silent: true, headers: { 'x-branch-id': String(branchId) } })
    if (!res?.ok || !res?.product) {
      if (final) {
        setError('Barkod bulunamadı')
        try { clearTimeout(errorTimerRef.current) } catch {}
        errorTimerRef.current = setTimeout(() => setError(''), 2000)
      }
      setProduct(null)
      setProductName('')
      setCategoryName('')
      setMinimumStockStr('5')
      return
    }
    syncSelectedProduct(res.product)
  }

  const onSelectProduct = (p) => {
    const selectedId = String(p?.id || '')
    const selectedBarcode = String(p?.barcode || '')
    const fullProduct = (catalogItems || []).find((item) => (
      (selectedId && String(item?.id || '') === selectedId) ||
      (selectedBarcode && String(item?.barcode || '') === selectedBarcode)
    ))
    syncSelectedProduct(fullProduct ? { ...p, ...fullProduct } : p)
    setTimeout(() => focusBarcode(), 0)
  }

  useEffect(() => {
    if (!onScanRef) return
    onScanRef.current = (code) => {
      if (!canUse) return
      const c = String(code || '').trim()
      if (!c) return
      setBarcode(c)
      lookup(c, { final: true })
      setTimeout(() => focusBarcode(), 0)
    }
    return () => {
      if (onScanRef.current) onScanRef.current = null
    }
  }, [onScanRef, canUse, branchId])

  const qty = Number(String(qtyStr || '').replace(',', '.'))
  const costPrice = Number(String(costPriceStr || '').replace(',', '.'))
  const salePrice = Number(String(salePriceStr || '').replace(',', '.'))
  const minimumStock = Number(String(minimumStockStr || '').replace(',', '.'))
  const normalizedBarcode = String(barcode || '').trim()
  const normalizedProductName = String(productName || '').trim()
  const normalizedCategoryName = String(categoryName || '').trim()
  const qtyValid = Number.isFinite(qty) && qty > 0
  const costValid = Number.isFinite(costPrice) && costPrice >= 0
  const saleValid = Number.isFinite(salePrice) && salePrice >= 0
  const minimumStockValid = Number.isFinite(minimumStock) && minimumStock >= 0
  const selectedStock = Number(product?.stockQty || 0)
  const selectedMin = Number(product?.minimumStock || 5)
  const currentSalePrice = Number(product?.price || 0)
  const categoryOptions = useMemo(
    () => Array.from(new Set((categories || []).map((item) => String(item?.name || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr')),
    [categories]
  )
  const categorySelectValue = categoryName && !categoryOptions.includes(categoryName) ? '__new__' : categoryName

  const bindZeroInput = (value, setValue) => ({
    value,
    onChange: (e) => setValue(e.target.value),
    onFocus: () => {
      if (String(value || '').trim() === '0') setValue('')
    },
    onBlur: () => {
      if (!String(value || '').trim()) setValue('0')
    }
  })

  const submitReceipt = async () => {
    if (!canUse) return toast.error('Şube seç')
    if (!normalizedBarcode) return toast.error('Barkod zorunlu')
    if (!normalizedProductName) return toast.error('Urun adi zorunlu')
    if (!qtyValid) return toast.error('Miktar geçersiz')
    if (!costValid) return toast.error('Alış fiyatı geçersiz')
    if (!saleValid) return toast.error('Satış fiyatı geçersiz')
    if (!minimumStockValid) return toast.error('Asgari stok gecersiz')

    setLoading(true)
    const res = await api('/api/canteen/stock/receipts', {
      method: 'POST',
      headers: { 'x-branch-id': String(branchId) },
      data: {
        productId: product?.id ? String(product.id) : '',
        barcode: normalizedBarcode,
        name: normalizedProductName,
        categoryName: normalizedCategoryName,
        minimumStock,
        qty,
        costPrice,
        salePrice,
        salePriceMode,
        note: String(note || '').trim()
      },
      silent: true
    })
    if (!res?.ok) {
      toast.error(res?.message || 'Ürün alımı kaydedilemedi')
      setLoading(false)
      return
    }

    clearForm()
    await Promise.all([loadCatalog(), loadReceipts()])
    setLoading(false)
    toast.success('Ürün alımı kaydedildi')
    setTimeout(() => focusBarcode(), 120)
  }

  return (
    <div className="canteen-legacy-shell">
      <div className="card canteen-legacy-panel" style={{ display: 'grid', gap: 12 }}>
        <div className="canteen-legacy-top-grid" style={{ gridTemplateColumns: isCompact ? '1fr' : 'minmax(0, 1.7fr) minmax(280px, 0.9fr)' }}>
          <div className="canteen-legacy-form-grid">
            <div className="canteen-legacy-field-row">
              <label>Barkod No</label>
              <input
                className="input"
                ref={barcodeRef}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  await lookup(barcode, { final: true })
                }}
                placeholder="Barkod okut veya yaz"
                inputMode="numeric"
                disabled={!canUse || loading}
              />
            </div>
            <div className="canteen-legacy-field-row">
              <label>Ürünün Adı</label>
              <input className="input" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Urun adini yaz" disabled={!canUse || loading} />
            </div>
            <div className="canteen-legacy-field-row">
              <label>Ürün Grubu</label>
              <div style={{ display: 'grid', gap: 8 }}>
                <select
                  className="input"
                  value={categorySelectValue}
                  onChange={(e) => {
                    const next = e.target.value
                    if (next === '__new__') {
                      setCategoryName('')
                      return
                    }
                    setCategoryName(next)
                  }}
                  disabled={!canUse || loading}
                >
                  <option value="">Kategori sec</option>
                  {categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  <option value="__new__">Yeni kategori yaz</option>
                </select>
                {categorySelectValue === '__new__' ? (
                  <input
                    className="input"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="Yeni kategori adi"
                    disabled={!canUse || loading}
                  />
                ) : null}
              </div>
            </div>
            <div className="canteen-legacy-double-row">
              <label>Mevcut Stok</label>
              <input className="input" value={product ? String(selectedStock) : ''} readOnly placeholder="0" />
              <div className="secondary-label">Asgari Stok</div>
              <input className="input" value={minimumStockStr} onChange={(e) => setMinimumStockStr(e.target.value)} inputMode="decimal" placeholder="5" disabled={!canUse || loading} />
            </div>
            <div className="canteen-legacy-double-row">
              <label>Alınan Miktar</label>
              <input className="input" value={qtyStr} onChange={(e) => setQtyStr(e.target.value)} inputMode="decimal" placeholder="1" disabled={!canUse || loading} />
              <div className="secondary-label">Not</div>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="İsteğe bağlı not" disabled={!canUse || loading} />
            </div>
            <div className="canteen-legacy-double-row">
              <label>Yeni Alış Fiyatı</label>
              <input className="input" {...bindZeroInput(costPriceStr, setCostPriceStr)} inputMode="decimal" placeholder="0" disabled={!canUse || loading} />
              <div className="secondary-label">Yeni Satış Fiyatı</div>
              <input className="input" {...bindZeroInput(salePriceStr, setSalePriceStr)} inputMode="decimal" placeholder="0" disabled={!canUse || loading} />
            </div>
            <div className="canteen-legacy-double-row">
              <label>Eski Satis Fiyati</label>
              <input className="input" value={product ? money(currentSalePrice) : ''} readOnly placeholder="0,00" />
              <div className="secondary-label">Satis Sekli</div>
              <div style={{ display: 'grid', gap: 8, alignContent: 'center' }}>
                <button className="btn" type="button" onClick={() => setSalePriceMode('apply_to_all_stock')} aria-pressed={salePriceMode === 'apply_to_all_stock'} disabled={loading}>
                  Tum stok yeni fiyat
                </button>
                <button className="btn" type="button" onClick={() => setSalePriceMode('new_batch_after_old_stock')} aria-pressed={salePriceMode === 'new_batch_after_old_stock'} disabled={loading}>
                  Eski stok eski fiyat
                </button>
              </div>
            </div>
          </div>

          <div className="canteen-legacy-actions" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={() => lookup(barcode, { final: true })} disabled={!canUse || loading || !String(barcode || '').trim()}>
              Ürünü Bul
            </button>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={loadReceipts} disabled={!canUse || loading}>
              Son Alımlar
            </button>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={submitReceipt} disabled={!canUse || loading || !normalizedBarcode || !normalizedProductName || !qtyValid || !costValid || !saleValid || !minimumStockValid}>
              {loading ? 'Kaydediliyor' : 'Alımı Kaydet'}
            </button>
          </div>
        </div>

        {!!error && <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}

        {product ? (
          <div className="card" style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontWeight: 900 }}>{product?.name || '-'}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>
              Barkod: {product?.barcode || '-'} • Mevcut stok: {selectedStock} • Aktif satış fiyatı: {money(product?.price || 0)} TL
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>
              Yeni alım ayrı parti olarak kaydedilir. Eski stok bitince yeni fiyatlı parti satışa geçer.
            </div>
          </div>
        ) : null}

        <div className="card canteen-legacy-panel" style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div className="canteen-legacy-table-title">Son Ürün Alımları</div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>Son yapılan girişleri bu alandan hızlıca kontrol edebilirsin.</div>
            </div>
            <button className="btn canteen-legacy-action-btn" type="button" onClick={loadReceipts} disabled={!canUse || loading}>
              Yenile
            </button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="btn btn--full btn--between"
                onClick={() => {
                  const match = (catalogItems || []).find((catalogItem) => String(catalogItem?.id || '') === String(item?.productId || ''))
                  if (match) onSelectProduct(match)
                }}
                style={{ justifyContent: 'space-between' }}
              >
                <span style={{ display: 'grid', textAlign: 'left' }}>
                  <span style={{ fontWeight: 800 }}>{item?.productName || 'Ürün'}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtDateTime(item?.createdAt)} • {stockSourceLabel(item?.note)}</span>
                </span>
                <span style={{ fontWeight: 900 }}>+{Number(item?.qty || 0)}</span>
              </button>
            ))}
            {!loading && items.length === 0 ? <div style={{ color: 'var(--muted)' }}>Henüz ürün alımı kaydı yok.</div> : null}
          </div>
        </div>

        {!canUse ? <div style={{ color: 'var(--muted)' }}>Devam etmek için şube seç.</div> : null}
      </div>
    </div>
  )
}

function StockCountPanel({ branchId, onScanRef, me, isCompact = false }) {
  const barcodeRef = useRef(null)
  const [barcode, setBarcode] = useState('')
  const [qty, setQty] = useState('')
  const [autoAddOne, setAutoAddOne] = useState(true)
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [sessionStatus, setSessionStatus] = useState('')
  const [last, setLast] = useState(null)
  const [rows, setRows] = useState([])
  const [uiQtyById, setUiQtyById] = useState({})
  const editingIdsRef = useRef(new Set())
  const [summary, setSummary] = useState(null)
  const saveTimersRef = useRef(new Map())
  const lastCommittedRef = useRef(new Map())
  const [previewProduct, setPreviewProduct] = useState(null)

  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [historyItems, setHistoryItems] = useState([])
  const [historyRangeDays, setHistoryRangeDays] = useState(30)
  const [refreshKey, setRefreshKey] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detail, setDetail] = useState(null)

  const canUse = String(branchId || '').trim().length > 0
  const canViewHistory = (() => {
    try {
      const role = me?.role
      const perms = Array.isArray(me?.permissions) ? me.permissions : []
      return role === 'tenant_admin' || perms.includes('canteen_stock_count_view')
    } catch {
      return false
    }
  })()

  const focusBarcode = () => {
    try { barcodeRef.current?.focus() } catch {}
  }

  useEffect(() => {
    const t = setTimeout(() => focusBarcode(), 0)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    setSessionId('')
    setSessionStatus('')
    setSummary(null)
    setRows([])
    setUiQtyById({})
    editingIdsRef.current = new Set()
    setLast(null)
    setBarcode('')
    setQty('')
    setAutoAddOne(true)
    setPreviewProduct(null)
  }, [branchId])

  const loadHistory = async () => {
    if (!canUse || !canViewHistory) {
      setHistoryItems([])
      setHistoryError('')
      return
    }
    setHistoryLoading(true)
    setHistoryError('')
    const from = (() => {
      const n = Number(historyRangeDays || 0)
      if (!Number.isFinite(n) || n <= 0) return ''
      const d = new Date()
      d.setDate(d.getDate() - n)
      return d.toISOString()
    })()
    const res = await getStockCounts(branchId, { limit: 20, from })
    if (!res?.ok) {
      setHistoryError(res?.message || 'Geçmiş sayımlar yüklenemedi')
      setHistoryItems([])
      setHistoryLoading(false)
      return
    }
    setHistoryItems(Array.isArray(res?.items) ? res.items : [])
    setHistoryLoading(false)
  }

  const openDetail = async (id) => {
    const sid = String(id || '').trim()
    if (!sid || !canUse || !canViewHistory) return
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError('')
    setDetail(null)
    const res = await getStockCountDetail(branchId, sid)
    setDetailLoading(false)
    if (!res?.ok) {
      setDetailError(res?.message || 'Detay yüklenemedi')
      return
    }
    setDetail({ count: res?.count || null, lines: Array.isArray(res?.lines) ? res.lines : [] })
  }

  useEffect(() => {
    loadHistory()
  }, [canUse, canViewHistory, historyRangeDays, branchId])

  const storageKey = useMemo(() => {
    const bid = String(branchId || '').trim()
    return bid ? `canteen_stock_count_session_${bid}` : ''
  }, [branchId])

  const loadSummary = async (sid) => {
    const id = String(sid || '').trim()
    if (!id) return
    const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(id)}/summary`, { headers: { 'x-branch-id': String(branchId) }, silent: true })
    if (!res?.ok || !res?.summary) {
      try { if (storageKey) localStorage.removeItem(storageKey) } catch {}
      setSessionId('')
      setSessionStatus('')
      setSummary(null)
      setRows([])
      setLast(null)
      return
    }
    const s = res.summary
    setSessionId(String(s?.session?.id || id))
    setSessionStatus(String(s?.session?.status || ''))
    setSummary(s)
    const items = mapCountSummaryItems(s?.items)
    setRows(items)
    setUiQtyById(prev => {
      const next = { ...(prev || {}) }
      for (const it of items) {
        const id = String(it.itemId || '')
        if (!id) continue
        if (editingIdsRef.current.has(id)) continue
        next[id] = String(Number(it.countedQty || 0))
      }
      return next
    })
    for (const it of items) {
      lastCommittedRef.current.set(String(it.itemId || ''), Number(it.countedQty || 0))
    }
  }

  useEffect(() => {
    if (!canUse) return
    try {
      const sid = storageKey ? String(localStorage.getItem(storageKey) || '') : ''
      if (sid) loadSummary(sid)
    } catch {}
  }, [canUse, storageKey])

  useEffect(() => {
    if (!onScanRef) return
    onScanRef.current = (code) => {
      if (!canUse) return
      if (sessionStatus !== 'open') return
      const c = String(code || '').trim()
      if (!c) return
      if (!sessionId) return
      scan(c, autoAddOne ? 1 : qty)
    }
    return () => {
      if (onScanRef.current) onScanRef.current = null
    }
  }, [onScanRef, canUse, sessionId, qty, sessionStatus])

  const start = async () => {
    if (!canUse) return toast.error('Şube seç')
    setLoading(true)
    const res = await api('/api/canteen/stock-counts', { method: 'POST', headers: { 'x-branch-id': String(branchId) }, silent: true })
    if (!res?.ok || !res?.sessionId) {
      toast.error(res?.message || 'Sayım başlatılamadı')
      setLoading(false)
      return
    }
    setSessionId(String(res.sessionId))
    setSessionStatus('open')
    setSummary(null)
    setRows([])
    setLast(null)
    setBarcode('')
    setQty('')
    try { if (storageKey) localStorage.setItem(storageKey, String(res.sessionId)) } catch {}
    setLoading(false)
    focusBarcode()
  }

  const scan = async (codeRaw, qtyRaw, opts = {}) => {
    if (!canUse) return
    if (!sessionId) return toast.error('Önce sayım başlat')
    if (sessionStatus !== 'open') return
    const code = String(codeRaw || '').trim()
    const productId = String(opts?.productId || '').trim()
    if (!code && !productId) return
    const q = qtyRaw === undefined || qtyRaw === null || String(qtyRaw).trim() === '' ? 1 : Number(String(qtyRaw).replace(',', '.'))
    if (!Number.isFinite(q) || q <= 0) return toast.error('Miktar geçersiz')
    setLoading(true)
    const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(sessionId)}/scan`, {
      method: 'POST',
      headers: { 'x-branch-id': String(branchId) },
      data: { qty: q, barcode: productId ? undefined : code, productId: productId ? productId : undefined },
      silent: true
    })
    if (!res?.ok) {
      toast.error(res?.code === 'not_found' ? 'Ürün bulunamadı' : (res?.message || 'İşlem başarısız'))
      setLoading(false)
      focusBarcode()
      return
    }
    const itemId = String(res?.item?.itemId || '')
    const bc = String(res?.item?.barcode || code || '')
    const name = String(res?.product?.name || '')
    const stockQty = Number(res?.product?.stockQty || 0)
    const countedQty = Number(res?.item?.countedQty || 0)
    setLast({ itemId, barcode: bc, name, countedQty, stockQty })
    setRows(prev => {
      const next = Array.isArray(prev) ? [...prev] : []
      const idx = itemId ? next.findIndex(x => String(x.itemId) === itemId) : next.findIndex(x => String(x.barcode) === bc)
      const row = { itemId, productId: String(res?.item?.productId || ''), barcode: bc, name, countedQty, stockQty, saving: false, savedAt: null }
      if (idx >= 0) next[idx] = { ...next[idx], ...row }
      else next.unshift(row)
      return next
    })
    if (itemId) lastCommittedRef.current.set(itemId, countedQty)
    if (itemId) {
      setUiQtyById(prev => {
        if (editingIdsRef.current.has(itemId)) return prev
        return { ...(prev || {}), [itemId]: String(countedQty) }
      })
    }
    setBarcode('')
    setLoading(false)
    focusBarcode()
  }

  const updateRowCountedQty = (itemId, nextQty) => {
    const id = String(itemId || '').trim()
    if (!id) return
    const raw = String(nextQty ?? '')
    if (!/^[0-9]*$/.test(raw)) return

    setUiQtyById(prev => ({ ...(prev || {}), [id]: raw }))
    setRows(prev => prev.map(r => String(r.itemId) === id ? { ...r, saving: true } : r))

    const timers = saveTimersRef.current
    if (timers.has(id)) {
      try { clearTimeout(timers.get(id)) } catch {}
    }
    const valueNow = raw
    timers.set(id, setTimeout(async () => {
      if (String(valueNow || '').trim() === '') {
        setRows(prev2 => prev2.map(r => String(r.itemId) === id ? { ...r, saving: false } : r))
        return
      }

      const qty = Number(valueNow)
      if (!Number.isFinite(qty) || qty < 0) {
        setRows(prev2 => prev2.map(r => String(r.itemId) === id ? { ...r, saving: false } : r))
        return
      }

      const before = lastCommittedRef.current.get(id)
      const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'x-branch-id': String(branchId) },
        data: { countedQty: qty },
        silent: true
      })
      if (!res?.ok || !res?.item) {
        toast.error(res?.message || 'Kaydedilemedi')
        const rollback = String(Number(before ?? 0))
        setUiQtyById(prev2 => ({ ...(prev2 || {}), [id]: rollback }))
        setRows(prev2 => prev2.map(r => String(r.itemId) === id ? { ...r, countedQty: Number(before ?? r.countedQty), saving: false } : r))
        return
      }
      const savedQty = Number(res.item.countedQty || 0)
      lastCommittedRef.current.set(id, savedQty)
      setRows(prev2 => prev2.map(r => String(r.itemId) === id ? { ...r, countedQty: savedQty, saving: false, savedAt: Date.now() } : r))
      if (!editingIdsRef.current.has(id)) {
        setUiQtyById(prev2 => ({ ...(prev2 || {}), [id]: String(savedQty) }))
      }
      setLast(prevLast => (prevLast && String(prevLast.itemId) === id) ? { ...prevLast, countedQty: savedQty } : prevLast)
    }, 400))
  }

  const finish = async () => {
    if (!sessionId) return
    setLoading(true)
    const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(sessionId)}/finish`, { method: 'POST', headers: { 'x-branch-id': String(branchId) }, silent: true })
    if (!res?.ok || !res?.summary) {
      toast.error(res?.message || 'Özet alınamadı')
      setLoading(false)
      return
    }
    const s = res.summary
    setSummary(s)
    setSessionStatus(String(s?.session?.status || 'finished'))
    const items = mapCountSummaryItems(s?.items)
    setRows(items)
    for (const it of items) lastCommittedRef.current.set(String(it.itemId || ''), Number(it.countedQty || 0))
    setUiQtyById(prev => {
      const next = { ...(prev || {}) }
      for (const it of items) {
        const id = String(it.itemId || '')
        if (!id) continue
        if (editingIdsRef.current.has(id)) continue
        next[id] = String(Number(it.countedQty || 0))
      }
      return next
    })
    setLoading(false)
  }

  const apply = async () => {
    if (!sessionId) return
    setLoading(true)
    const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(sessionId)}/apply`, {
      method: 'POST',
      headers: { 'x-branch-id': String(branchId) },
      silent: true
    })
    if (!res?.ok) {
      toast.error(res?.message || 'Uygulanamadı')
      setLoading(false)
      return
    }
    toast.success('Stoğa uygulandı')
    setSessionId('')
    setSessionStatus('')
    setSummary(null)
    setRows([])
    setLast(null)
    setBarcode('')
    setLoading(false)
    try { if (storageKey) localStorage.removeItem(storageKey) } catch {}
  }

  const extra = useMemo(() => Array.isArray(summary?.extra) ? summary.extra : [], [summary])
  const missing = useMemo(() => Array.isArray(summary?.missing) ? summary.missing : [], [summary])
  const same = useMemo(() => Array.isArray(summary?.same) ? summary.same : [], [summary])

  return (
    <div className="canteen-legacy-shell" style={{ display: 'grid', gap: 12 }}>
      <div className="card canteen-legacy-panel" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>Sayım</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!sessionId && <button className="btn btn--primary" type="button" onClick={start} disabled={!canUse || loading}>Sayım Başlat</button>}
            {!!sessionId && <button className="btn" type="button" onClick={finish} disabled={!canUse || loading}>Bitir</button>}
            {!!sessionId && <button className="btn btn--primary" type="button" onClick={apply} disabled={!canUse || loading || sessionStatus !== 'finished'}>Stoğa Uygula</button>}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
          <input type="checkbox" checked={autoAddOne} onChange={(e) => setAutoAddOne(e.target.checked)} />
          Ürün barkodu okutulduktan sonra direkt olarak 1 adet eklesin
        </label>

        {!!sessionId && (
          <div className="stockCountScanRow" style={{ display: 'grid', gap: 10, gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))' }}>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Barkod okut</div>
              <input
                className="input"
                ref={barcodeRef}
                value={barcode}
                onChange={(e) => {
                  setBarcode(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  const v = String(barcode || '').trim()
                  setBarcode('')
                  scan(v, autoAddOne ? 1 : qty)
                }}
                placeholder="Barkod"
                inputMode="numeric"
                disabled={!canUse || loading || sessionStatus !== 'open'}
              />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sayılan</div>
              <input className="input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="1" disabled={!canUse || loading || autoAddOne} />
            </label>
          </div>
        )}

        <ProductSearchBox
          branchId={branchId}
          disabled={!canUse || loading || !sessionId || sessionStatus !== 'open'}
          onSelect={(p) => {
            if (!sessionId || sessionStatus !== 'open') return
            scan('', autoAddOne ? 1 : qty, { productId: String(p?.id || '') })
          }}
        />

        {!canUse && <div style={{ color: 'var(--muted)' }}>Devam etmek için şube seç.</div>}
        {!sessionId && canUse && <div style={{ color: 'var(--muted)' }}>Sayım başlatınca barkod okutabilirsin.</div>}

        {last && (
          <div className="card" style={{ padding: 12, background: '#f9fafb' }}>
            <div style={{ fontWeight: 800 }}>Son okunan</div>
            <div style={{ fontWeight: 700 }}>{last.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{last.barcode}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Mevcut Stok: {Number(last.stockQty || 0)}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <div style={{ fontWeight: 700 }}>Sayılan</div>
              <div style={{ position: 'relative', zIndex: 5 }}>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  value={uiQtyById[String(last.itemId || '')] ?? String(Number(last.countedQty || 0))}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={() => {
                    const id = String(last.itemId || '')
                    if (!id) return
                    editingIdsRef.current.add(id)
                  }}
                  onBlur={() => {
                    const id = String(last.itemId || '')
                    if (!id) return
                    editingIdsRef.current.delete(id)
                    const v = String((uiQtyById || {})[id] ?? '').trim()
                    if (v !== '') updateRowCountedQty(id, v)
                  }}
                  onChange={(e) => updateRowCountedQty(last.itemId, e.target.value)}
                  disabled={!last.itemId || loading}
                  style={{ width: 120, height: 38, pointerEvents: 'auto' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <div style={{ fontWeight: 700 }}>Fark</div>
              <div style={{ fontWeight: 900 }}>{Number(last.countedQty || 0) - Number(last.stockQty || 0)}</div>
            </div>
          </div>
        )}
      </div>

      {canViewHistory && (
        <div className="card" style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700 }}>Geçmiş Sayımlar</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="input" value={String(historyRangeDays)} onChange={(e) => setHistoryRangeDays(Number(e.target.value))} style={{ height: 34 }} disabled={!canUse || historyLoading}>
                <option value={7}>Son 7 gün</option>
                <option value={30}>Son 30 gün</option>
                <option value={0}>Tümü</option>
              </select>
              <button className="btn btn--compact" type="button" onClick={loadHistory} disabled={!canUse || historyLoading}>Yenile</button>
            </div>
          </div>
          {!!historyError && <div style={{ color: '#b91c1c' }}>{historyError}</div>}
          <div style={{ display: 'grid', gap: 8 }}>
            {(historyItems || []).map(h => {
              const createdAt = h?.createdAt ? new Date(h.createdAt).toLocaleString('tr-TR') : '-'
              const who = h?.createdBy?.name ? String(h.createdBy.name) : '-'
              const lineCount = Number(h?.lineCount || 0)
              const diff = Number(h?.totalDiff || 0)
              const status = h?.status === 'completed' ? 'Tamamlandı' : (h?.status === 'open' ? 'Devam ediyor' : 'Hazır')
              return (
                <button key={h.id} type="button" className="btn btn--full btn--between" onClick={() => openDetail(h.id)} disabled={!canUse || historyLoading} style={{ justifyContent: 'space-between' }}>
                  <span style={{ display: 'grid', textAlign: 'left' }}>
                    <span style={{ fontWeight: 800 }}>{createdAt}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>Yapan: {who} • Satır: {lineCount} • Durum: {status}</span>
                  </span>
                  <span style={{ fontWeight: 800, whiteSpace: 'nowrap', color: diff < 0 ? '#ef4444' : (diff > 0 ? '#16a34a' : 'var(--text)') }}>{diff > 0 ? `+${diff}` : diff}</span>
                </button>
              )
            })}
            {!historyLoading && historyItems.length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
          </div>
        </div>
      )}

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Sayım Detayı">
        <div style={{ display: 'grid', gap: 10 }}>
          {detailLoading && <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>}
          {!!detailError && <div style={{ color: '#b91c1c' }}>{detailError}</div>}
          {detail?.count && (
            <div className="card" style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontWeight: 800 }}>{detail.count.createdAt ? new Date(detail.count.createdAt).toLocaleString('tr-TR') : ''}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>Yapan: {detail.count.createdBy?.name || '-'} • Durum: {detail.count.status === 'completed' ? 'Tamamlandı' : (detail.count.status === 'open' ? 'Devam ediyor' : 'Hazır')}</div>
            </div>
          )}
          {(detail?.lines || []).map(l => (
            <div key={`${l.productId}_${l.barcode}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div className="breakAny" style={{ fontWeight: 800 }}>{l.name || '-'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{l.barcode || '-'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                  Sistem: {l.systemQty === null || l.systemQty === undefined ? '-' : Number(l.systemQty || 0)}
                  {' • '}
                  Sayılan: {l.countedQty === null || l.countedQty === undefined ? '-' : Number(l.countedQty || 0)}
                  {' • '}
                  Fark: {l.diff === null || l.diff === undefined ? '-' : Number(l.diff || 0)}
                </div>
              </div>
              {(() => {
                const d = l.diff === null || l.diff === undefined ? null : Number(l.diff)
                const ok = d !== null && Number.isFinite(d)
                const text = ok ? (d > 0 ? `+${d}` : String(d)) : '-'
                const color = !ok ? 'var(--muted)' : (d < 0 ? '#ef4444' : (d > 0 ? '#16a34a' : 'var(--text)'))
                return <div style={{ fontWeight: 800, whiteSpace: 'nowrap', color }}>{text}</div>
              })()}
            </div>
          ))}
          {!detailLoading && detail && (detail.lines || []).length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
        </div>
      </Modal>

      {!!sessionId && (
        <div className="card" style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Okunanlar</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {rows.map(it => (
              <div key={it.itemId || it.barcode} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{it.name || '-'}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{it.barcode}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>Mevcut Stok: {Number(it.stockQty || 0)} • Fark: {Number(it.countedQty || 0) - Number(it.stockQty || 0)}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{it.saving ? 'Kaydediliyor...' : (it.savedAt ? 'Kaydedildi' : '')}</div>
                </div>
                <div style={{ position: 'relative', zIndex: 5 }}>
                  <input
                    className="input"
                    type="text"
                    inputMode="numeric"
                    value={uiQtyById[String(it.itemId || '')] ?? String(Number(it.countedQty || 0))}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => {
                      const id = String(it.itemId || '')
                      if (!id) return
                      editingIdsRef.current.add(id)
                    }}
                    onBlur={() => {
                      const id = String(it.itemId || '')
                      if (!id) return
                      editingIdsRef.current.delete(id)
                      const v = String((uiQtyById || {})[id] ?? '').trim()
                      if (v !== '') updateRowCountedQty(id, v)
                    }}
                    onChange={(e) => updateRowCountedQty(it.itemId, e.target.value)}
                    disabled={!it.itemId || loading}
                    style={{ width: 120, height: 38, pointerEvents: 'auto' }}
                  />
                </div>
              </div>
            ))}
            {rows.length === 0 && <div style={{ color: 'var(--muted)' }}>Henüz barkod okunmadı</div>}
          </div>
        </div>
      )}

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, alignItems: 'start' }}>
          <CountList title="Fazla" items={extra} />
          <CountList title="Eksik" items={missing} />
          <CountList title="Aynı" items={same} />
        </div>
      )}
    </div>
  )
}

function StockCountPanelLegacyLike({ branchId, onScanRef, me, isCompact = false }) {
  const barcodeRef = useRef(null)
  const [barcode, setBarcode] = useState('')
  const [qty, setQty] = useState('')
  const [autoAddOne, setAutoAddOne] = useState(true)
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [sessionStatus, setSessionStatus] = useState('')
  const [last, setLast] = useState(null)
  const [rows, setRows] = useState([])
  const [uiQtyById, setUiQtyById] = useState({})
  const editingIdsRef = useRef(new Set())
  const [summary, setSummary] = useState(null)
  const saveTimersRef = useRef(new Map())
  const lastCommittedRef = useRef(new Map())
  const [previewProduct, setPreviewProduct] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [historyItems, setHistoryItems] = useState([])
  const [historyRangeDays, setHistoryRangeDays] = useState(30)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detail, setDetail] = useState(null)

  const canUse = String(branchId || '').trim().length > 0
  const canViewHistory = (() => {
    try {
      const role = me?.role
      const perms = Array.isArray(me?.permissions) ? me.permissions : []
      return role === 'tenant_admin' || perms.includes('canteen_stock_count_view')
    } catch {
      return false
    }
  })()

  const storageKey = useMemo(() => {
    const bid = String(branchId || '').trim()
    return bid ? `canteen_stock_count_session_${bid}` : ''
  }, [branchId])

  const statusMeta = useMemo(() => getCountStatusMeta(sessionStatus, summary), [sessionStatus, summary])
  const extra = useMemo(() => Array.isArray(summary?.extra) ? summary.extra : [], [summary])
  const missing = useMemo(() => Array.isArray(summary?.missing) ? summary.missing : [], [summary])
  const same = useMemo(() => Array.isArray(summary?.same) ? summary.same : [], [summary])
  const totalCounted = useMemo(() => rows.reduce((sum, item) => sum + Number(item?.countedQty || 0), 0), [rows])
  const totalDiff = useMemo(() => rows.reduce((sum, item) => sum + Number((item?.diff ?? (Number(item?.countedQty || 0) - Number(item?.stockQty || 0))) || 0), 0), [rows])
  const summaryLegend = [
    { label: 'Tam', color: '#0ac200', count: same.length },
    { label: 'Eksik', color: '#ff1414', count: missing.length },
    { label: 'Fazla', color: '#1300d8', count: extra.length }
  ]

  const focusBarcode = () => {
    try { barcodeRef.current?.focus() } catch {}
  }

  const lookupBarcodeProduct = async (barcodeRaw) => {
    const code = String(barcodeRaw || '').trim()
    if (!canUse || !code) {
      setPreviewProduct(null)
      return null
    }
    const res = await api(`/api/canteen/products/by-barcode/${encodeURIComponent(code)}`, {
      silent: true,
      headers: { 'x-branch-id': String(branchId) }
    })
    if (!res?.ok || !res?.product) {
      setPreviewProduct(null)
      return null
    }
    const found = {
      id: String(res.product.id || ''),
      name: String(res.product.name || ''),
      barcode: String(res.product.barcode || code),
      stockQty: Number(res.product.stockQty || 0)
    }
    setPreviewProduct(found)
    return found
  }

  const hydrateSummary = (summaryData, fallbackId = '') => {
    const items = mapCountSummaryItems(summaryData?.items)
    setSessionId(String(summaryData?.session?.id || fallbackId || ''))
    setSessionStatus(String(summaryData?.session?.status || ''))
    setSummary(summaryData || null)
    setRows(items)
    setUiQtyById((prev) => {
      const next = { ...(prev || {}) }
      for (const it of items) {
        const id = String(it.itemId || '')
        if (!id || editingIdsRef.current.has(id)) continue
        next[id] = String(Number(it.countedQty || 0))
      }
      return next
    })
    for (const it of items) {
      lastCommittedRef.current.set(String(it.itemId || ''), Number(it.countedQty || 0))
    }
  }

  const loadHistory = async () => {
    if (!canUse || !canViewHistory) {
      setHistoryItems([])
      setHistoryError('')
      return
    }
    setHistoryLoading(true)
    setHistoryError('')
    const from = (() => {
      const n = Number(historyRangeDays || 0)
      if (!Number.isFinite(n) || n <= 0) return ''
      const d = new Date()
      d.setDate(d.getDate() - n)
      return d.toISOString()
    })()
    const res = await getStockCounts(branchId, { limit: 20, from })
    if (!res?.ok) {
      setHistoryError(res?.message || 'Geçmiş sayımlar yüklenemedi')
      setHistoryItems([])
      setHistoryLoading(false)
      return
    }
    setHistoryItems(Array.isArray(res?.items) ? res.items : [])
    setHistoryLoading(false)
  }

  const loadSummary = async (sid) => {
    const id = String(sid || '').trim()
    if (!id) return
    const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(id)}/summary`, { headers: { 'x-branch-id': String(branchId) }, silent: true })
    if (!res?.ok || !res?.summary) {
      try { if (storageKey) localStorage.removeItem(storageKey) } catch {}
      setSessionId('')
      setSessionStatus('')
      setSummary(null)
      setRows([])
      setLast(null)
      return
    }
    hydrateSummary(res.summary, id)
  }

  const openDetail = async (id) => {
    const sid = String(id || '').trim()
    if (!sid || !canUse || !canViewHistory) return
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError('')
    setDetail(null)
    const res = await getStockCountDetail(branchId, sid)
    setDetailLoading(false)
    if (!res?.ok) {
      setDetailError(res?.message || 'Detay yüklenemedi')
      return
    }
    setDetail({ count: res?.count || null, lines: Array.isArray(res?.lines) ? res.lines : [] })
  }

  useEffect(() => {
    const t = setTimeout(() => focusBarcode(), 0)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    setSessionId('')
    setSessionStatus('')
    setSummary(null)
    setRows([])
    setUiQtyById({})
    editingIdsRef.current = new Set()
    setLast(null)
    setBarcode('')
    setQty('')
    setAutoAddOne(true)
  }, [branchId])

  useEffect(() => {
    loadHistory()
  }, [canUse, canViewHistory, historyRangeDays, branchId])

  useEffect(() => {
    if (!canUse) return
    try {
      const sid = storageKey ? String(localStorage.getItem(storageKey) || '') : ''
      if (sid) loadSummary(sid)
    } catch {}
  }, [canUse, storageKey])

  useEffect(() => {
    if (!onScanRef) return
    onScanRef.current = (code) => {
      if (!canUse || sessionStatus !== 'open' || !sessionId) return
      const c = String(code || '').trim()
      if (!c) return
      scan(c, autoAddOne ? 1 : qty)
    }
    return () => {
      if (onScanRef.current) onScanRef.current = null
    }
  }, [onScanRef, canUse, sessionId, qty, sessionStatus, autoAddOne])

  const start = async () => {
    if (!canUse) return toast.error('Şube seç')
    setLoading(true)
    const res = await api('/api/canteen/stock-counts', { method: 'POST', headers: { 'x-branch-id': String(branchId) }, silent: true })
    if (!res?.ok || !res?.sessionId) {
      toast.error(res?.message || 'Sayım başlatılamadı')
      setLoading(false)
      return
    }
    setSessionId(String(res.sessionId))
    setSessionStatus('open')
    setSummary(null)
    setRows([])
    setLast(null)
    setBarcode('')
    setQty('')
    try { if (storageKey) localStorage.setItem(storageKey, String(res.sessionId)) } catch {}
    setLoading(false)
    focusBarcode()
  }

  const scan = async (codeRaw, qtyRaw, opts = {}) => {
    if (!canUse) return
    if (!sessionId) return toast.error('Önce sayım başlat')
    if (sessionStatus !== 'open') return
    const code = String(codeRaw || '').trim()
    const productId = String(opts?.productId || '').trim()
    if (!code && !productId) return
    const q = qtyRaw === undefined || qtyRaw === null || String(qtyRaw).trim() === '' ? 1 : Number(String(qtyRaw).replace(',', '.'))
    if (!Number.isFinite(q) || q <= 0) return toast.error('Miktar geçersiz')
    setLoading(true)
    const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(sessionId)}/scan`, {
      method: 'POST',
      headers: { 'x-branch-id': String(branchId) },
      data: { qty: q, barcode: productId ? undefined : code, productId: productId || undefined },
      silent: true
    })
    if (!res?.ok) {
      toast.error(res?.code === 'not_found' ? 'Ürün bulunamadı' : (res?.message || 'İşlem başarısız'))
      setLoading(false)
      focusBarcode()
      return
    }
    const itemId = String(res?.item?.itemId || '')
    const bc = String(res?.item?.barcode || code || '')
    const stockQty = Number(res?.product?.stockQty || 0)
    const countedQty = Number(res?.item?.countedQty || 0)
    const row = {
      itemId,
      productId: String(res?.item?.productId || ''),
      barcode: bc,
      name: String(res?.product?.name || ''),
      countedQty,
      stockQty,
      diff: countedQty - stockQty,
      saving: false,
      savedAt: null
    }
    setPreviewProduct({ id: row.productId, name: row.name, barcode: row.barcode, stockQty: row.stockQty })
    setLast(row)
    setRows((prev) => {
      const next = Array.isArray(prev) ? [...prev] : []
      const idx = itemId ? next.findIndex((x) => String(x.itemId) === itemId) : next.findIndex((x) => String(x.barcode) === bc)
      if (idx >= 0) next[idx] = { ...next[idx], ...row }
      else next.unshift(row)
      return next
    })
    if (itemId) lastCommittedRef.current.set(itemId, countedQty)
    if (itemId) {
      setUiQtyById((prev) => {
        if (editingIdsRef.current.has(itemId)) return prev
        return { ...(prev || {}), [itemId]: String(countedQty) }
      })
    }
    setBarcode('')
    setLoading(false)
    focusBarcode()
  }

  const updateRowCountedQty = (itemId, nextQty) => {
    const id = String(itemId || '').trim()
    if (!id) return
    const raw = String(nextQty ?? '')
    if (!/^[0-9]*$/.test(raw)) return

    setUiQtyById((prev) => ({ ...(prev || {}), [id]: raw }))
    setRows((prev) => prev.map((r) => String(r.itemId) === id ? { ...r, saving: true } : r))

    const timers = saveTimersRef.current
    if (timers.has(id)) {
      try { clearTimeout(timers.get(id)) } catch {}
    }
    timers.set(id, setTimeout(async () => {
      if (String(raw || '').trim() === '') {
        setRows((prev2) => prev2.map((r) => String(r.itemId) === id ? { ...r, saving: false } : r))
        return
      }
      const qtyValue = Number(raw)
      if (!Number.isFinite(qtyValue) || qtyValue < 0) {
        setRows((prev2) => prev2.map((r) => String(r.itemId) === id ? { ...r, saving: false } : r))
        return
      }
      const before = lastCommittedRef.current.get(id)
      const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'x-branch-id': String(branchId) },
        data: { countedQty: qtyValue },
        silent: true
      })
      if (!res?.ok || !res?.item) {
        toast.error(res?.message || 'Kaydedilemedi')
        const rollback = Number(before ?? 0)
        setUiQtyById((prev2) => ({ ...(prev2 || {}), [id]: String(rollback) }))
        setRows((prev2) => prev2.map((r) => String(r.itemId) === id ? { ...r, countedQty: rollback, diff: rollback - Number(r.stockQty || 0), saving: false } : r))
        return
      }
      const savedQty = Number(res.item.countedQty || 0)
      lastCommittedRef.current.set(id, savedQty)
      setRows((prev2) => prev2.map((r) => String(r.itemId) === id ? { ...r, countedQty: savedQty, diff: savedQty - Number(r.stockQty || 0), saving: false, savedAt: Date.now() } : r))
      if (!editingIdsRef.current.has(id)) {
        setUiQtyById((prev2) => ({ ...(prev2 || {}), [id]: String(savedQty) }))
      }
      setLast((prevLast) => (prevLast && String(prevLast.itemId) === id) ? { ...prevLast, countedQty: savedQty, diff: savedQty - Number(prevLast.stockQty || 0) } : prevLast)
    }, 400))
  }

  const finish = async () => {
    if (!sessionId) return
    setLoading(true)
    const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(sessionId)}/finish`, { method: 'POST', headers: { 'x-branch-id': String(branchId) }, silent: true })
    if (!res?.ok || !res?.summary) {
      toast.error(res?.message || 'Özet alınamadı')
      setLoading(false)
      return
    }
    hydrateSummary(res.summary, sessionId)
    setLoading(false)
  }

  const apply = async () => {
    if (!sessionId) return
    setLoading(true)
    const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(sessionId)}/apply`, {
      method: 'POST',
      headers: { 'x-branch-id': String(branchId) },
      silent: true
    })
    if (!res?.ok) {
      toast.error(res?.message || 'Uygulanamadı')
      setLoading(false)
      return
    }
    toast.success('Stoğa uygulandı')
    setSessionId('')
    setSessionStatus('')
    setSummary(null)
    setRows([])
    setLast(null)
    setBarcode('')
    setLoading(false)
    try { if (storageKey) localStorage.removeItem(storageKey) } catch {}
    loadHistory()
  }

  const cancelCount = async () => {
    if (!sessionId) return
    setLoading(true)
    const res = await api(`/api/canteen/stock-counts/${encodeURIComponent(sessionId)}/cancel`, {
      method: 'POST',
      headers: { 'x-branch-id': String(branchId) },
      silent: true
    })
    if (!res?.ok) {
      toast.error(res?.message || 'Sayım iptal edilemedi')
      setLoading(false)
      return
    }
    toast.success('Sayım stoğa uygulanmadan kapatıldı')
    setSessionId('')
    setSessionStatus('')
    setSummary(null)
    setRows([])
    setLast(null)
    setPreviewProduct(null)
    setBarcode('')
    setLoading(false)
    try { if (storageKey) localStorage.removeItem(storageKey) } catch {}
    loadHistory()
    focusBarcode()
  }

  return (
    <div className="canteen-legacy-shell" style={{ display: 'grid', gap: 12 }}>
      <div className="card canteen-legacy-panel" style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
          <input type="checkbox" checked={autoAddOne} onChange={(e) => setAutoAddOne(e.target.checked)} />
          Ürün barkodu okutulduktan sonra direkt olarak 1 adet eklesin
        </label>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 260px' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : '128px minmax(0, 1fr)' }}>
              <div style={{ alignSelf: 'center', color: 'var(--legacy-title)', fontWeight: 500, textAlign: isCompact ? 'left' : 'right' }}>Barkod No:</div>
              <input
                ref={barcodeRef}
                className="input"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  const v = String(barcode || '').trim()
                  setBarcode('')
                  scan(v, autoAddOne ? 1 : qty)
                }}
                onBlur={() => {
                  const code = String(barcode || '').trim()
                  if (!code) return
                  lookupBarcodeProduct(code)
                }}
                placeholder="Barkod okut"
                inputMode="numeric"
                disabled={!canUse || loading || sessionStatus !== 'open'}
              />
            </div>

            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : '128px minmax(0, 1fr)' }}>
              <div style={{ alignSelf: 'start', color: 'var(--legacy-title)', fontWeight: 500, textAlign: isCompact ? 'left' : 'right', paddingTop: 8 }}>Ürün Adı</div>
              <ProductSearchBox
                branchId={branchId}
                disabled={!canUse || loading || !sessionId || sessionStatus !== 'open'}
                onSelect={(p) => {
                  setPreviewProduct({
                    id: String(p?.id || ''),
                    name: String(p?.name || ''),
                    barcode: String(p?.barcode || ''),
                    stockQty: Number(p?.stockQty || 0)
                  })
                  if (!sessionId || sessionStatus !== 'open') return
                  scan('', autoAddOne ? 1 : qty, { productId: String(p?.id || '') })
                }}
              />
            </div>

            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : '128px 100px' }}>
              <div style={{ alignSelf: 'center', color: 'var(--legacy-title)', fontWeight: 500, textAlign: isCompact ? 'left' : 'right' }}>Eklenecek Miktar</div>
              <input className="input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="1" disabled={!canUse || loading || autoAddOne || sessionStatus !== 'open'} />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', alignContent: 'start' }}>
            <button className="btn" type="button" onClick={() => {
              const code = String(barcode || '').trim()
              if (!code) {
                focusBarcode()
                return
              }
              lookupBarcodeProduct(code)
            }} disabled={!canUse}>Ara</button>
            <button className="btn btn--primary" type="button" onClick={() => {
              const v = String(barcode || '').trim()
              if (!v) return
              setBarcode('')
              scan(v, autoAddOne ? 1 : qty)
            }} disabled={!canUse || !sessionId || sessionStatus !== 'open' || !String(barcode || '').trim()}>Ekle</button>
            <button className="btn btn--primary" type="button" onClick={start} disabled={!canUse || loading || !!sessionId}>Sayımı Başlat</button>
            <button className="btn" type="button" onClick={finish} disabled={!canUse || loading || !sessionId || sessionStatus !== 'open'}>Sayımı Bitir</button>
            <button className="btn" type="button" onClick={apply} disabled={!canUse || loading || !sessionId || sessionStatus !== 'finished'}>Stoğa Uygula</button>
            <button className="btn" type="button" onClick={cancelCount} disabled={!canUse || loading || !sessionId}>Sayımı İptal Et</button>
            <button className="btn" type="button" onClick={() => historyItems[0] && openDetail(historyItems[0].id)} disabled={!canUse || historyLoading || !historyItems[0]}>Sonucu Gör</button>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--legacy-line-strong)' }} />

        {!canUse && <div style={{ color: 'var(--muted)' }}>Devam etmek için şube seç.</div>}
        {!sessionId && canUse && <div style={{ color: 'var(--muted)' }}>Sayım başlatınca barkod okutabilirsin.</div>}

        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : '120px minmax(0, 1fr) 180px' }}>
          <div style={{ color: 'var(--legacy-title)', fontWeight: 500, alignSelf: 'center', textAlign: isCompact ? 'left' : 'right' }}>Durum</div>
          <div style={{ minHeight: 28, display: 'flex', alignItems: 'center', padding: '0 10px', background: statusMeta.tone, border: '1px solid #d1d5db', color: statusMeta.color, fontWeight: 700 }}>
            {statusMeta.text}
          </div>
          <div style={{ color: statusMeta.color, fontSize: 12, alignSelf: 'center' }}>{statusMeta.detail}</div>
        </div>

        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : '120px minmax(0, 1fr)' }}>
          <div style={{ color: 'var(--legacy-title)', fontWeight: 500, alignSelf: 'center', textAlign: isCompact ? 'left' : 'right' }}>Son Eklenen Ürün</div>
          <div style={{ minHeight: 28, display: 'flex', alignItems: 'center', padding: '0 10px', background: '#d8ffd8', border: '1px solid #d1d5db', color: '#111827', fontWeight: 600 }}>
            {String(last?.name || '').trim() || 'Henüz ürün eklenmedi'}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : '120px minmax(0, 1fr)' }}>
          <div style={{ color: 'var(--legacy-title)', fontWeight: 500, alignSelf: 'center', textAlign: isCompact ? 'left' : 'right' }}>Bulunan Ürün</div>
          <div style={{ minHeight: 28, display: 'flex', alignItems: 'center', padding: '0 10px', background: '#eef6ff', border: '1px solid #d1d5db', color: '#111827', fontWeight: 600 }}>
            {previewProduct?.name ? `${previewProduct.name} • Stok: ${Number(previewProduct.stockQty || 0)}` : 'Barkod aratınca ürün burada görünür'}
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>Sayım Sonucu</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 12 }}>
            <span>Satır: {rows.length}</span>
            <span>Toplam Sayılan: {totalCounted}</span>
            <span style={{ color: getCountDiffColor(totalDiff) }}>Toplam Fark: {totalDiff > 0 ? `+${totalDiff}` : totalDiff}</span>
          </div>
        </div>
        <div className="canteen-stock-table-frame">
          <div className="canteen-stock-table-scroll">
            <div className="canteen-stock-table-grid canteen-stock-table-head" style={{ gridTemplateColumns: '1.15fr 2.4fr 1fr 1fr 1fr 130px' }}>
              <div>Barkod No</div>
              <div>Ürünün Adı</div>
              <div>Sayımdaki</div>
              <div>Stoktaki</div>
              <div>Aradaki Fark</div>
              <div>Düzenle</div>
            </div>
            <div className="canteen-stock-table-grid" style={{ gridTemplateColumns: '1.15fr 2.4fr 1fr 1fr 1fr 130px' }}>
              {rows.map((it) => {
                const diff = Number((it?.diff ?? (Number(it?.countedQty || 0) - Number(it?.stockQty || 0))) || 0)
                return (
                  <div key={it.itemId || it.barcode} className="canteen-stock-table-row">
                    <div className="canteen-stock-table-cell">{it.barcode || '-'}</div>
                    <div className="canteen-stock-table-cell is-name">{it.name || '-'}</div>
                    <div className="canteen-stock-table-cell is-number">{Number(it.countedQty || 0)}</div>
                    <div className="canteen-stock-table-cell is-number">{Number(it.stockQty || 0)}</div>
                    <div className="canteen-stock-table-cell is-number" style={{ color: getCountDiffColor(diff), fontWeight: 800 }}>{diff > 0 ? `+${diff}` : diff}</div>
                    <div className="canteen-stock-table-cell">
                      <input
                        className="input"
                        type="text"
                        inputMode="numeric"
                        value={uiQtyById[String(it.itemId || '')] ?? String(Number(it.countedQty || 0))}
                        onFocus={() => {
                          const id = String(it.itemId || '')
                          if (!id) return
                          editingIdsRef.current.add(id)
                        }}
                        onBlur={() => {
                          const id = String(it.itemId || '')
                          if (!id) return
                          editingIdsRef.current.delete(id)
                          const v = String((uiQtyById || {})[id] ?? '').trim()
                          if (v !== '') updateRowCountedQty(id, v)
                        }}
                        onChange={(e) => updateRowCountedQty(it.itemId, e.target.value)}
                        disabled={!it.itemId || loading || sessionStatus !== 'open'}
                        style={{ width: '100%', minWidth: 84, height: 34, textAlign: 'right' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            {rows.length === 0 ? <div className="canteen-stock-table-empty">Henüz barkod okunmadı</div> : null}
          </div>
        </div>
      </div>

      {summary ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {summaryLegend.map((item) => (
              <div key={item.label} style={{ display: 'flex', minWidth: 120, border: '1px solid var(--legacy-line-strong)' }}>
                <div style={{ width: 36, background: item.color }} />
                <div style={{ flex: 1, padding: '6px 10px', background: '#fff', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span>{item.label}</span>
                  <span style={{ fontWeight: 800 }}>{item.count}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, alignItems: 'start' }}>
            <CountList title="Fazla" items={extra} />
            <CountList title="Eksik" items={missing} />
            <CountList title="Aynı" items={same} />
          </div>
        </div>
      ) : null}

      {canViewHistory ? (
        <div className="card" style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700 }}>Geçmiş Sayımlar</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="input" value={String(historyRangeDays)} onChange={(e) => setHistoryRangeDays(Number(e.target.value))} style={{ height: 34 }} disabled={!canUse || historyLoading}>
                <option value={7}>Son 7 gün</option>
                <option value={30}>Son 30 gün</option>
                <option value={0}>Tümü</option>
              </select>
              <button className="btn btn--compact" type="button" onClick={loadHistory} disabled={!canUse || historyLoading}>Yenile</button>
            </div>
          </div>
          {!!historyError ? <div style={{ color: '#b91c1c' }}>{historyError}</div> : null}
          <div style={{ display: 'grid', gap: 8 }}>
            {(historyItems || []).map((h) => {
              const createdAt = h?.createdAt ? new Date(h.createdAt).toLocaleString('tr-TR') : '-'
              const who = h?.createdBy?.name ? String(h.createdBy.name) : '-'
              const lineCount = Number(h?.lineCount || 0)
              const diff = Number(h?.totalDiff || 0)
              const status = h?.status === 'completed' ? 'Tamamlandı' : (h?.status === 'open' ? 'Devam ediyor' : 'Hazır')
              return (
                <button key={h.id} type="button" className="btn btn--full btn--between" onClick={() => openDetail(h.id)} disabled={!canUse || historyLoading} style={{ justifyContent: 'space-between' }}>
                  <span style={{ display: 'grid', textAlign: 'left' }}>
                    <span style={{ fontWeight: 800 }}>{createdAt}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>Yapan: {who} • Satır: {lineCount} • Durum: {status}</span>
                  </span>
                  <span style={{ fontWeight: 800, whiteSpace: 'nowrap', color: getCountDiffColor(diff) }}>{diff > 0 ? `+${diff}` : diff}</span>
                </button>
              )
            })}
            {!historyLoading && historyItems.length === 0 ? <div style={{ color: 'var(--muted)' }}>Kayıt yok</div> : null}
          </div>
        </div>
      ) : null}

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Sayım Detayı">
        <div style={{ display: 'grid', gap: 10 }}>
          {detailLoading ? <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div> : null}
          {!!detailError ? <div style={{ color: '#b91c1c' }}>{detailError}</div> : null}
          {detail?.count ? (
            <div className="card" style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontWeight: 800 }}>{detail.count.createdAt ? new Date(detail.count.createdAt).toLocaleString('tr-TR') : ''}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>Yapan: {detail.count.createdBy?.name || '-'} • Durum: {detail.count.status === 'completed' ? 'Tamamlandı' : (detail.count.status === 'open' ? 'Devam ediyor' : 'Hazır')}</div>
            </div>
          ) : null}
          {(detail?.lines || []).map((l) => (
            <div key={`${l.productId}_${l.barcode}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div className="breakAny" style={{ fontWeight: 800 }}>{l.name || '-'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{l.barcode || '-'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                  Sistem: {l.systemQty === null || l.systemQty === undefined ? '-' : Number(l.systemQty || 0)}
                  {' • '}
                  Sayılan: {l.countedQty === null || l.countedQty === undefined ? '-' : Number(l.countedQty || 0)}
                  {' • '}
                  Fark: {l.diff === null || l.diff === undefined ? '-' : Number(l.diff || 0)}
                </div>
              </div>
              <div style={{ fontWeight: 800, whiteSpace: 'nowrap', color: getCountDiffColor(Number(l.diff || 0)) }}>
                {Number(l.diff || 0) > 0 ? `+${Number(l.diff || 0)}` : Number(l.diff || 0)}
              </div>
            </div>
          ))}
          {!detailLoading && detail && (detail.lines || []).length === 0 ? <div style={{ color: 'var(--muted)' }}>Kayıt yok</div> : null}
        </div>
      </Modal>
    </div>
  )
}

function ProductSearchBox({ branchId, onSelect, disabled, inputClassName = '', selectedLabel = '', selectedKey = '' }) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const abortRef = useRef(null)
  const lastKeyRef = useRef('')
  const suppressSearchRef = useRef(false)

  useEffect(() => {
    suppressSearchRef.current = true
    setQ(String(selectedLabel || ''))
    setItems([])
    setLoading(false)
    lastKeyRef.current = ''
    try { abortRef.current?.abort() } catch {}
    abortRef.current = null
  }, [selectedLabel, selectedKey])

  useEffect(() => {
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false
      return
    }

    const term = String(q || '').trim()
    if (term.length < 2) {
      setItems([])
      setLoading(false)
      lastKeyRef.current = ''
      try { abortRef.current?.abort() } catch {}
      abortRef.current = null
      return
    }

    const key = `q:${term.toLowerCase()}`
    if (lastKeyRef.current === key) return
    lastKeyRef.current = key

    try { abortRef.current?.abort() } catch {}
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    const t = setTimeout(() => {
      api(`/api/canteen/products/search?q=${encodeURIComponent(term)}&limit=20`, { silent: true, headers: { 'x-branch-id': String(branchId) }, signal: controller.signal })
        .then((res) => {
          setItems(Array.isArray(res?.items) ? res.items : [])
          setLoading(false)
        })
        .catch((err) => {
          if (err?.name !== 'AbortError') setLoading(false)
        })
    }, 350)

    return () => {
      clearTimeout(t)
      try { controller.abort() } catch {}
    }
  }, [q, branchId])

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ürün ara</div>
        <input className={`input ${inputClassName}`.trim()} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ürün ara (isim ile)" disabled={disabled} />
      </label>
      {(loading || items.length > 0) && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {loading && <div style={{ padding: 10, color: 'var(--muted)' }}>Aranıyor...</div>}
          {items.slice(0, 20).map(p => (
            <button
              key={p.id}
              type="button"
              className="btn btn--full btn--between"
              onClick={() => {
                suppressSearchRef.current = true
                setQ(String(p?.name || ''))
                setItems([])
                onSelect?.(p)
              }}
              disabled={disabled}
              style={{ justifyContent: 'space-between' }}
            >
              <span style={{ display: 'grid', textAlign: 'left' }}>
                <span style={{ fontWeight: 800 }}>{p.name}</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>{p.barcode ? `Barkod: ${p.barcode}` : ''}{`  `}Stok: {Number(p.stockQty || 0)}</span>
              </span>
              <span style={{ color: 'var(--muted)' }}>{money(p.price)} ₺</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StockHistoryPanelLegacy({ branchId, me, isCompact = false }) {
  const perms = Array.isArray(me?.permissions) ? me.permissions : []
  const canUse = String(branchId || '').trim().length > 0
  const canViewCountHistory = me?.role === 'tenant_admin' || perms.includes('canteen_stock_count_view')
  const canViewSaleDetail = me?.role === 'tenant_admin' || perms.includes('canteen_pos_access') || perms.includes('canteen_sales_view') || perms.includes('canteen_reports_view') || perms.includes('canteen_customers_view') || perms.includes('canteen_customers_manage')

  const [historyRangeDays, setHistoryRangeDays] = useState(30)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countItems, setCountItems] = useState([])
  const [movementItems, setMovementItems] = useState([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailKind, setDetailKind] = useState('')
  const [detailData, setDetailData] = useState(null)

  const incomingItems = useMemo(
    () => movementItems.filter((item) => String(item?.type || '') === 'in' && !isSaleRelatedMovement(item?.note)),
    [movementItems]
  )
  const outgoingItems = useMemo(() => movementItems.filter((item) => String(item?.type || '') === 'out' || String(item?.type || '') === 'waste'), [movementItems])
  const adjustmentItems = useMemo(() => movementItems.filter((item) => String(item?.type || '') === 'adjust'), [movementItems])

  const groupedCountDays = useMemo(() => {
    const groups = new Map()
    for (const item of countItems || []) {
      const key = dateKeyFromValue(item?.createdAt)
      if (!key) continue
      const current = groups.get(key) || { key, label: dateLabelFromKey(key), sessions: [], lineCount: 0, totalDiff: 0 }
      current.sessions.push(item)
      current.lineCount += Number(item?.lineCount || 0)
      current.totalDiff += Number(item?.totalDiff || 0)
      groups.set(key, current)
    }
    return Array.from(groups.values()).sort((a, b) => String(b.key).localeCompare(String(a.key)))
  }, [countItems])

  const groupedIncomingDays = useMemo(() => {
    const groups = new Map()
    for (const item of incomingItems || []) {
      const key = dateKeyFromValue(item?.createdAt)
      if (!key) continue
      const current = groups.get(key) || { key, label: dateLabelFromKey(key), items: [], totalQty: 0 }
      current.items.push(item)
      current.totalQty += Number(item?.qty || 0)
      groups.set(key, current)
    }
    return Array.from(groups.values()).sort((a, b) => String(b.key).localeCompare(String(a.key)))
  }, [incomingItems])

  const groupedOutgoingDays = useMemo(() => {
    const groups = new Map()
    for (const item of outgoingItems || []) {
      const key = dateKeyFromValue(item?.createdAt)
      if (!key) continue
      const current = groups.get(key) || { key, label: dateLabelFromKey(key), items: [], totalQty: 0 }
      current.items.push(item)
      current.totalQty += Number(item?.qty || 0)
      groups.set(key, current)
    }
    return Array.from(groups.values()).sort((a, b) => String(b.key).localeCompare(String(a.key)))
  }, [outgoingItems])

  const rangeFrom = useMemo(() => {
    const n = Number(historyRangeDays || 0)
    if (!Number.isFinite(n) || n <= 0) return ''
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d.toISOString()
  }, [historyRangeDays])

  const loadHistory = async () => {
    if (!canUse) {
      setCountItems([])
      setMovementItems([])
      setError('')
      return
    }
    setLoading(true)
    setError('')
    const [countRes, movementRes] = await Promise.all([
      canViewCountHistory ? getStockCounts(branchId, { limit: 30, from: rangeFrom }) : Promise.resolve({ ok: true, items: [] }),
      api(`/api/canteen/stock/movements?branchId=${encodeURIComponent(String(branchId))}${rangeFrom ? `&from=${encodeURIComponent(rangeFrom)}` : ''}`, { silent: true })
    ])
    let nextError = ''
    if (!countRes?.ok && canViewCountHistory) nextError = countRes?.message || 'Sayım geçmişi yüklenemedi'
    if (!movementRes?.ok && !nextError) nextError = movementRes?.message || 'Hareket geçmişi yüklenemedi'
    setError(nextError)
    setCountItems(Array.isArray(countRes?.items) ? countRes.items : [])
    setMovementItems(Array.isArray(movementRes?.items) ? movementRes.items : [])
    setLoading(false)
  }

  useEffect(() => {
    loadHistory()
  }, [branchId, historyRangeDays, canUse, canViewCountHistory])

  const openCountDetail = async (id) => {
    if (!canUse) return
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError('')
    setDetailKind('count')
    setDetailData(null)
    const res = await getStockCountDetail(branchId, id)
    setDetailLoading(false)
    if (!res?.ok) {
      setDetailError(res?.message || 'Sayım detayı yüklenemedi')
      return
    }
    setDetailData(res)
  }

  const openCountDayDetail = async (group) => {
    const sessions = Array.isArray(group?.sessions) ? group.sessions : []
    if (!sessions.length || !canUse) return
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError('')
    setDetailKind('count-day')
    setDetailData({ dateKey: group.key, dateLabel: group.label, sessions: [] })
    const responses = await Promise.all(sessions.map((session) => getStockCountDetail(branchId, session.id)))
    const failed = responses.find((res) => !res?.ok)
    setDetailLoading(false)
    if (failed) {
      setDetailError(failed?.message || 'Sayım detayları yüklenemedi')
      return
    }
    setDetailData({
      dateKey: group.key,
      dateLabel: group.label,
      sessions: responses.map((res, index) => ({
        summary: sessions[index],
        count: res?.count || null,
        lines: Array.isArray(res?.lines) ? res.lines : []
      }))
    })
  }

  const openMovementDayDetail = (kind, group) => {
    setDetailOpen(true)
    setDetailLoading(false)
    setDetailError('')
    setDetailKind(kind)
    setDetailData({
      dateKey: group?.key || '',
      dateLabel: group?.label || '-',
      items: Array.isArray(group?.items) ? group.items : []
    })
  }

  const openMovementDetail = async (item) => {
    setDetailOpen(true)
    setDetailLoading(false)
    setDetailError('')
    setDetailKind('movement')
    setDetailData(item)
    if (isSaleMovement(item?.note) && canViewSaleDetail) {
      const saleId = String(item?.note || '').split(':')[1] || ''
      if (saleId) {
        setDetailLoading(true)
        const res = await getSaleDetail(branchId, saleId)
        setDetailLoading(false)
        if (res?.ok && res?.sale) {
          setDetailKind('sale')
          setDetailData({ movement: item, sale: res.sale })
        } else {
          setDetailError(res?.message || 'Satış detayı yüklenemedi')
        }
      }
    }
  }

  const downloadDetail = () => {
    if (!detailData) return
    const rows = []
    if (detailKind === 'count-day') {
      rows.push(['Tarih', 'Sayım Saati', 'Ürün', 'Barkod', 'Sistem Stok', 'Sayım Sonucu', 'Fark'])
      for (const session of detailData.sessions || []) {
        for (const line of session.lines || []) {
          rows.push([
            detailData.dateLabel || '-',
            fmtDateTime(session?.count?.createdAt || session?.summary?.createdAt || '').split(' ').slice(1).join(' '),
            line?.name || '-',
            line?.barcode || '-',
            String(Number(line?.systemQty || 0)),
            String(Number(line?.countedQty || 0)),
            String(Number(line?.diff || 0))
          ])
        }
      }
    } else if (detailKind === 'incoming-day' || detailKind === 'outgoing-day') {
      rows.push(['Tarih', 'Saat', 'Ürün', 'Barkod', 'İşlem', 'Miktar', 'Kaynak', 'Not'])
      for (const item of detailData.items || []) {
        const parts = fmtDateTime(item?.createdAt).split(' ')
        rows.push([
          detailData.dateLabel || '-',
          parts.slice(1).join(' '),
          item?.productName || '-',
          item?.barcode || '-',
          stockActionLabel(item?.type),
          String(Number(item?.qty || 0)),
          stockSourceLabel(item?.note),
          stockNoteLabel(item?.note)
        ])
      }
    } else if (detailKind === 'sale' && detailData?.sale) {
      rows.push(['Tarih', 'Satış No', 'Ürün', 'Adet', 'Birim Fiyat', 'Tutar'])
      for (const item of detailData.sale.items || []) {
        rows.push([
          fmtDateTime(detailData.sale.createdAt),
          detailData.sale.saleNo || '-',
          item?.name || '-',
          String(Number(item?.qty || 0)),
          String(Number(item?.unitPrice || 0)),
          String(Number(item?.lineTotal || 0))
        ])
      }
    }
    if (!rows.length) return
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';')).join('\n')
    downloadBlob(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }), `stok-gecmisi-${detailData?.dateKey || Date.now()}.csv`)
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Geçmiş Kayıtlar</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Sayımlar, ürün girişleri ve satış çıkışlarını tarih bazlı inceleyin.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="input" value={String(historyRangeDays)} onChange={(e) => setHistoryRangeDays(Number(e.target.value))} style={{ height: 36 }}>
              <option value={7}>Son 7 gün</option>
              <option value={30}>Son 30 gün</option>
              <option value={90}>Son 90 gün</option>
              <option value={0}>Tümü</option>
            </select>
            <button className="btn btn--compact" type="button" onClick={loadHistory} disabled={!canUse || loading}>Yenile</button>
          </div>
        </div>
        {!!error && <div style={{ color: '#b91c1c' }}>{error}</div>}
        {!canUse ? <div style={{ color: 'var(--muted)' }}>Devam etmek için şube seç.</div> : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <HistorySectionCard title="Yapılan Sayımlar" items={countItems} emptyText="Sayım kaydı yok" loading={loading}>
          {(countItems || []).map((item) => (
            <button key={item.id} type="button" className="btn btn--full btn--between" onClick={() => openCountDetail(item.id)} disabled={!canUse || loading} style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'grid', textAlign: 'left' }}>
                <span style={{ fontWeight: 800 }}>{fmtDateTime(item.createdAt)}</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>Yapan: {item?.createdBy?.name || '-'} • Satır: {Number(item?.lineCount || 0)}</span>
              </span>
              <span style={{ fontWeight: 800 }}>{Number(item?.totalDiff || 0) > 0 ? `+${Number(item?.totalDiff || 0)}` : Number(item?.totalDiff || 0)}</span>
            </button>
          ))}
        </HistorySectionCard>

        <HistorySectionCard title="Alınan Ürün Girişleri" items={incomingItems} emptyText="Ürün giriş kaydı yok" loading={loading}>
          {incomingItems.map((item) => (
            <MovementHistoryButton key={item.id} item={item} onClick={() => openMovementDetail(item)} disabled={!canUse || loading} />
          ))}
        </HistorySectionCard>

        <HistorySectionCard title="Satılan Ürün Çıkışları" items={outgoingItems} emptyText="Çıkış kaydı yok" loading={loading}>
          {outgoingItems.map((item) => (
            <MovementHistoryButton key={item.id} item={item} onClick={() => openMovementDetail(item)} disabled={!canUse || loading} />
          ))}
        </HistorySectionCard>
      </div>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={detailKind === 'sale' ? 'Satış Detayı' : detailKind === 'count' ? 'Sayım Detayı' : 'Hareket Detayı'} dialogStyle={{ width: isCompact ? 'calc(100% - 4px)' : 'min(760px, calc(100vw - 20px))', maxWidth: '100%', maxHeight: isCompact ? 'calc(100dvh - 4px)' : 'calc(100dvh - 24px)', justifySelf: 'center' }} bodyStyle={{ padding: isCompact ? 2 : 22 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          {detailLoading ? <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div> : null}
          {!!detailError ? <div style={{ color: '#b91c1c' }}>{detailError}</div> : null}

          {detailKind === 'count' && detailData?.count ? (
            <>
              <div className="card" style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontWeight: 800 }}>{fmtDateTime(detailData.count.createdAt)}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Yapan: {detailData.count?.createdBy?.name || '-'} • Durum: {detailData.count?.status || '-'}</div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {(detailData.lines || []).map((line) => (
                  <div key={`${line.productId}_${line.barcode}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{line.name || '-'}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{line.barcode || '-'}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>Sistem: {Number(line.systemQty || 0)} • Sayılan: {Number(line.countedQty || 0)}</div>
                    </div>
                    <div style={{ fontWeight: 900 }}>{Number(line.diff || 0) > 0 ? `+${Number(line.diff || 0)}` : Number(line.diff || 0)}</div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {detailKind === 'movement' && detailData ? (
            <MovementDetailCard item={detailData} />
          ) : null}

          {detailKind === 'sale' && detailData?.sale ? (
            <>
              <MovementDetailCard item={detailData.movement} />
              <div className="card" style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 800 }}>{detailData.sale.saleNo || 'Satış'}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtDateTime(detailData.sale.createdAt)} • {detailData.sale.cashierName || '-'}</div>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {(detailData.sale.items || []).map((saleItem, index) => (
                    <div key={`${saleItem.productId || saleItem.name || index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{saleItem.name || '-'}</div>
                        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{money(saleItem.unitPrice || 0)} TL</div>
                      </div>
                      <div style={{ fontWeight: 700 }}>{Number(saleItem.qty || 0)} adet</div>
                      <div style={{ fontWeight: 900 }}>{money(saleItem.lineTotal || 0)} TL</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </Modal>
    </div>
  )
}

function StockHistoryPanel({ branchId, me, isCompact = false }) {
  const perms = Array.isArray(me?.permissions) ? me.permissions : []
  const canUse = String(branchId || '').trim().length > 0
  const canViewCountHistory = me?.role === 'tenant_admin' || perms.includes('canteen_stock_count_view')
  const canViewSaleDetail = me?.role === 'tenant_admin' || perms.includes('canteen_pos_access') || perms.includes('canteen_sales_view') || perms.includes('canteen_reports_view') || perms.includes('canteen_customers_view') || perms.includes('canteen_customers_manage')

  const [historyRangeDays, setHistoryRangeDays] = useState(30)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countItems, setCountItems] = useState([])
  const [movementItems, setMovementItems] = useState([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailKind, setDetailKind] = useState('')
  const [detailData, setDetailData] = useState(null)

  const rangeFrom = useMemo(() => {
    const n = Number(historyRangeDays || 0)
    if (!Number.isFinite(n) || n <= 0) return ''
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d.toISOString()
  }, [historyRangeDays])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!canUse) {
        setCountItems([])
        setMovementItems([])
        setError('')
        return
      }
      setLoading(true)
      setError('')
      const [countRes, movementRes] = await Promise.all([
        canViewCountHistory ? getStockCounts(branchId, { limit: 60, from: rangeFrom }) : Promise.resolve({ ok: true, items: [] }),
        api(`/api/canteen/stock/movements?branchId=${encodeURIComponent(String(branchId))}${rangeFrom ? `&from=${encodeURIComponent(rangeFrom)}` : ''}`, { silent: true })
      ])
      if (cancelled) return
      let nextError = ''
      if (!countRes?.ok && canViewCountHistory) nextError = countRes?.message || 'Sayım geçmişi yüklenemedi'
      if (!movementRes?.ok && !nextError) nextError = movementRes?.message || 'Hareket geçmişi yüklenemedi'
      setError(nextError)
      setCountItems(Array.isArray(countRes?.items) ? countRes.items : [])
      setMovementItems(Array.isArray(movementRes?.items) ? movementRes.items : [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [branchId, canUse, canViewCountHistory, rangeFrom, refreshKey])

  const incomingItems = useMemo(
    () => movementItems.filter((item) => String(item?.type || '') === 'in' && !isSaleRelatedMovement(item?.note)),
    [movementItems]
  )
  const outgoingItems = useMemo(() => movementItems.filter((item) => String(item?.type || '') === 'out' || String(item?.type || '') === 'waste'), [movementItems])
  const adjustmentItems = useMemo(() => movementItems.filter((item) => String(item?.type || '') === 'adjust'), [movementItems])

  const groupDays = (items, mode) => {
    const groups = new Map()
    for (const item of items || []) {
      const key = dateKeyFromValue(item?.createdAt)
      if (!key) continue
      const base = groups.get(key) || { key, label: dateLabelFromKey(key), items: [], totalQty: 0, lineCount: 0, totalDiff: 0, sessions: [] }
      if (mode === 'count') {
        base.sessions.push(item)
        base.lineCount += Number(item?.lineCount || 0)
        base.totalDiff += Number(item?.totalDiff || 0)
      } else {
        base.items.push(item)
        base.totalQty += Number(item?.qty || 0)
      }
      groups.set(key, base)
    }
    return Array.from(groups.values()).sort((a, b) => String(b.key).localeCompare(String(a.key)))
  }

  const countDays = useMemo(() => groupDays(countItems, 'count'), [countItems])
  const incomingDays = useMemo(() => groupDays(incomingItems, 'movement'), [incomingItems])
  const outgoingDays = useMemo(() => groupDays(outgoingItems, 'movement'), [outgoingItems])
  const adjustmentDays = useMemo(() => groupDays(adjustmentItems, 'movement'), [adjustmentItems])

  const openCountDetail = async (id) => {
    const sid = String(id || '').trim()
    if (!sid || !canUse) return
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError('')
    setDetailKind('count')
    setDetailData(null)
    const res = await getStockCountDetail(branchId, sid)
    setDetailLoading(false)
    if (!res?.ok) {
      setDetailError(res?.message || 'Sayım detayı yüklenemedi')
      return
    }
    setDetailData(res)
  }

  const openCountDay = async (group) => {
    const sessions = Array.isArray(group?.sessions) ? group.sessions : []
    if (!sessions.length || !canUse) return
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError('')
    setDetailKind('count-day')
    setDetailData({ dateKey: group.key, dateLabel: group.label, sessions: [] })
    const results = await Promise.all(sessions.map((session) => getStockCountDetail(branchId, session.id)))
    setDetailLoading(false)
    const failed = results.find((res) => !res?.ok)
    if (failed) {
      setDetailError(failed?.message || 'Sayım detayları yüklenemedi')
      return
    }
    setDetailData({
      dateKey: group.key,
      dateLabel: group.label,
      sessions: results.map((res, index) => ({
        summary: sessions[index],
        count: res?.count || null,
        lines: Array.isArray(res?.lines) ? res.lines : []
      }))
    })
  }

  const openMovementDay = (kind, group) => {
    setDetailOpen(true)
    setDetailLoading(false)
    setDetailError('')
    setDetailKind(kind)
    setDetailData({ dateKey: group?.key || '', dateLabel: group?.label || '-', items: Array.isArray(group?.items) ? group.items : [] })
  }

  const openMovementDetail = async (item) => {
    setDetailOpen(true)
    setDetailLoading(false)
    setDetailError('')
    setDetailKind('movement')
    setDetailData(item)
    if (isSaleMovement(item?.note) && canViewSaleDetail) {
      const saleId = String(item?.note || '').split(':')[1] || ''
      if (!saleId) return
      setDetailLoading(true)
      const res = await getSaleDetail(branchId, saleId)
      setDetailLoading(false)
      if (!res?.ok || !res?.sale) {
        setDetailError(res?.message || 'Satış detayı yüklenemedi')
        return
      }
      setDetailKind('sale')
      setDetailData({ movement: item, sale: res.sale, dateKey: dateKeyFromValue(item?.createdAt) })
    }
  }

  const downloadDetail = () => {
    if (!detailData) return
    const rows = []
    if (detailKind === 'count-day') {
      rows.push(['Tarih', 'Saat', 'Ürün', 'Barkod', 'Sistem Stok', 'Sayım Sonucu', 'Fark'])
      for (const session of detailData.sessions || []) {
        for (const line of session.lines || []) {
          rows.push([
            detailData.dateLabel || '-',
            fmtDateTime(session?.count?.createdAt || session?.summary?.createdAt || '').split(' ').slice(1).join(' '),
            line?.name || '-',
            line?.barcode || '-',
            Number(line?.systemQty || 0),
            Number(line?.countedQty || 0),
            Number(line?.diff || 0)
          ])
        }
      }
    } else if (detailKind === 'incoming-day' || detailKind === 'outgoing-day' || detailKind === 'adjust-day') {
      rows.push(['Tarih', 'Saat', 'Ürün', 'Barkod', 'İşlem', 'Miktar', 'Kaynak', 'Not'])
      for (const item of detailData.items || []) {
        const parts = fmtDateTime(item?.createdAt).split(' ')
        rows.push([
          detailData.dateLabel || '-',
          parts.slice(1).join(' '),
          item?.productName || '-',
          item?.barcode || '-',
          stockActionLabel(item?.type),
          Number(item?.qty || 0),
          stockSourceLabel(item?.note),
          stockNoteLabel(item?.note)
        ])
      }
    } else if (detailKind === 'sale' && detailData?.sale) {
      rows.push(['Tarih', 'Satış No', 'Ürün', 'Adet', 'Birim Fiyat', 'Tutar'])
      for (const item of detailData.sale.items || []) {
        rows.push([
          fmtDateTime(detailData.sale.createdAt),
          detailData.sale.saleNo || '-',
          item?.name || '-',
          Number(item?.qty || 0),
          Number(item?.unitPrice || 0),
          Number(item?.lineTotal || 0)
        ])
      }
    } else if (detailKind === 'count' && detailData?.lines) {
      rows.push(['Tarih', 'Ürün', 'Barkod', 'Sistem Stok', 'Sayım Sonucu', 'Fark'])
      for (const line of detailData.lines || []) {
        rows.push([
          fmtDateTime(detailData.count?.createdAt),
          line?.name || '-',
          line?.barcode || '-',
          Number(line?.systemQty || 0),
          Number(line?.countedQty || 0),
          Number(line?.diff || 0)
        ])
      }
    }
    if (!rows.length) return
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';')).join('\n')
    downloadBlob(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }), `stok-gecmisi-${detailData?.dateKey || Date.now()}.csv`)
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Geçmiş Kayıtlar</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Günlük sayım, ürün giriş ve satış hareketlerini toplu inceleyin.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="input" value={String(historyRangeDays)} onChange={(e) => setHistoryRangeDays(Number(e.target.value))} style={{ height: 36 }}>
              <option value={7}>Son 7 gün</option>
              <option value={30}>Son 30 gün</option>
              <option value={90}>Son 90 gün</option>
              <option value={0}>Tümü</option>
            </select>
            <button className="btn btn--compact" type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={!canUse || loading}>Yenile</button>
          </div>
        </div>
        {!!error && <div style={{ color: '#b91c1c' }}>{error}</div>}
        {!canUse ? <div style={{ color: 'var(--muted)' }}>Devam etmek için şube seç.</div> : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <HistorySectionCard title="Yapılan Sayımlar" items={countDays} emptyText="Sayım kaydı yok" loading={loading}>
          {countDays.map((group) => (
            <DailyGroupButton key={group.key} group={{ ...group, totalQty: group.totalDiff }} typeLabel="Sayım" onClick={() => openCountDay(group)} disabled={!canUse || loading} />
          ))}
        </HistorySectionCard>

        <HistorySectionCard title="Alınan Ürün Girişleri" items={incomingDays} emptyText="Ürün giriş kaydı yok" loading={loading}>
          {incomingDays.map((group) => (
            <DailyGroupButton key={group.key} group={group} typeLabel="Giriş" onClick={() => openMovementDay('incoming-day', group)} disabled={!canUse || loading} />
          ))}
        </HistorySectionCard>

        <HistorySectionCard title="Satılan Ürün Çıkışları" items={outgoingDays} emptyText="Çıkış kaydı yok" loading={loading}>
          {outgoingDays.map((group) => (
            <DailyGroupButton key={group.key} group={group} typeLabel="Çıkış" onClick={() => openMovementDay('outgoing-day', group)} disabled={!canUse || loading} />
          ))}
        </HistorySectionCard>

        <HistorySectionCard title="Stok Düzeltmeleri" items={adjustmentDays} emptyText="Düzeltme kaydı yok" loading={loading}>
          {adjustmentDays.map((group) => (
            <DailyGroupButton key={group.key} group={group} typeLabel="Düzeltme" onClick={() => openMovementDay('adjust-day', group)} disabled={!canUse || loading} />
          ))}
        </HistorySectionCard>
      </div>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={detailKind === 'sale' ? 'Satış Detayı' : detailKind === 'count' ? 'Sayım Detayı' : 'Hareket Detayı'} dialogStyle={{ width: isCompact ? 'calc(100% - 4px)' : 'min(760px, calc(100vw - 20px))', maxWidth: '100%', maxHeight: isCompact ? 'calc(100dvh - 4px)' : 'calc(100dvh - 24px)', justifySelf: 'center' }} bodyStyle={{ padding: isCompact ? 2 : 22 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          {detailLoading ? <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div> : null}
          {!!detailError ? <div style={{ color: '#b91c1c' }}>{detailError}</div> : null}
          {!detailLoading && detailData ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" type="button" onClick={downloadDetail}>İndirilebilir Liste</button>
            </div>
          ) : null}

          {detailKind === 'count' && detailData?.count ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <div className="card" style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontWeight: 800 }}>{fmtDateTime(detailData.count.createdAt)}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Yapan: {detailData.count?.createdBy?.name || '-'} • Durum: {detailData.count?.status || '-'}</div>
              </div>
              {(detailData.lines || []).map((line) => (
                <CountDetailCard key={`${line.productId}_${line.barcode}`} line={line} />
              ))}
            </div>
          ) : null}

          {detailKind === 'movement' && detailData ? <MovementDetailCard item={detailData} /> : null}

          {detailKind === 'sale' && detailData?.sale ? (
            <>
              <MovementDetailCard item={detailData.movement} />
              <div className="card" style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 800 }}>{detailData.sale.saleNo || 'Satış'}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtDateTime(detailData.sale.createdAt)} • {detailData.sale.cashierName || '-'}</div>
                </div>
                {(detailData.sale.items || []).map((saleItem, index) => (
                  <div key={`${saleItem.productId || saleItem.name || index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{saleItem.name || '-'}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{money(saleItem.unitPrice || 0)} TL</div>
                    </div>
                    <div style={{ fontWeight: 700 }}>{Number(saleItem.qty || 0)} adet</div>
                    <div style={{ fontWeight: 900 }}>{money(saleItem.lineTotal || 0)} TL</div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {detailKind === 'count-day' && detailData ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div className="card" style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontWeight: 900 }}>{detailData.dateLabel || '-'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Günlük sayım detayları</div>
              </div>
              {(detailData.sessions || []).map((session, index) => (
                <div key={`${session?.count?.id || index}`} className="card" style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 800 }}>{fmtDateTime(session?.count?.createdAt || session?.summary?.createdAt)}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>Yapan: {session?.count?.createdBy?.name || session?.summary?.createdBy?.name || '-'}</div>
                  </div>
                  {(session.lines || []).map((line) => (
                    <CountDetailCard key={`${session?.count?.id || index}_${line.productId}_${line.barcode}`} line={line} actionButton={<button className="btn btn--compact" type="button" onClick={() => openCountDetail(session?.summary?.id || session?.count?.id)}>Tek Sayım Aç</button>} />
                  ))}
                </div>
              ))}
            </div>
          ) : null}

          {(detailKind === 'incoming-day' || detailKind === 'outgoing-day' || detailKind === 'adjust-day') && detailData ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div className="card" style={{ display: 'grid', gap: 4 }}>
                <div style={{ fontWeight: 900 }}>{detailData.dateLabel || '-'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Günlük hareket detayları</div>
              </div>
              {(detailData.items || []).map((item) => (
                <button key={item.id} type="button" className="btn btn--full btn--between" onClick={() => openMovementDetail(item)} style={{ justifyContent: 'space-between' }}>
                  <span style={{ display: 'grid', textAlign: 'left' }}>
                    <span style={{ fontWeight: 800 }}>{item?.productName || '-'}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtDateTime(item?.createdAt)} • {stockActionLabel(item?.type)} • {stockSourceLabel(item?.note)}</span>
                  </span>
                  <span style={{ fontWeight: 900 }}>{Number(item?.qty || 0)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  )
}

function HistorySectionCard({ title, items, emptyText, loading, children }) {
  const list = Array.isArray(items) ? items : []
  return (
    <div className="card" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{list.length}</div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {children}
        {!loading && list.length === 0 ? <div style={{ color: 'var(--muted)' }}>{emptyText}</div> : null}
      </div>
    </div>
  )
}

function DailyGroupButton({ group, typeLabel, onClick, disabled }) {
  return (
    <button type="button" className="btn btn--full btn--between" onClick={onClick} disabled={disabled} style={{ justifyContent: 'space-between' }}>
      <span style={{ display: 'grid', textAlign: 'left' }}>
        <span style={{ fontWeight: 800 }}>{group?.label || '-'}</span>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{typeLabel} • Kayıt: {Array.isArray(group?.items) ? group.items.length : Array.isArray(group?.sessions) ? group.sessions.length : 0}</span>
      </span>
      <span style={{ fontWeight: 900 }}>{Number(group?.totalQty ?? group?.totalDiff ?? 0) > 0 ? `+${Number(group?.totalQty ?? group?.totalDiff ?? 0)}` : Number(group?.totalQty ?? group?.totalDiff ?? 0)}</span>
    </button>
  )
}

function CountDetailCard({ line, actionButton = null }) {
  return (
    <div style={{ display: 'grid', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{line?.name || '-'}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, overflowWrap: 'anywhere' }}>{line?.barcode || '-'}</div>
        </div>
        {actionButton ? <div style={{ flexShrink: 0 }}>{actionButton}</div> : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'grid', gap: 2, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ color: 'var(--muted)', fontSize: 11 }}>Sistem</div>
          <div style={{ fontWeight: 800 }}>{Number(line?.systemQty || 0)}</div>
        </div>
        <div style={{ display: 'grid', gap: 2, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ color: 'var(--muted)', fontSize: 11 }}>Sayım</div>
          <div style={{ fontWeight: 800 }}>{Number(line?.countedQty || 0)}</div>
        </div>
        <div style={{ display: 'grid', gap: 2, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ color: 'var(--muted)', fontSize: 11 }}>Fark</div>
          <div style={{ fontWeight: 800 }}>{Number(line?.diff || 0) > 0 ? `+${Number(line?.diff || 0)}` : Number(line?.diff || 0)}</div>
        </div>
        <div style={{ display: 'grid', gap: 2, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ color: 'var(--muted)', fontSize: 11 }}>Değişim</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>{`${Number(line?.systemQty || 0)} -> ${Number(line?.countedQty || 0)}`}</div>
        </div>
      </div>
    </div>
  )
}

function CountDetailRow({ line, actionButton = null }) {
  return (
    <div style={{ display: 'grid', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{line?.name || '-'}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, overflowWrap: 'anywhere' }}>{line?.barcode || '-'}</div>
        </div>
        {actionButton ? <div style={{ flexShrink: 0 }}>{actionButton}</div> : null}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>Sistem: {Number(line?.systemQty || 0)}</div>
      <div style={{ fontWeight: 700 }}>Sayım: {Number(line?.countedQty || 0)}</div>
      <div style={{ fontWeight: 700 }}>Fark: {Number(line?.diff || 0) > 0 ? `+${Number(line?.diff || 0)}` : Number(line?.diff || 0)}</div>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{`${Number(line?.systemQty || 0)} -> ${Number(line?.countedQty || 0)}`}</div>
      <div>{actionButton}</div>
    </div>
  )
}

function MovementHistoryButton({ item, onClick, disabled }) {
  const source = stockSourceLabel(item?.note)
  const action = stockActionLabel(item?.type)
  return (
    <button type="button" className="btn btn--full btn--between" onClick={onClick} disabled={disabled} style={{ justifyContent: 'space-between' }}>
      <span style={{ display: 'grid', textAlign: 'left' }}>
        <span style={{ fontWeight: 800 }}>{item?.productName || 'Ürün'}</span>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{fmtDateTime(item?.createdAt)} • {action} • {source}</span>
      </span>
      <span style={{ fontWeight: 900 }}>{Number(item?.qty || 0)}</span>
    </button>
  )
}

function MovementDetailCard({ item }) {
  return (
    <div className="card" style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800 }}>{item?.productName || 'Ürün'}</div>
        <div style={{ fontWeight: 900 }}>{stockActionLabel(item?.type)} • {Number(item?.qty || 0)}</div>
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>Tarih: {fmtDateTime(item?.createdAt)}</div>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>Barkod: {item?.barcode || '-'}</div>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>Kaynak: {stockSourceLabel(item?.note)}</div>
      {stockNoteLabel(item?.note) ? <div style={{ color: 'var(--muted)', fontSize: 12 }}>Not: {stockNoteLabel(item?.note)}</div> : null}
      {isStockCountMovement(item?.note) ? <div style={{ color: 'var(--muted)', fontSize: 12 }}>Bu hareket bir sayım sonucu oluştu.</div> : null}
    </div>
  )
}

function CountList({ title, items }) {
  const list = Array.isArray(items) ? items : []
  return (
    <div className="card" style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{list.length}</div>
      </div>
      {list.map(x => (
        <div key={x.productId} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{x.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{x.barcode || '-'}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Başlangıç: {Number(x.currentStockAtStart || 0)} • Sayılan: {Number(x.countedQty || 0)}</div>
          </div>
          <div style={{ fontWeight: 800 }}>{Number(x.diff || 0) > 0 ? `+${Number(x.diff || 0)}` : Number(x.diff || 0)}</div>
        </div>
      ))}
      {list.length === 0 && <div style={{ color: 'var(--muted)' }}>-</div>}
    </div>
  )
}


