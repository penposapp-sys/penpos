import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'
import Modal from '../../components/Modal.jsx'
import { deleteCustomerPayment, getCustomerMovements } from '../lib/api.js'
import { paymentMethodLabel } from '../utils/cariLabels.js'
import useCanteenAutoRefresh from '../hooks/useCanteenAutoRefresh.js'

const money = (n) => {
  const v = Number(n || 0)
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const dt = (value) => {
  if (!value) return ''
  try { return new Date(value).toLocaleString('tr-TR') } catch { return '' }
}

export default function CanteenCustomerDetailPage() {
  const nav = useNavigate()
  const { id } = useParams()
  const { me } = useOutletContext()
  const { isMobilePortrait } = useResponsiveFlags()

  const [customer, setCustomer] = useState(null)
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const [openSaleId, setOpenSaleId] = useState(null)

  const [profileForm, setProfileForm] = useState({ name: '', phone: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [movements, setMovements] = useState([])
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [paymentDeleteOpen, setPaymentDeleteOpen] = useState(false)
  const [paymentDeleteId, setPaymentDeleteId] = useState('')
  const [paymentDeleteReason, setPaymentDeleteReason] = useState('')
  const [paymentDeleteLoading, setPaymentDeleteLoading] = useState(false)

  const canView = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && (me.permissions.includes('canteen_customers_view') || me.permissions.includes('canteen_customers_manage')))
  const canManage = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && me.permissions.includes('canteen_customers_manage'))
  const canEdit = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && (me.permissions.includes('canteen_customers_edit') || me.permissions.includes('canteen_customers_manage')))
  const canCollect = canManage
  const canDeletePayment = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && (me.permissions.includes('canteen_customer_payment_delete') || me.permissions.includes('canteen_customers_manage')))

  const load = async (options = {}) => {
    const background = options?.background === true
    if (!background) setLoading(true)
    if (!background) setError('')
    const c = await api(`/api/canteen/customers/${id}`, { silent: true })
    const s = await api(`/api/canteen/customers/${id}/sales`, { silent: true })
    if (!background) setMovementsLoading(true)
    const m = await getCustomerMovements(id)
    setMovements(Array.isArray(m?.movements) ? m.movements : [])
    if (!background) setMovementsLoading(false)
    setCustomer(c?.ok ? (c.customer || null) : null)
    setSales(Array.isArray(s?.items) ? s.items : [])
    if (!c?.ok) setError(c?.message || 'Cari bulunamadı')
    if (!background) setLoading(false)
  }

  useEffect(() => {
    if (!id) return
    load()
  }, [id])
  useCanteenAutoRefresh(() => load({ background: true }), [id], { enabled: !!id && canView })

  useEffect(() => {
    if (!customer) return
    setProfileForm({
      name: String(customer?.name || ''),
      phone: String(customer?.phone || '')
    })
  }, [customer?.id])

  const balance = useMemo(() => Number(customer?.balance || 0), [customer])

  const profileDirty = useMemo(() => {
    if (!customer) return false
    return (
      String(profileForm.name || '') !== String(customer?.name || '') ||
      String(profileForm.phone || '') !== String(customer?.phone || '')
    )
  }, [profileForm, customer])

  const saveProfile = async () => {
    if (!canEdit || !customer) return
    const name = String(profileForm.name || '').trim()
    const phone = String(profileForm.phone || '').trim().replace(/\s+/g, '').replace(/[^0-9+]/g, '')
    if (name.length < 2) {
      toast.error('İsim en az 2 karakter olmalı')
      return
    }
    setProfileSaving(true)
    const res = await api(`/api/canteen/customers/${id}`, { method: 'PUT', data: { name, phone }, silent: true })
    if (!res?.ok || !res?.customer) {
      toast.error(res?.message || 'Cari güncellenemedi')
      setProfileSaving(false)
      return
    }
    setCustomer(res.customer)
    toast.success('Cari güncellendi')
    setProfileSaving(false)
    await load()
  }

  const deleteCustomer = async () => {
    if (!canManage) return
    setDeleteLoading(true)
    const res = await api(`/api/canteen/customers/${id}`, { method: 'DELETE', silent: true })
    if (!res?.ok) {
      toast.error(res?.message || 'Cari silinemedi')
      setDeleteLoading(false)
      return
    }
    toast.success('Cari silindi')
    setDeleteLoading(false)
    setDeleteOpen(false)
    nav('/canteen/cariler')
  }

  const toggleSale = (saleId) => {
    const sid = String(saleId || '').trim()
    if (!sid) return
    setOpenSaleId(prev => (String(prev || '') === sid ? null : sid))
  }

  const collect = async () => {
    if (!canCollect) return
    const amt = Number(String(amount || '').replace(',', '.'))
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Geçerli bir tutar gir')
      return
    }
    setLoading(true)
    setError('')
    const res = await api(`/api/canteen/customers/${id}/collect`, {
      method: 'POST',
      data: { method, amount: amt, note: String(note || '').trim() },
      silent: true
    })
    if (!res?.ok) {
      setError(res?.message || 'Tahsilat yapılamadı')
      setLoading(false)
      return
    }
    setAmount('')
    setNote('')
    await load()
    setLoading(false)
  }

  const canDeleteSale = me?.role === 'tenant_admin'

  const deleteSale = async (saleId) => {
    if (!canDeleteSale) return
    if (!window.confirm('İşlemi silmek istiyor musun?')) return
    setLoading(true)
    const sale = sales.find(x => String(x.orderId) === String(saleId))
    const qs = sale?.branchId ? `?branchId=${encodeURIComponent(String(sale.branchId))}` : ''
    const res = await api(`/api/canteen/sales/${saleId}${qs}`, { method: 'DELETE', silent: true })
    if (!res?.ok) {
      setError(res?.message || 'Silinemedi')
      setLoading(false)
      return
    }
    await load()
    setLoading(false)
  }

  if (!canView) return <div className="card">403 – Bu sayfaya yetkin yok</div>

  const openDeletePayment = (paymentId) => {
    setPaymentDeleteId(String(paymentId || ''))
    setPaymentDeleteReason('')
    setPaymentDeleteOpen(true)
  }

  const confirmDeletePayment = async () => {
    if (!canDeletePayment) return
    if (!paymentDeleteId) return
    setPaymentDeleteLoading(true)
    const res = await deleteCustomerPayment(id, paymentDeleteId, paymentDeleteReason)
    setPaymentDeleteLoading(false)
    if (!res?.ok) {
      toast.error(res?.message || 'İşlem başarısız')
      return
    }
    toast.success('Tahsilat silindi')
    setPaymentDeleteOpen(false)
    await load()
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>{customer?.name || 'Cari'}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>{customer?.phone || ''}</div>
        </div>
        <div className="actionWrap">
          <button className="btn btn--compact" type="button" onClick={() => nav('/canteen/cariler')}>Geri</button>
          <button className="btn btn--compact" type="button" onClick={load} disabled={loading}>{loading ? '...' : 'Yenile'}</button>
        </div>
      </div>

      {!!error && <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}

      <div className="detailSplit">
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="card" style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>Bakiye</div>
            <div style={{ fontWeight: 800, color: balance > 0 ? '#ef4444' : 'var(--text)' }}>{money(balance)} ₺</div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Borç tahsil et</div>
            <div className="actionWrap">
              {[
                { key: 'cash', label: 'Nakit' },
                { key: 'pos', label: 'POS' },
                { key: 'bank', label: 'Banka' }
              ].map(m => (
                <button
                  key={m.key}
                  type="button"
                  className="btn"
                  onClick={() => setMethod(m.key)}
                  disabled={!canCollect}
                  aria-pressed={method === m.key}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tutar</div>
              <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" disabled={!canCollect} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not</div>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Not" disabled={!canCollect} />
            </label>
            <button className="btn btn--primary btn--large" type="button" onClick={collect} disabled={!canCollect || loading}>Tahsilat Yap</button>
          </div>
          </div>

          <div className="card" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Cari Bilgileri</div>
              <button className="btn btn--primary btn--compact" type="button" onClick={saveProfile} disabled={!canEdit || !profileDirty || profileSaving}>
                {profileSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad Soyad</div>
              <input className="input" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} disabled={!canEdit || profileSaving} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Telefon</div>
              <input className="input" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} disabled={!canEdit || profileSaving} />
            </label>
            {!!String(customer?.note || '').trim() && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not: {String(customer.note).trim()}</div>
            )}

            {(me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && me.permissions.includes('canteen_customers_manage'))) && !!customer?.id && balance <= 0 && (
              <button className="btn btn--danger btn--large" type="button" onClick={() => setDeleteOpen(true)} disabled={deleteLoading}>
                Cariyi Sil
              </button>
            )}
          </div>
        </div>

        <div className="card" style={{ display: 'grid', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontWeight: 700 }}>Hareketler</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{movementsLoading ? 'Yükleniyor...' : `${movements.length} kayıt`}</div>
          </div>
          <div style={isMobilePortrait ? { display: 'grid', gap: 8 } : { display: 'grid', gap: 8, maxHeight: '40vh', overflowY: 'auto', paddingRight: 6 }}>
            {(movements || []).map((m) => {
              const isPayment = m.kind === 'payment'
              const canDeleteThis = isPayment && canDeletePayment
              return (
                <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div className="breakAny" style={{ fontWeight: 700 }}>
                        {m.type === 'debit' ? 'Borç' : 'Tahsilat'}
                        {paymentMethodLabel(m.method) ? ` • ${paymentMethodLabel(m.method)}` : ''}
                      </div>
                      <div style={{ fontWeight: 800, color: m.type === 'debit' ? '#ef4444' : '#16a34a' }}>{money(m.amount)} ₺</div>
                    </div>
                    <div className="canteen-subtext" style={{ fontSize: 12 }}>{m.createdAt ? new Date(m.createdAt).toLocaleString('tr-TR') : ''}</div>
                    {!!String(m.note || '').trim() && <div className="breakAny canteen-subtext" style={{ fontSize: 12 }}>Not: {String(m.note || '').trim()}</div>}
                  </div>
                  {canDeleteThis ? (
                    <button className="btn btn--danger btn--compact" type="button" onClick={() => openDeletePayment(m.paymentId)} disabled={paymentDeleteLoading}>
                      Sil
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              )
            })}
            {!movementsLoading && movements.length === 0 && <div className="canteen-subtext" style={{ fontSize: 13 }}>Kayıt yok</div>}
          </div>
        </div>

        <div className="card" style={{ display: 'grid', gap: 10, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>Satışlar</div>
          <div style={isMobilePortrait ? { display: 'grid', gap: 8 } : { display: 'grid', gap: 8, maxHeight: '60vh', overflowY: 'auto', paddingRight: 6 }}>
            {sales.map((s) => {
              const isOpen = String(openSaleId || '') === String(s.orderId || '')
              return (
                <div
                  key={s.orderId}
                  className="saleRow"
                  onClick={() => toggleSale(s.orderId)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="saleRowTop">
                    <div style={{ minWidth: 0 }}>
                      <div className="saleAmount">{money(s.total)} ₺</div>
                      <div className="canteen-subtext">{dt(s.createdAt)}</div>
                      <div className="canteen-subtext">Ödeme: {paymentMethodLabel(s.paymentMethod) || '-'}</div>
                    </div>

                    <div className="saleActions">
                      <button
                        type="button"
                        className="btn btn--compact"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSale(s.orderId)
                        }}
                      >
                        {isOpen ? '▲' : '▼'}
                      </button>

                      {canDeleteSale && (
                        <button
                          className="btn btn--danger btn--compact"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteSale(s.orderId)
                          }}
                        >
                          Sil
                        </button>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="saleRowDetail">
                      {(!Array.isArray(s.items) || s.items.length === 0) ? (
                        <div className="canteen-subtext">Bu satışta ürün detayı yok.</div>
                      ) : (
                        (s.items || []).map((it, i) => (
                          <div key={i} className="saleItemRow">
                            <div style={{ minWidth: 0, fontWeight: 700 }} className="breakAny">{it.name}</div>
                            <div style={{ textAlign: 'right' }}>
                              <span className="canteen-subtext">{Number(it.qty || 0)} x {money(it.price)} ₺</span>
                              <span style={{ marginLeft: 8, fontWeight: 800 }}>{money(it.lineTotal)} ₺</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {!loading && sales.length === 0 && <div className="canteen-subtext" style={{ fontSize: 13 }}>Satış yok</div>}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Cari silinsin mi?"
        description="Bu işlem geri alınamaz."
        danger
        confirmText={deleteLoading ? 'Siliniyor...' : 'Evet, Sil'}
        confirmDisabled={deleteLoading}
        cancelDisabled={deleteLoading}
        onConfirm={deleteCustomer}
      />

      <Modal open={paymentDeleteOpen} onClose={() => setPaymentDeleteOpen(false)} title="Tahsilatı Sil">
        <div style={{ display: 'grid', gap: 10 }}>
          <div>Bu tahsilatı silmek istiyor musunuz? İşlem geri alınır.</div>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Silme nedeni (opsiyonel)</div>
            <input className="input" value={paymentDeleteReason} onChange={(e) => setPaymentDeleteReason(e.target.value)} disabled={paymentDeleteLoading} />
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setPaymentDeleteOpen(false)} disabled={paymentDeleteLoading}>Vazgeç</button>
            <button className="btn btn--danger" onClick={confirmDeletePayment} disabled={paymentDeleteLoading}>{paymentDeleteLoading ? 'Siliniyor...' : 'Evet, Sil'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
