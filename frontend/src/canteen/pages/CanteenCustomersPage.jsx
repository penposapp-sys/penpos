import React, { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import CreateCustomerModal from '../components/CreateCustomerModal.jsx'
import EditCustomerModal from '../components/EditCustomerModal.jsx'
import useCanteenAutoRefresh from '../hooks/useCanteenAutoRefresh.js'

const money = (n) => {
  const v = Number(n || 0)
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const normalize = (s) => String(s || '').toLowerCase().trim()

export default function CanteenCustomersPage() {
  const { me } = useOutletContext()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const canView = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && (me.permissions.includes('canteen_customers_view') || me.permissions.includes('canteen_customers_manage')))
  const canCreate = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && (me.permissions.includes('canteen_customers_create') || me.permissions.includes('canteen_customers_manage')))
  const canEdit = me?.role === 'tenant_admin' || (Array.isArray(me?.permissions) && (me.permissions.includes('canteen_customers_edit') || me.permissions.includes('canteen_customers_manage')))

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = async (options = {}) => {
    const background = options?.background === true
    if (!background) setLoading(true)
    const res = await api('/api/canteen/customers', { silent: true })
    setItems(Array.isArray(res?.customers) ? res.customers : [])
    if (!background) setLoading(false)
  }

  useEffect(() => { load() }, [])
  useCanteenAutoRefresh(() => load({ background: true }), [], { enabled: false })

  const filtered = useMemo(() => {
    const nq = normalize(q)
    if (!nq) return items
    return items.filter(c => normalize(c.name).includes(nq) || normalize(c.phone).includes(nq))
  }, [items, q])

  if (!canView) return <div className="card">403 - Bu sayfaya yetkin yok</div>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <label>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ara</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn" type="button" onClick={load} disabled={loading} style={{ padding: '0 10px', height: 34 }}>{loading ? '...' : 'Yenile'}</button>
              {canCreate && (
                <button className="btn btn--primary" type="button" onClick={() => setCreateOpen(true)} style={{ padding: '0 10px', height: 34 }}>+ Cari Oluştur</button>
              )}
            </div>
          </div>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim veya telefon" />
        </label>

        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(c => (
            <div key={c.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <Link
                to={`/canteen/cariler/${c.id}`}
                style={{ textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="breakAny" style={{ fontWeight: 700 }}>{c.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{c.phone || ''}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>Son İşlem: {c.lastActionAt ? new Date(c.lastActionAt).toLocaleString('tr-TR') : '-'}</div>
                </div>
              </Link>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 120 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Borç</div>
                  <div style={{ whiteSpace: 'nowrap', fontWeight: 800, color: Number(c.balance || 0) > 0 ? '#ef4444' : 'var(--text)' }}>{money(c.balance)} ₺</div>
                </div>
                {canEdit && (
                  <button
                    className="btn btn--compact"
                    type="button"
                    onClick={() => {
                      setEditing(c)
                      setEditOpen(true)
                    }}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Düzenle
                  </button>
                )}
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
        </div>
      </div>

      <CreateCustomerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => load()}
      />

      <EditCustomerModal
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditing(null) }}
        customer={editing}
        onSaved={() => load()}
      />
    </div>
  )
}
