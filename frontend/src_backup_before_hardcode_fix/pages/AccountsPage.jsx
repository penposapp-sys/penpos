import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import Modal from '../components/Modal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { trPaymentMethodLabel } from '../i18n/tr.js'
import { useAuth } from '../context/AuthContext.jsx'
import { buildBranchQueryParams } from '../lib/branchQuery.js'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'

export default function AccountsPage() {
  const nav = useNavigate()
  const { isMobilePortrait } = useResponsiveFlags()
  const { user, logout, allowedBranchIds } = useAuth()
  const hasPerm = (p) => user?.role === 'tenant_admin' || user?.role === 'superadmin' || (user?.permissions || []).includes(p)
  const canManage = hasPerm('manage_accounts') || hasPerm('accounts_manage')
  const canCollect = hasPerm('collect_debt')

  const [q, setQ] = useState('')
  const [accounts, setAccounts] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selected, setSelected] = useState(null)
  const [recentTx, setRecentTx] = useState([])
  const [loading, setLoading] = useState(false)
  const [missingBranch, setMissingBranch] = useState(false)

  const [txDetailOpen, setTxDetailOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState(null)
  const [selectedTxOrder, setSelectedTxOrder] = useState(null)
  const [selectedTxOrderLoading, setSelectedTxOrderLoading] = useState(false)

  const [deleteTxConfirmOpen, setDeleteTxConfirmOpen] = useState(false)
  const deletingTxIdsRef = useRef(new Set())
  const [deletingTxIdsUI, setDeletingTxIdsUI] = useState(() => new Set())
  const [pendingDeleteTxId, setPendingDeleteTxId] = useState(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', phone: '', note: '' })
  const [createError, setCreateError] = useState('')
  const [createSaving, setCreateSaving] = useState(false)
  const createNameRef = useRef(null)
  const createPhoneRef = useRef(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', note: '' })
  const [editError, setEditError] = useState('')
  const editNameRef = useRef(null)
  const editPhoneRef = useRef(null)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const [collectOpen, setCollectOpen] = useState(false)
  const [collectForm, setCollectForm] = useState({ amount: '', method: 'cash', note: '' })

  const loadList = async () => {
    setLoading(true)
    try {
      setMissingBranch(false)
      if (!Array.isArray(allowedBranchIds)) {
        setAccounts([])
        return
      }
      const { ids, params } = buildBranchQueryParams(allowedBranchIds)
      if (!params || ids.length === 0) {
        setMissingBranch(true)
        setAccounts([])
        return
      }
      params.set('q', q)
      params.set('limit', '50')
      const res = await api(`/api/accounts?${params.toString()}`, { skipBranchHeader: true, suppressBranchModal: true })
      if (res?.success === false) return
      setAccounts(res?.accounts || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (id) => {
    if (!id) return
    try {
      const res = await api(`/api/accounts/${id}`)
      if (res?.success === false) return
      setSelected(res.account)
      setRecentTx(res.recentTransactions || [])
    } catch (err) {
      toast.error(err.message)
    }
  }

  useEffect(() => { loadList() }, [])
  useEffect(() => { if (selectedId) loadDetail(selectedId) }, [selectedId])

  useEffect(() => {
    const run = async () => {
      if (!txDetailOpen || !selectedTx?.orderId) {
        setSelectedTxOrder(null)
        return
      }
      setSelectedTxOrderLoading(true)
      try {
        const res = await api(`/api/pos/orders/${selectedTx.orderId}`, { silent: true })
        const o = res?.order || res?.data?.order || null
        setSelectedTxOrder(o)
      } catch {
        setSelectedTxOrder(null)
      } finally {
        setSelectedTxOrderLoading(false)
      }
    }
    run()
  }, [txDetailOpen, selectedTx?.orderId])

  const createAccount = async () => {
    if (createSaving) return
    const name = String(createForm.name || '').trim()
    if (!name) {
      setCreateError('İsim zorunlu')
      createNameRef.current?.focus?.()
      return
    }
    setCreateError('')
    setCreateSaving(true)
    try {
      const res = await api('/api/accounts', { method: 'POST', body: JSON.stringify({ ...createForm, name }), silent: true })
      if (!res?.ok) {
        if (res?.code === 'duplicate') {
          const msg = String(res?.message || 'Kayıt zaten var')
          setCreateError(msg)
          toast.error(msg)
          const field = String(res?.field || '')
          if (field === 'phone') createPhoneRef.current?.focus?.()
          else createNameRef.current?.focus?.()
          return
        }
        const msg = String(res?.message || 'İşlem başarısız')
        setCreateError(msg)
        toast.error(msg)
        return
      }

      const acc = res?.account || null
      const newId = acc?.id || acc?._id || null
      if (acc && newId) {
        setAccounts((prev) => {
          const list = Array.isArray(prev) ? prev : []
          const filtered = list.filter(a => String(a?.id || a?._id) !== String(newId))
          return [{ ...acc, id: newId }, ...filtered]
        })
      }

      toast.success('Cari oluşturuldu')
      setCreateOpen(false)
      setCreateForm({ name: '', phone: '', note: '' })
      setCreateError('')
      if (newId) nav(`/kermes/app/accounts/${newId}`)
    } catch (err) {
      const msg = err?.message || 'İşlem başarısız'
      setCreateError(msg)
      toast.error(msg)
    } finally {
      setCreateSaving(false)
    }
  }

  const openEdit = (account) => {
    const a = account || {}
    setEditId(a.id)
    setEditForm({ name: String(a.name || ''), phone: String(a.phone || ''), note: String(a.note || '') })
    setEditError('')
    setEditOpen(true)
    setTimeout(() => {
      editNameRef.current?.focus?.()
      editNameRef.current?.select?.()
    }, 0)
  }

  const saveEdit = async () => {
    if (!editId) return
    const name = String(editForm.name || '').trim()
    if (!name) {
      setEditError('İsim zorunlu')
      editNameRef.current?.focus?.()
      return
    }
    setEditError('')
    const res = await api(`/api/accounts/${editId}`, { method: 'PUT', body: JSON.stringify({ ...editForm, name }), silent: true })
    if (!res?.ok) {
      if (res?.code === 'duplicate') {
        const msg = String(res?.message || 'Kayıt zaten var')
        setEditError(msg)
        const field = String(res?.field || '')
        if (field === 'phone') editPhoneRef.current?.focus?.()
        else editNameRef.current?.focus?.()
        return
      }
      setEditError(String(res?.message || 'Güncelleme başarısız'))
      return
    }
    toast.success('Güncellendi')
    setEditOpen(false)
    setEditId(null)
    setEditError('')
    await loadList()
    if (selectedId) await loadDetail(selectedId)
  }

  const confirmDelete = (account) => {
    const a = account || {}
    setDeleteId(a.id)
    setDeleteConfirmOpen(true)
  }

  const deleteAccount = async () => {
    if (!deleteId) return
    setDeletingAccount(true)
    const removed = deleteId
    const res = await api(`/api/accounts/${removed}`, { method: 'DELETE', silent: true })
    if (res?.ok) {
      toast.success('Silindi')
      setDeleteId(null)
      await loadList()
      if (selectedId === removed) {
        setSelectedId(null)
        setSelected(null)
        setRecentTx([])
      }
      setDeletingAccount(false)
      return
    }
    if (res?.code === 'duplicate') {
      toast.error(res?.message || 'Kayıt zaten var')
      setDeletingAccount(false)
      return
    }
    if (res?.code === 'has_transactions') {
      toast.error(res?.message || 'Bu cari hareket gördüğü için silinemez. Pasife alabilirsiniz.')
    }
    if (res?.message) {
      toast.error(res.message)
    }
    setDeletingAccount(false)
  }

  const collect = async () => {
    if (!selected?.id) return
    const amt = Number(collectForm.amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Tutar geçersiz')
      return
    }
    try {
      await api(`/api/accounts/${selected.id}/collect`, {
        method: 'POST',
        body: JSON.stringify({ amount: amt, method: collectForm.method, note: collectForm.note })
      })
      setCollectOpen(false)
      setCollectForm({ amount: '', method: 'cash', note: '' })
      await loadDetail(selected.id)
      await loadList()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const requestDeleteTx = (tx) => {
    const txId = String(tx?.id || '').trim()
    if (!txId) return
    if (deletingTxIdsRef.current.has(txId)) return
    setPendingDeleteTxId(txId)
    setDeleteTxConfirmOpen(true)
  }

  const deleteCollectionTx = async (txId) => {
    const id = String(txId || '').trim()
    if (!id) return
    if (!selected?.id) return
    if (deletingTxIdsRef.current.has(id)) return

    deletingTxIdsRef.current.add(id)
    setDeletingTxIdsUI(new Set(deletingTxIdsRef.current))

    setRecentTx(prev => (Array.isArray(prev) ? prev.filter(t => String(t?.id) !== id) : []))
    try {
      const res = await api(`/api/accounts/transactions/${id}`, { method: 'DELETE', silent: true })
      if (res?.success === false) {
        const code = res?.code || res?.error
        if (code === 'already_deleted' || code === 'not_found') {
          toast.info('Bu hareket zaten silinmiş. Liste yenileniyor…')
          setTxDetailOpen(false)
          setSelectedTx(null)
          setPendingDeleteTxId(null)
          await loadDetail(selected.id)
          await loadList()
          return
        }
        toast.error(res?.message || 'Silme başarısız')
        await loadDetail(selected.id)
        await loadList()
        return
      }
      toast.success('Tahsilat silindi')
      setTxDetailOpen(false)
      setSelectedTx(null)
      setPendingDeleteTxId(null)
      await loadDetail(selected.id)
      await loadList()
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Silme başarısız')
      await loadDetail(selected.id)
      await loadList()
    } finally {
      deletingTxIdsRef.current.delete(id)
      setDeletingTxIdsUI(new Set(deletingTxIdsRef.current))
    }
  }

  const confirmDeleteTx = async () => {
    const txId = String(pendingDeleteTxId || '').trim()
    if (!txId) return
    setDeleteTxConfirmOpen(false)
    await deleteCollectionTx(txId)
  }

  return (
    <div className={isMobilePortrait ? 'main pageMobile' : 'splitLayout splitLayoutStretch pageVhFit'} style={isMobilePortrait ? { display: 'grid', gap: 12 } : { gridTemplateColumns: '320px 1fr' }}>
      {missingBranch ? (
        <div className="card" style={{ gridColumn: '1 / -1', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ maxWidth: 520, width: '100%', display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              Şube yetkisi yok. Ayarlar &gt; Sistem Ayarları &gt; Yetkili Şubeler’den şube seç.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {user?.role === 'tenant_admin' && (
                <button className="btn" onClick={() => { window.location.href = '/kermes/settings/system' }}>
                  Sistem Ayarları
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
      <>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
        <div className="stackRow">
          <input className="input" placeholder="Ara: isim/telefon" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn" onClick={loadList} disabled={loading}>Ara</button>
        </div>
        {canManage && <button className="btn btn--full" onClick={() => setCreateOpen(true)}>Yeni Cari</button>}
        <div className="cari-list" style={{ overflowY: 'auto', flex: 1 }}>
          {(accounts || []).map(a => {
            const active = selectedId === a.id
            return (
              <div
                key={a.id}
                onClick={() => {
                  if (a?.branchId) localStorage.setItem('selectedBranchId', String(a.branchId))
                  setSelectedId(a.id)
                  nav(`/kermes/app/accounts/${a.id}`)
                }}
                className="cari-card"
                style={{
                  cursor: 'pointer',
                  border: active ? '2px solid #3b82f6' : '1px solid var(--border)',
                  background: active ? '#eff6ff' : '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10
                }}
              >
                <div className="cari-card-left" style={{ minWidth: 0 }}>
                  <div className="cari-name" style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                  <div className="cari-meta" style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.phone || '-'}</div>
                </div>
                <div className="cari-card-right" style={{ textAlign: 'right', display: 'grid', gap: 6 }}>
                  {canManage && (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn--xs"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (a?.branchId) localStorage.setItem('selectedBranchId', String(a.branchId))
                          setSelectedId(a.id)
                          openEdit(a)
                        }}
                      >
                        Düzenle
                      </button>
                      <button
                        className="btn btn--xs btn--danger-soft"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (a?.branchId) localStorage.setItem('selectedBranchId', String(a.branchId))
                          confirmDelete(a)
                        }}
                      >
                        Sil
                      </button>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Bakiye</div>
                    <div style={{ fontWeight: 800 }}>{Number(a.balance || 0).toFixed(2)} TL</div>
                  </div>
                </div>
              </div>
            )
          })}
          {(accounts || []).length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
        </div>
      </div>

      {!isMobilePortrait && (
      <div className="card" style={{ overflow: 'hidden' }}>
        {!selected ? (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>Cari seçiniz</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 12, height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0 }}>{selected.name}</h3>
                <div style={{ color: 'var(--muted)' }}>{selected.phone || '-'}</div>
                {!!selected.note && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{selected.note}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Bakiye</div>
                <div style={{ fontWeight: 800, fontSize: 20 }}>{Number(selected.balance || 0).toFixed(2)} TL</div>
                {canCollect && <button className="btn" onClick={() => setCollectOpen(true)}>Tahsilat Al</button>}
              </div>
            </div>

            <div style={{ overflowY: 'auto', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Son Hareketler</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {(recentTx || []).map(t => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedTx(t)
                      setTxDetailOpen(true)
                    }}
                    style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: 10, padding: 10, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 700 }}>{t.type === 'debit' ? 'Borç' : 'Tahsilat'}</div>
                      <div style={{ fontWeight: 800, color: t.type === 'debit' ? '#b45309' : '#047857' }}>
                        {Number(t.amount || 0).toFixed(2)} TL
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(t.createdAt).toLocaleString()} • {t.source}</div>
                    {!!t.note && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.note}</div>}
                  </div>
                ))}
                {(recentTx || []).length === 0 && <div style={{ color: 'var(--muted)' }}>Hareket yok</div>}
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setCreateError('') }} title="Yeni Cari">
        <div style={{ display: 'grid', gap: 10 }}>
          {!!createError && (
            <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
              <div style={{ fontWeight: 700, color: '#b91c1c' }}>{createError}</div>
            </div>
          )}
          <label>İsim <input ref={createNameRef} className="input" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} /></label>
          <label>Telefon <input ref={createPhoneRef} className="input" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} /></label>
          <label>Not <input className="input" value={createForm.note} onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })} /></label>
          <button className="btn" onClick={createAccount} disabled={createSaving}>{createSaving ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => { setEditOpen(false); setEditError('') }} title="Cari Düzenle">
        <div style={{ display: 'grid', gap: 10 }}>
          {!!editError && (
            <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
              <div style={{ fontWeight: 700, color: '#b91c1c' }}>{editError}</div>
            </div>
          )}
          <label>İsim <input ref={editNameRef} className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></label>
          <label>Telefon <input ref={editPhoneRef} className="input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></label>
          <label>Not <input className="input" value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} /></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={saveEdit}>Kaydet</button>
            <button className="btn" onClick={() => setEditOpen(false)}>Vazgeç</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Bu cari silinsin mi?"
        confirmText="Evet, Sil"
        cancelText="Vazgeç"
        danger
        onConfirm={async () => {
          setDeleteConfirmOpen(false)
          await deleteAccount()
        }}
      />

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

      <Modal open={txDetailOpen} onClose={() => { setTxDetailOpen(false); setSelectedTx(null) }} title="İşlem Detayı">
        <div style={{ display: 'grid', gap: 10 }}>
          {!selectedTx ? (
            <div style={{ color: 'var(--muted)' }}>İşlem seçilmedi</div>
          ) : (
            <>
              <div className="card" style={{ borderColor: 'var(--border)', padding: 12 }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ color: 'var(--muted)' }}>İşlem</div>
                    <div style={{ fontWeight: 800 }}>{selectedTx.type === 'debit' ? 'Borç' : 'Tahsilat'}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ color: 'var(--muted)' }}>Kaynak</div>
                    <div style={{ fontWeight: 700 }}>{selectedTx.source || '-'}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ color: 'var(--muted)' }}>Tarih</div>
                    <div style={{ fontWeight: 600 }}>{new Date(selectedTx.createdAt).toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ color: 'var(--muted)' }}>Tutar</div>
                    <div style={{ fontWeight: 900 }}>{Number(selectedTx.amount || 0).toFixed(2)} TL</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ color: 'var(--muted)' }}>Yöntem</div>
                    <div style={{ fontWeight: 600 }}>{trPaymentMethodLabel(selectedTx.method) || '-'}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ color: 'var(--muted)' }}>AccountId</div>
                    <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 12 }}>{selected?.id || '-'}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ color: 'var(--muted)' }}>OrderId</div>
                    <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 12 }}>{selectedTx.orderId || '-'}</div>
                  </div>
                  {!!selectedTx.note && (
                    <div style={{ display: 'grid', gap: 2 }}>
                      <div style={{ color: 'var(--muted)' }}>Not</div>
                      <div style={{ fontWeight: 600 }}>{selectedTx.note}</div>
                    </div>
                  )}
                </div>
              </div>

              {selectedTx.source === 'order_veresiye' && !!selectedTx.orderId && (
                <div className="card" style={{ borderColor: 'var(--border)', padding: 12 }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Sipariş Özeti</div>
                  {selectedTxOrderLoading && <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>}
                  {!selectedTxOrderLoading && !selectedTxOrder && (
                    <div style={{ color: 'var(--muted)' }}>Sipariş detayı alınamadı</div>
                  )}
                  {!selectedTxOrderLoading && !!selectedTxOrder && (
                    <>
                      <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div style={{ color: 'var(--muted)' }}>Tarih</div>
                          <div style={{ fontWeight: 600 }}>{selectedTxOrder.createdAt ? new Date(selectedTxOrder.createdAt).toLocaleString() : '-'}</div>
                        </div>
                      </div>

                      <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                        {(() => {
                          const items = Array.isArray(selectedTxOrder.items) ? selectedTxOrder.items : []
                          const visible = items.filter(i => String(i?.status || '').toLowerCase() !== 'cancelled')
                          if (visible.length === 0) {
                            return <div style={{ color: 'var(--muted)', fontSize: 12 }}>Sipariş ürünleri bulunamadı</div>
                          }
                          return (
                            <div style={{ display: 'grid', gap: 6 }}>
                              {visible.map((i, idx) => {
                                const qty = Number(i?.qty ?? i?.quantity ?? 0)
                                const name = String(i?.nameSnapshot || i?.name || '').trim() || 'Ürün'
                                const unitPrice = Number(i?.priceSnapshot ?? i?.unitPrice ?? 0)
                                const lineTotal = Number(i?.subtotal ?? i?.lineTotal ?? (Number.isFinite(qty) && Number.isFinite(unitPrice) ? qty * unitPrice : 0))
                                const showPrice = Number.isFinite(lineTotal) && lineTotal > 0
                                const note = String(i?.note || '').trim()
                                return (
                                  <div key={String(i?._id || idx)} style={{ display: 'grid', gap: 2 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                      <div style={{ fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {`${Number.isFinite(qty) && qty > 0 ? qty : 1}x ${name}`}
                                      </div>
                                      {showPrice && (
                                        <div style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{lineTotal.toFixed(2)} TL</div>
                                      )}
                                    </div>
                                    {!!note && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not: {note}</div>}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>

                      <div style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div style={{ color: 'var(--muted)' }}>Toplam</div>
                          <div style={{ fontWeight: 700 }}>{Number(selectedTxOrder.netTotal ?? selectedTxOrder.totals?.netTotal ?? 0).toFixed(2)} TL</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div style={{ color: 'var(--muted)' }}>Ödenen</div>
                          <div style={{ fontWeight: 600 }}>{Number(selectedTxOrder.paidTotal ?? selectedTxOrder.totals?.paidTotal ?? 0).toFixed(2)} TL</div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div style={{ color: 'var(--muted)' }}>Kalan</div>
                          <div style={{ fontWeight: 900 }}>{Number(selectedTxOrder.balanceDue ?? selectedTxOrder.totals?.balanceDue ?? 0).toFixed(2)} TL</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
            {canCollect && selectedTx?.source === 'collection' && selectedTx?.type === 'credit' ? (
              <button
                className="btn"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  requestDeleteTx(selectedTx)
                }}
                disabled={deletingTxIdsUI.has(String(selectedTx?.id || ''))}
                style={deletingTxIdsUI.has(String(selectedTx?.id || '')) ? { opacity: 0.7 } : {}}
              >
                {deletingTxIdsUI.has(String(selectedTx?.id || '')) ? 'Siliniyor…' : 'Sil / Geri Al'}
              </button>
            ) : (
              <div />
            )}
            <button className="btn" onClick={() => { setTxDetailOpen(false); setSelectedTx(null) }}>Kapat</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteTxConfirmOpen}
        onClose={() => setDeleteTxConfirmOpen(false)}
        title="Tahsilatı silmek istiyor musunuz?"
        confirmText={deletingTxIdsUI.has(String(pendingDeleteTxId || '')) ? 'Siliniyor...' : 'Evet, Sil'}
        confirmDisabled={deletingTxIdsUI.has(String(pendingDeleteTxId || ''))}
        cancelDisabled={deletingTxIdsUI.has(String(pendingDeleteTxId || ''))}
        onConfirm={confirmDeleteTx}
      />
      </>
      )}
    </div>
  )
}
