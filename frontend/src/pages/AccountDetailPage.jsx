import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import { useAuth } from '../context/AuthContext.jsx'
import { trStatusLabel } from '../i18n/tr.js'
import Modal from '../components/Modal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'

export default function AccountDetailPage() {
  const nav = useNavigate()
  const { id } = useParams()
  const loc = useLocation()
  const orderIdFromUrl = useMemo(() => {
    try {
      const qs = new URLSearchParams(String(loc?.search || ''))
      const v = String(qs.get('orderId') || '').trim()
      return v || ''
    } catch {
      return ''
    }
  }, [loc?.search])
  const { isMobilePortrait } = useResponsiveFlags()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [account, setAccount] = useState(null)
  const [tx, setTx] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [orderLoading, setOrderLoading] = useState(false)
  const [order, setOrder] = useState(null)

  const hasPerm = (p) => user?.role === 'tenant_admin' || user?.role === 'superadmin' || (user?.permissions || []).includes(p)
  const canCollect = hasPerm('collect_debt')
  const canDeleteCollection = hasPerm('cari_tahsilat_sil')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [collectOpen, setCollectOpen] = useState(false)
  const [collectForm, setCollectForm] = useState({ amount: '', method: 'cash', note: '' })

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
    const run = async () => {
      const txId = String(expandedId || '').trim()
      if (!txId) {
        setOrder(null)
        return
      }
      const t = (Array.isArray(tx) ? tx : []).find(x => String(x?.id) === txId)
      const embeddedSummary = t?.orderSummary || null
      setOrder(embeddedSummary)

      const orderId = t?.orderId
      if (!orderId) {
        return
      }
      setOrderLoading(true)
      try {
        const res = await api(`/api/accounts/transactions/${txId}/order`, { silent: true })
        const o = res?.order || null
        if (o) setOrder({ ...(embeddedSummary || {}), ...o })
        else setOrder(embeddedSummary)
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
      .filter(x => x.name || x.qty > 0 || x.line > 0)
  }, [order])

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
    const amt = Number(collectForm.amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Tutar geçersiz')
      return
    }
    try {
      await api(`/api/accounts/${accountId}/collect`, {
        method: 'POST',
        body: JSON.stringify({ amount: amt, method: collectForm.method, note: collectForm.note, orderId: orderIdFromUrl || undefined })
      })
      toast.success('Tahsilat kaydedildi')
      setCollectOpen(false)
      setCollectForm({ amount: '', method: 'cash', note: '' })
      await reloadAccount(accountId)
    } catch (err) {
      toast.error(err?.message || 'Tahsilat alınamadı')
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
        if (code === 'payment_locked') toast.error('Bu tahsilat silinemez')
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

  const meta = (
    <div className="card account-balance-card">
      <div className="account-balance-toprow">
        <div className="account-balance-left">
          <div className="account-balance-label">Bakiye</div>
          <div className="account-balance-value">{Number(account?.balance || 0).toFixed(2)} TL</div>
        </div>
        {canCollect && (
          <button className="btn account-collect-btn" onClick={() => setCollectOpen(true)}>Tahsilat Al</button>
        )}
      </div>
    </div>
  )

  const txRows = useMemo(() => (Array.isArray(tx) ? tx : []), [tx])

  return (
    <div className={isMobilePortrait ? 'main pageMobile account-detail-scope' : 'main account-detail-scope'}>
      {header}
      {loading ? (
        <div className="card">Yükleniyor…</div>
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
          {meta}

          <div className="card account-tx-card">
            <div style={{ fontWeight: 800 }}>Son Hareketler</div>
            {txRows.length === 0 ? (
              <div className="account-tx-empty">Hareket yok</div>
            ) : (
              <div className="account-tx-list">
                {txRows.map((t) => {
                  const tid = String(t?.id || '')
                  const expanded = tid && expandedId === tid
                  const amount = Number(t?.amount || 0)
                  const debit = String(t?.type) === 'debit'
                  const canDeleteThis = !debit && t?.source === 'collection' && canDeleteCollection
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
                        <div className="txLeft breakAny">{debit ? 'Borç' : 'Tahsilat'} • {amount.toFixed(2)} TL</div>
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
                                <div style={{ fontWeight: 700 }}>{debit ? 'Borç' : 'Tahsilat'}</div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                <div style={{ color: 'var(--muted)' }}>Tutar</div>
                                <div style={{ fontWeight: 700 }}>{amount.toFixed(2)} TL</div>
                              </div>
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

                          {!!t?.orderId && (
                            <div className="account-subcard">
                              <div style={{ fontWeight: 800, marginBottom: 6 }}>Sipariş Özeti</div>
                              {orderLoading ? (
                                <div style={{ color: 'var(--muted)' }}>Yükleniyor…</div>
                              ) : !order ? (
                                <div style={{ color: 'var(--muted)' }}>Sipariş bilgisi yok</div>
                              ) : (
                                <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                                  <div className="breakAny" style={{ fontWeight: 800 }}>{order?.orderNo ? `Sipariş ${order.orderNo}` : 'Sipariş'}</div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                    <div style={{ color: 'var(--muted)' }}>Toplam</div>
                                    <div style={{ fontWeight: 800 }}>{Number(order?.totals?.total ?? order?.total ?? 0).toFixed(2)} TL</div>
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
                                <div style={{ color: 'var(--muted)' }}>Yükleniyor…</div>
                              ) : !order ? (
                                <div style={{ color: 'var(--muted)' }}>Sipariş detayları bulunamadı</div>
                              ) : orderItems.length === 0 ? (
                                <div style={{ color: 'var(--muted)' }}>Sipariş detayları bulunamadı</div>
                              ) : (
                                <div className="account-order-items">
                                  {orderItems.map((it, idx) => (
                                    <div key={`${it.name}-${idx}`} className="account-order-item">
                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                                        <div className="breakAny" style={{ fontWeight: 700 }}>{it.name || '-'}</div>
                                        <div style={{ fontWeight: 800 }}>{it.line.toFixed(2)} TL</div>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
                                        <div>{it.qty} × {it.unit.toFixed(2)} TL</div>
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
        </>
      )}

      <Modal open={collectOpen} onClose={() => setCollectOpen(false)} title="Tahsilat Al">
        <div style={{ display: 'grid', gap: 10 }}>
          <label>Tutar <input type="number" className="input" value={collectForm.amount} onChange={(e) => setCollectForm({ ...collectForm, amount: e.target.value })} /></label>
          <label>Yöntem
            <select className="input" value={collectForm.method} onChange={(e) => setCollectForm({ ...collectForm, method: e.target.value })}>
              <option value="cash">Nakit</option>
              <option value="card">Kart</option>
              <option value="transfer">Havale</option>
              <option value="other">Diğer</option>
            </select>
          </label>
          <label>Not <input className="input" value={collectForm.note} onChange={(e) => setCollectForm({ ...collectForm, note: e.target.value })} /></label>
          <button className="btn" onClick={collect}>Onayla</button>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => { if (!deleteLoading) { setDeleteOpen(false); setDeleteTarget(null) } }}
        title="Tahsilatı Sil"
        description="⚠️ Bu tahsilatı silmek cari bakiyeyi etkileyecektir. Devam etmek istiyor musunuz?"
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
