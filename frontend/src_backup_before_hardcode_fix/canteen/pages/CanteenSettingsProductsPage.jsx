import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'
import Modal from '../../components/Modal.jsx'
import CanteenBulkProductsExcelCard from '../components/CanteenBulkProductsExcelCard.jsx'

const normalize = (s) => String(s || '').toLowerCase().trim()

export default function CanteenSettingsProductsPage() {
  const { me } = useOutletContext()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [barcode, setBarcode] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [stockTrackingEnabled, setStockTrackingEnabled] = useState(false)
  const [stockQty, setStockQty] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [q, setQ] = useState('')
  const [error, setError] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState('')
  const [editName, setEditName] = useState('')
  const [editBarcode, setEditBarcode] = useState('')
  const [editBuyPrice, setEditBuyPrice] = useState('')
  const [editSellPrice, setEditSellPrice] = useState('')
  const [editStockTrackingEnabled, setEditStockTrackingEnabled] = useState(false)
  const [editStockQty, setEditStockQty] = useState('')

  const [branches, setBranches] = useState([])
  const [allowedIds, setAllowedIds] = useState([])

  const canManage = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && me.permissions.includes('manage_menu'))

  const loadProfile = async () => {
    const res = await api('/api/tenant/profile', { silent: true })
    const tenant = res?.tenant || null
    const rawBranches = Array.isArray(tenant?.branches) ? tenant.branches : []
    const nextBranches = rawBranches
      .map(b => ({
        id: String(b?.id || b?._id || ''),
        name: String(b?.name || ''),
        isActive: b?.isActive !== false
      }))
      .filter(b => b.id && b.name && b.isActive !== false)
    const nextAllowed = Array.isArray(tenant?.canteenAllowedBranchIds)
      ? tenant.canteenAllowedBranchIds.map(String).filter(Boolean)
      : []
    setBranches(nextBranches)
    setAllowedIds(nextAllowed)
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const visibleBranches = useMemo(() => {
    const allow = new Set((allowedIds || []).map(String))
    if (me?.role === 'tenant_admin') {
      return allow.size > 0 ? branches.filter(b => allow.has(String(b.id))) : branches
    }
    if (allow.size === 0) return []
    return branches.filter(b => allow.has(String(b.id)))
  }, [branches, allowedIds, me?.role])

  useEffect(() => {
    if (String(selectedBranchId || '').trim()) return
    if (visibleBranches.length > 0) setSelectedBranchId(String(visibleBranches[0].id))
  }, [visibleBranches])

  useEffect(() => {
    if (!selectedBranchId) return
    if (visibleBranches.some(b => String(b.id) === String(selectedBranchId))) return
    setSelectedBranchId(visibleBranches.length > 0 ? String(visibleBranches[0].id) : '')
  }, [visibleBranches, selectedBranchId])

  const load = async (branchId) => {
    const bid = String(branchId || '').trim()
    if (!bid) {
      setItems([])
      return
    }
    setLoading(true)
    setError('')
    const res = await api(`/api/canteen/products?branchId=${encodeURIComponent(bid)}`, { silent: true })
    setItems(Array.isArray(res?.products) ? res.products : [])
    setLoading(false)
  }

  useEffect(() => {
    load(selectedBranchId)
  }, [selectedBranchId])

  const filtered = useMemo(() => {
    const nq = normalize(q)
    if (!nq) return items
    return items.filter(p => normalize(p.name).includes(nq))
  }, [items, q])

  const create = async (e) => {
    e.preventDefault()
    if (!canManage) return
    const bid = String(selectedBranchId || '').trim()
    if (!bid) {
      setError('Şube seçmelisin')
      return
    }
    const bc = String(barcode || '').trim()
    if (!bc) {
      setError('Barkod zorunlu')
      toast.error('Barkod zorunlu')
      return
    }
    const price = Number(String(sellPrice || '').replace(',', '.'))
    const cost = Number(String(buyPrice || '').replace(',', '.'))
    if (!String(name || '').trim()) {
      setError('Ürün adı zorunlu')
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      setError('Satış fiyatı geçersiz')
      return
    }
    setError('')
    const res = await api(`/api/canteen/products?branchId=${encodeURIComponent(bid)}`, {
      method: 'POST',
      data: {
        name,
        barcode: bc,
        price,
        costPrice: Number.isFinite(cost) ? cost : 0,
        stockTrackingEnabled: stockTrackingEnabled === true,
        stockQty: Number(String(stockQty || '').replace(',', '.')) || 0
      },
      silent: true
    })
    if (!res?.ok) {
      if (res?.code === 'duplicate_barcode') toast.error('Bu barkod zaten kayıtlı')
      setError(res?.message || 'Ürün eklenemedi')
      return
    }
    setName('')
    setBarcode('')
    setBuyPrice('')
    setSellPrice('')
    setStockTrackingEnabled(false)
    setStockQty('')
    load(bid)
  }

  const openEdit = (p) => {
    setEditId(String(p?.id || ''))
    setEditName(String(p?.name || ''))
    setEditBarcode(String(p?.barcode || ''))
    setEditBuyPrice(String(p?.costPrice ?? ''))
    setEditSellPrice(String(p?.price ?? ''))
    setEditStockTrackingEnabled(p?.stockTrackingEnabled === true)
    setEditStockQty(String(p?.stockQty ?? ''))
    setEditOpen(true)
  }

  const submitEdit = async () => {
    if (!canManage) return
    const bid = String(selectedBranchId || '').trim()
    if (!bid) return
    const id = String(editId || '').trim()
    if (!id) return
    const bc = String(editBarcode || '').trim()
    if (!bc) {
      toast.error('Barkod zorunlu')
      return
    }
    const price = Number(String(editSellPrice || '').replace(',', '.'))
    const cost = Number(String(editBuyPrice || '').replace(',', '.'))
    const nextStock = Number(String(editStockQty || '').replace(',', '.'))
    const res = await api(`/api/canteen/products/${encodeURIComponent(id)}?branchId=${encodeURIComponent(bid)}`, {
      method: 'PUT',
      data: {
        name: String(editName || '').trim(),
        barcode: bc,
        price: Number.isFinite(price) ? price : 0,
        costPrice: Number.isFinite(cost) ? cost : 0,
        stockTrackingEnabled: editStockTrackingEnabled === true,
        stockQty: Number.isFinite(nextStock) ? nextStock : 0
      },
      silent: true
    })
    if (!res?.ok) {
      if (res?.code === 'duplicate_barcode') toast.error('Bu barkod zaten kayıtlı')
      else toast.error(res?.message || 'Kaydedilemedi')
      return
    }
    toast.success('Ürün güncellendi')
    setEditOpen(false)
    load(bid)
  }

  const remove = async (id) => {
    if (!canManage) return
    const bid = String(selectedBranchId || '').trim()
    if (!bid) return
    if (!window.confirm('Ürünü silmek istiyor musun?')) return
    setError('')
    const res = await api(`/api/canteen/products/${id}?branchId=${encodeURIComponent(bid)}`, { method: 'DELETE', silent: true })
    if (!res?.ok) {
      setError(res?.message || 'Silinemedi')
      return
    }
    load(bid)
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Ürün Ayarları</div>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ürünler seçili şubeye göre listelenir.</div>
        </div>
        <button className="btn btn--compact" type="button" onClick={() => load(selectedBranchId)} disabled={loading}>{loading ? '...' : 'Yenile'}</button>
      </div>

      {!!error && <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}

      {branches.length === 0 && (
        <div className="card" style={{ borderColor: '#fde68a', background: '#fffbeb', color: '#92400e' }}>
          Şube yok, önce Şube Ayarları’ndan şube ekleyin.
        </div>
      )}

      {me?.role !== 'tenant_admin' && Array.isArray(allowedIds) && allowedIds.length === 0 && branches.length > 0 && (
        <div className="card" style={{ borderColor: '#fde68a', background: '#fffbeb', color: '#92400e' }}>
          Yetkili şube yok.
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginRight: 6 }}>Şubeler</div>
        {visibleBranches.map(b => {
          const id = String(b.id)
          const active = id === String(selectedBranchId)
          return (
            <button
              key={id}
              type="button"
              className="btn"
              onClick={() => {
                setSelectedBranchId(id)
                setName('')
                setBuyPrice('')
                setSellPrice('')
                setQ('')
              }}
              aria-pressed={active}
            >
              {b.name}
            </button>
          )
        })}
        {visibleBranches.length === 0 && branches.length > 0 && <div style={{ color: 'var(--muted)' }}>Yetkili şube yok.</div>}
      </div>

      {canManage && (
        <CanteenBulkProductsExcelCard
          branchId={selectedBranchId}
          onImportDone={() => load(selectedBranchId)}
        />
      )}

      <form className="card" onSubmit={create}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Yeni Ürün</div>
        <div className="productsCreateGrid">
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Barkod</div>
            <input className="input" value={barcode} onChange={(e) => setBarcode(e.target.value)} disabled={!canManage} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Alış Fiyatı</div>
            <input className="input" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} disabled={!canManage} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Satış Fiyatı</div>
            <input className="input" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} disabled={!canManage} />
          </label>
          <button className="btn btn--primary btn--full" disabled={!canManage || !String(name || '').trim() || !String(barcode || '').trim() || !String(selectedBranchId || '').trim()}>Ekle</button>
        </div>

        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={stockTrackingEnabled} onChange={(e) => setStockTrackingEnabled(e.target.checked)} disabled={!canManage} />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Stok takibi</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Başlangıç stok</span>
            <input className="input" value={stockQty} onChange={(e) => setStockQty(e.target.value)} disabled={!canManage} style={{ width: '100%', maxWidth: 180, height: 38 }} />
          </label>
        </div>
      </form>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ara</div>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ürün adı" />
        </label>
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(p => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Barkod: {p.barcode || '-'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Stok: {Number(p.stockQty || 0)}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Satış: {Number(p.price || 0).toFixed(2)} ₺</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--compact" type="button" onClick={() => openEdit(p)} disabled={!canManage}>Düzenle</button>
                <button className="btn btn--danger btn--compact" type="button" onClick={() => remove(p.id)} disabled={!canManage}>Sil</button>
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 && <div style={{ color: 'var(--muted)' }}>Bu şubede ürün yok</div>}
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Ürün Düzenle">
        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} disabled={!canManage} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Barkod</div>
            <input className="input" value={editBarcode} onChange={(e) => setEditBarcode(e.target.value)} disabled={!canManage} />
          </label>
          <div className="productsEditPriceGrid">
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Alış Fiyatı</div>
              <input className="input" value={editBuyPrice} onChange={(e) => setEditBuyPrice(e.target.value)} disabled={!canManage} />
            </label>
            <label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Satış Fiyatı</div>
              <input className="input" value={editSellPrice} onChange={(e) => setEditSellPrice(e.target.value)} disabled={!canManage} />
            </label>
          </div>
          <div className="stackRow" style={{ justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={editStockTrackingEnabled} onChange={(e) => setEditStockTrackingEnabled(e.target.checked)} disabled={!canManage} />
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Stok takibi</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Stok</span>
              <input className="input" value={editStockQty} onChange={(e) => setEditStockQty(e.target.value)} disabled={!canManage} style={{ width: '100%', maxWidth: 180, height: 38 }} />
            </label>
          </div>
          <div className="actionWrap" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" type="button" onClick={() => setEditOpen(false)}>Vazgeç</button>
            <button className="btn btn--primary" type="button" onClick={submitEdit} disabled={!String(editName || '').trim() || !String(editBarcode || '').trim()}>Kaydet</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
