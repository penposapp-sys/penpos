import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'

const getId = (value) => String(value?._id || value?.id || '')
const money = (value) => Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateTime = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('tr-TR')
}

export default function QuickSalesPage() {
  const navigate = useNavigate()
  const { allowedBranchIds } = useAuth()
  const allowedIds = useMemo(
    () => new Set((Array.isArray(allowedBranchIds) ? allowedBranchIds : []).map(String).filter(Boolean)),
    [allowedBranchIds]
  )
  const [branchId, setBranchId] = useState('')
  const [branches, setBranches] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [branchReady, setBranchReady] = useState(false)
  const [errorText, setErrorText] = useState('')

  useEffect(() => {
    let active = true
    const loadBranches = async () => {
      setBranchReady(false)
      try {
        const response = await api('/api/branches', {
          skipBranchHeader: true,
          silent: true,
          suppressBranchModal: true
        })
        if (!response?.ok || response?.success === false) {
          throw new Error(response?.data?.message || response?.message || 'Şubeler yüklenemedi.')
        }
        const list = (Array.isArray(response?.branches) ? response.branches : []).filter((branch) => {
          const id = getId(branch)
          return id && branch.isActive !== false && (allowedIds.size === 0 || allowedIds.has(id))
        })
        if (!active) return
        setBranches(list)
        const storedId = (() => {
          try { return String(localStorage.getItem('selectedBranchId') || '').trim() } catch { return '' }
        })()
        const selectedId = list.some((branch) => getId(branch) === storedId)
          ? storedId
          : (list.length === 1 ? getId(list[0]) : '')
        setBranchId(selectedId)
        if (list.length === 1 && selectedId) {
          try { localStorage.setItem('selectedBranchId', selectedId) } catch {}
        }
        setErrorText('')
      } catch (err) {
        if (active) setErrorText(err?.data?.message || err?.message || 'Şubeler yüklenemedi.')
      } finally {
        if (active) setBranchReady(true)
      }
    }
    void loadBranches()
    return () => { active = false }
  }, [allowedIds])

  useEffect(() => {
    const syncSelectedBranch = () => {
      let selectedId = ''
      try { selectedId = String(localStorage.getItem('selectedBranchId') || '').trim() } catch {}
      setBranchId(branches.some((branch) => getId(branch) === selectedId) ? selectedId : '')
    }
    window.addEventListener('selected_branch_changed', syncSelectedBranch)
    return () => window.removeEventListener('selected_branch_changed', syncSelectedBranch)
  }, [branches])

  const selectBranch = (nextId) => {
    const selected = branches.find((branch) => getId(branch) === String(nextId || ''))
    const id = selected ? getId(selected) : ''
    setBranchId(id)
    try {
      if (id) localStorage.setItem('selectedBranchId', id)
      else localStorage.removeItem('selectedBranchId')
    } catch {}
    window.dispatchEvent(new CustomEvent('selected_branch_changed', { detail: { branchId: id } }))
  }

  useEffect(() => {
    let active = true
    const loadSales = async () => {
      if (!branchReady) return
      if (branches.length && !branchId) {
        setOrders([])
        setErrorText('')
        setLoading(false)
        return
      }
      if (!branches.length) {
        setOrders([])
        setErrorText('Kullanılabilir yetkili aktif şube bulunamadı.')
        setLoading(false)
        return
      }
      setLoading(true)
      setErrorText('')
      try {
        const branchQuery = branchId ? `&branchId=${encodeURIComponent(branchId)}` : ''
        const response = await api(`/api/pos/quick-sales?limit=200${branchQuery}`, {
          silent: true,
          branchIdOverride: branchId || undefined,
          suppressBranchModal: true
        })
        if (!response?.ok || response?.success === false) {
          throw new Error(response?.data?.message || response?.message || 'Hızlı satışlar yüklenemedi.')
        }
        if (active) setOrders(Array.isArray(response?.orders) ? response.orders : [])
      } catch (err) {
        if (active) setErrorText(err?.data?.message || err?.message || 'Hızlı satışlar yüklenemedi.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadSales()
    return () => { active = false }
  }, [branchId, branchReady, branches.length])

  return (
    <div className="pageShell walkin-sales-page walkin-layout">
      <div className="pageHeader">
        <div>
          <h1>Hızlı Satışlar</h1>
          <div className="muted">Hızlı Satış üzerinden onaylanan satışlar.</div>
        </div>
        <select
          className="input"
          aria-label="Satış şubesi"
          value={branchId}
          onChange={(event) => selectBranch(event.target.value)}
          disabled={!branchReady}
        >
          <option value="">{branchReady ? 'Tüm yetkili şubeler' : 'Şubeler yükleniyor…'}</option>
          {branches.map((branch) => (
            <option key={getId(branch)} value={getId(branch)}>{branch.name}</option>
          ))}
        </select>
      </div>
      {errorText ? <div className="card" role="alert" style={{ color: 'var(--danger)', marginBottom: 10 }}>{errorText}</div> : null}
      <div className="card" style={{ overflow: 'auto' }}>
        {loading ? <div style={{ padding: 18 }}>Yükleniyor…</div> : (
          <table className="table">
            <thead>
              <tr>
                <th>Satış No</th>
                <th>Tarih / Saat</th>
                <th>Ürünler</th>
                <th>Ara Toplam</th>
                <th>Genel Toplam</th>
                <th>Ödeme</th>
                <th>Tahsilat</th>
                <th>Sipariş Notu</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const items = (Array.isArray(order.items) ? order.items : []).filter((item) => item?.status !== 'cancelled')
                const itemSummary = items.map((item) => {
                  const quantity = item.isWeightBased ? `${item.weightGrams} gr` : `${item.qty} adet`
                  const note = item.note ? ` (Not: ${item.note})` : ''
                  return `${item.nameSnapshot || item.productName || 'Ürün'} × ${quantity}${note}`
                }).join(', ')
                const payments = Array.isArray(order.payments) ? order.payments : []
                const paymentText = payments.length
                  ? payments.map((payment) => `${payment.methodLabel || payment.methodName || payment.method || '-'} (${money(payment.amount)} TL)`).join(', ')
                  : (order.paymentMethod || '-')
                const orderId = getId(order)
                return (
                  <tr key={orderId}>
                    <td>{order.orderNo || orderId.slice(-8).toUpperCase()}</td>
                    <td>{dateTime(order.createdAt)}</td>
                    <td style={{ minWidth: 220, maxWidth: 400 }}>{itemSummary || '-'}</td>
                    <td>{money(order.totals?.subtotal ?? order.total)} TL</td>
                    <td>{money(order.netTotal ?? order.totals?.grandTotal)} TL</td>
                    <td>{paymentText}</td>
                    <td>{order.paymentStatus === 'paid' ? 'Tahsil edildi' : 'Eksik tahsilat'}</td>
                    <td>{order.note || '-'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--xs"
                        onClick={() => navigate(`/restoran/app/walkin/${orderId}`)}
                      >
                        Detay
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!orders.length ? <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 20 }}>Henüz hızlı satış kaydı yok.</td></tr> : null}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
