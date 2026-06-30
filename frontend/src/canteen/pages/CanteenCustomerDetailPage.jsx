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

const getMovementTitle = (movement) => {
  if (movement?.kind === 'adjustment') {
    return movement?.type === 'debit' ? 'Bakiye Ekleme' : 'Bakiye Dusme'
  }
  return movement?.type === 'debit' ? 'Borc' : 'Tahsilat'
}

const getSelectedCanteenBranchId = () => {
  try {
    return String(localStorage.getItem('selectedBranchId_canteen') || localStorage.getItem('selectedBranchId') || '').trim()
  } catch {
    return ''
  }
}

export default function CanteenCustomerDetailPage() {
  const nav = useNavigate()
  const { id } = useParams()
  const { me } = useOutletContext()
  const { isMobilePortrait } = useResponsiveFlags()

  const [customer, setCustomer] = useState(null)
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(false)
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

  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [actionType, setActionType] = useState('collect')
  const [actionSaving, setActionSaving] = useState(false)
  const [actionAmount, setActionAmount] = useState('')
  const [actionMethod, setActionMethod] = useState('cash')
  const [actionNote, setActionNote] = useState('')

  const canView = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && (me.permissions.includes('canteen_customers_view') || me.permissions.includes('canteen_customers_manage')))
  const canManage = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && me.permissions.includes('canteen_customers_manage'))
  const canEdit = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && (me.permissions.includes('canteen_customers_edit') || me.permissions.includes('canteen_customers_manage')))
  const canCollect = canManage
  const canDeletePayment = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && (me.permissions.includes('canteen_customer_payment_delete') || me.permissions.includes('canteen_customers_manage')))
  const canDeleteSale = canManage

  const load = async (options = {}) => {
    const background = options?.background === true
    if (!background) {
      setLoading(true)
      setError('')
    }

    const customerResponse = await api(`/api/canteen/customers/${id}`, { silent: true })
    const salesResponse = await api(`/api/canteen/customers/${id}/sales`, { silent: true })

    if (!background) setMovementsLoading(true)
    const movementResponse = await getCustomerMovements(id)
    setMovements(Array.isArray(movementResponse?.movements) ? movementResponse.movements : [])
    if (!background) setMovementsLoading(false)

    setCustomer(customerResponse?.ok ? (customerResponse.customer || null) : null)
    setSales(Array.isArray(salesResponse?.items) ? salesResponse.items : [])
    if (!customerResponse?.ok) setError(customerResponse?.message || 'Cari bulunamadi')
    if (!background) setLoading(false)
  }

  useEffect(() => {
    if (!id) return
    load()
  }, [id])

  useCanteenAutoRefresh(() => load({ background: true }), [id], { enabled: false })

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
      toast.error('Isim en az 2 karakter olmali')
      return
    }
    setProfileSaving(true)
    const res = await api(`/api/canteen/customers/${id}`, { method: 'PUT', data: { name, phone }, silent: true })
    if (!res?.ok || !res?.customer) {
      toast.error(res?.message || 'Cari guncellenemedi')
      setProfileSaving(false)
      return
    }
    setCustomer(res.customer)
    toast.success('Cari guncellendi')
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
    setOpenSaleId((prev) => (String(prev || '') === sid ? null : sid))
  }

  const openBalanceAction = (type) => {
    setActionType(type)
    setActionAmount('')
    setActionMethod('cash')
    setActionNote('')
    setError('')
    setActionModalOpen(true)
  }

  const submitBalanceAction = async () => {
    if (!canCollect) return
    const branchId = getSelectedCanteenBranchId()
    if (!branchId) {
      setError('Aktif sube secilmedi')
      return
    }
    const amt = Number(String(actionAmount || '').replace(',', '.'))
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Gecerli bir tutar gir')
      return
    }

    setActionSaving(true)
    setError('')

    const res = actionType === 'collect'
      ? await api(`/api/canteen/customers/${id}/collect?branchId=${encodeURIComponent(branchId)}`, {
          method: 'POST',
          data: { method: actionMethod, amount: amt, note: String(actionNote || '').trim() },
          silent: true
        })
      : await api(`/api/canteen/customers/${id}/adjust?branchId=${encodeURIComponent(branchId)}`, {
          method: 'POST',
          data: { action: actionType === 'add' ? 'add' : 'subtract', amount: amt, note: String(actionNote || '').trim() },
          silent: true
        })

    if (!res?.ok) {
      setError(res?.message || 'Islem basarisiz')
      setActionSaving(false)
      return
    }

    toast.success(
      actionType === 'collect'
        ? 'Tahsilat kaydedildi'
        : actionType === 'add'
          ? 'Bakiye eklendi'
          : 'Bakiye dusuldu'
    )
    setActionSaving(false)
    setActionModalOpen(false)
    setActionAmount('')
    setActionNote('')
    await load()
  }

  const deleteSale = async (saleId) => {
    if (!canDeleteSale) return
    if (!window.confirm('Islemi silmek istiyor musun?')) return
    setLoading(true)
    const res = await api(`/api/canteen/sales/${saleId}`, { method: 'DELETE', silent: true })
    if (!res?.ok) {
      setError(res?.message || 'Silinemedi')
      setLoading(false)
      return
    }
    await load()
    setLoading(false)
  }

  const openDeletePayment = (paymentId) => {
    setPaymentDeleteId(String(paymentId || ''))
    setPaymentDeleteReason('')
    setPaymentDeleteOpen(true)
  }

  const confirmDeletePayment = async () => {
    if (!canDeletePayment || !paymentDeleteId) return
    setPaymentDeleteLoading(true)
    const res = await deleteCustomerPayment(id, paymentDeleteId, paymentDeleteReason)
    setPaymentDeleteLoading(false)
    if (!res?.ok) {
      toast.error(res?.message || 'Islem basarisiz')
      return
    }
    toast.success('Tahsilat silindi')
    setPaymentDeleteOpen(false)
    await load()
  }

  if (!canView) return <div className="card">403 - Bu sayfaya yetkin yok</div>

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
              <div style={{ fontWeight: 800, color: balance > 0 ? '#ef4444' : 'var(--text)' }}>{money(balance)} TL</div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'grid', gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Hizli Islemler</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button className="btn btn--primary" type="button" onClick={() => openBalanceAction('add')} disabled={!canCollect}>+ Bakiye</button>
                <button className="btn" type="button" onClick={() => openBalanceAction('subtract')} disabled={!canCollect}>- Bakiye</button>
                <button className="btn" type="button" onClick={() => openBalanceAction('collect')} disabled={!canCollect}>Tahsilat Al</button>
              </div>
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

            {canManage && !!customer?.id && (
              <button className="btn btn--danger btn--large" type="button" onClick={() => setDeleteOpen(true)} disabled={deleteLoading}>
                Cariyi Sil
              </button>
            )}
          </div>
        </div>

        <div className="card" style={{ display: 'grid', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontWeight: 700 }}>Hareketler</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{movementsLoading ? 'Yukleniyor...' : `${movements.length} kayit`}</div>
          </div>
          <div style={isMobilePortrait ? { display: 'grid', gap: 8 } : { display: 'grid', gap: 8, maxHeight: '40vh', overflowY: 'auto', paddingRight: 6 }}>
            {(movements || []).map((movement) => {
              const isPayment = movement.kind === 'payment'
              const isAdjustment = movement.kind === 'adjustment'
              const canDeleteThis = (isPayment || isAdjustment) && canDeletePayment && movement.paymentId
              return (
                <div key={movement.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div className="breakAny" style={{ fontWeight: 700 }}>
                        {getMovementTitle(movement)}
                        {movement.kind !== 'adjustment' && paymentMethodLabel(movement.method) ? ` • ${paymentMethodLabel(movement.method)}` : ''}
                      </div>
                      <div style={{ fontWeight: 800, color: movement.type === 'debit' ? '#ef4444' : '#16a34a' }}>{money(movement.amount)} TL</div>
                    </div>
                    <div className="canteen-subtext" style={{ fontSize: 12 }}>{movement.createdAt ? new Date(movement.createdAt).toLocaleString('tr-TR') : ''}</div>
                    {!!String(movement.note || '').trim() && <div className="breakAny canteen-subtext" style={{ fontSize: 12 }}>Not: {String(movement.note || '').trim()}</div>}
                  </div>
                  {canDeleteThis ? (
                    <button className="btn btn--danger btn--compact" type="button" onClick={() => openDeletePayment(movement.paymentId)} disabled={paymentDeleteLoading}>
                      Sil
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              )
            })}
            {!movementsLoading && movements.length === 0 && <div className="canteen-subtext" style={{ fontSize: 13 }}>Kayit yok</div>}
          </div>
        </div>

        <div className="card" style={{ display: 'grid', gap: 10, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>Satislar</div>
          <div style={isMobilePortrait ? { display: 'grid', gap: 8 } : { display: 'grid', gap: 8, maxHeight: '60vh', overflowY: 'auto', paddingRight: 6 }}>
            {sales.map((sale) => {
              const isOpen = String(openSaleId || '') === String(sale.orderId || '')
              return (
                <div
                  key={sale.orderId}
                  className="saleRow"
                  onClick={() => toggleSale(sale.orderId)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="saleRowTop">
                    <div style={{ minWidth: 0 }}>
                      <div className="saleAmount">{money(sale.total)} TL</div>
                      <div className="canteen-subtext">{dt(sale.createdAt)}</div>
                      <div className="canteen-subtext">Odeme: {paymentMethodLabel(sale.paymentMethod) || '-'}</div>
                    </div>

                    <div className="saleActions">
                      <button
                        type="button"
                        className="btn btn--compact"
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleSale(sale.orderId)
                        }}
                      >
                        {isOpen ? '▲' : '▼'}
                      </button>

                      {canDeleteSale && (
                        <button
                          className="btn btn--danger btn--compact"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            deleteSale(sale.orderId)
                          }}
                        >
                          Sil
                        </button>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="saleRowDetail">
                      {(!Array.isArray(sale.items) || sale.items.length === 0) ? (
                        <div className="canteen-subtext">Bu satista urun detayi yok.</div>
                      ) : (
                        (sale.items || []).map((item, index) => (
                          <div key={index} className="saleItemRow">
                            <div style={{ minWidth: 0, fontWeight: 700 }} className="breakAny">{item.name}</div>
                            <div style={{ textAlign: 'right' }}>
                              <span className="canteen-subtext">{Number(item.qty || 0)} x {money(item.price)} TL</span>
                              <span style={{ marginLeft: 8, fontWeight: 800 }}>{money(item.lineTotal)} TL</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {!loading && sales.length === 0 && <div className="canteen-subtext" style={{ fontSize: 13 }}>Satis yok</div>}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Cari silinsin mi?"
        description="Cari aktif listeden kaldirilir. Gecmis satis ve rapor verileri korunur."
        danger
        confirmText={deleteLoading ? 'Siliniyor...' : 'Evet, Sil'}
        confirmDisabled={deleteLoading}
        cancelDisabled={deleteLoading}
        onConfirm={deleteCustomer}
      />

      <Modal open={paymentDeleteOpen} onClose={() => setPaymentDeleteOpen(false)} title="Islemi Sil">
        <div style={{ display: 'grid', gap: 10 }}>
          <div>Bu islemi silmek istiyor musunuz? Islem geri alinir.</div>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Silme nedeni (opsiyonel)</div>
            <input className="input" value={paymentDeleteReason} onChange={(e) => setPaymentDeleteReason(e.target.value)} disabled={paymentDeleteLoading} />
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setPaymentDeleteOpen(false)} disabled={paymentDeleteLoading}>Vazgec</button>
            <button className="btn btn--danger" onClick={confirmDeletePayment} disabled={paymentDeleteLoading}>{paymentDeleteLoading ? 'Siliniyor...' : 'Evet, Sil'}</button>
          </div>
        </div>
      </Modal>

      <Modal
        open={actionModalOpen}
        onClose={() => !actionSaving && setActionModalOpen(false)}
        title={actionType === 'add' ? '+ Bakiye' : actionType === 'subtract' ? '- Bakiye' : 'Tahsilat Al'}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          {actionType === 'collect' ? (
            <div className="actionWrap">
              {[
                { key: 'cash', label: 'Nakit' },
                { key: 'pos', label: 'POS' },
                { key: 'bank', label: 'Banka' }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="btn"
                  onClick={() => setActionMethod(item.key)}
                  disabled={actionSaving}
                  aria-pressed={actionMethod === item.key}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}

          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tutar</div>
            <input className="input" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} placeholder="0" disabled={actionSaving} />
          </label>

          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not</div>
            <input className="input" value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="Not" disabled={actionSaving} />
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={() => setActionModalOpen(false)} disabled={actionSaving}>Vazgec</button>
            <button className="btn btn--primary" type="button" onClick={submitBalanceAction} disabled={actionSaving}>
              {actionSaving
                ? 'Kaydediliyor...'
                : actionType === 'add'
                  ? 'Bakiyeye Ekle'
                  : actionType === 'subtract'
                    ? 'Bakiyeden Dus'
                    : 'Tahsilat Yap'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
