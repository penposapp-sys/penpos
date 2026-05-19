import React, { useEffect, useState } from 'react'
import { api } from '../../lib/apiClient.js'
import useCanteenAutoRefresh from '../hooks/useCanteenAutoRefresh.js'

export default function CanteenBranchesPage() {
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async (options = {}) => {
    const background = options?.background === true
    if (!background) setLoading(true)
    const res = await api('/api/canteen/branches', { silent: true, skipBranchHeader: true })
    setItems(Array.isArray(res?.branches) ? res.branches : [])
    if (!background) setLoading(false)
  }

  useEffect(() => { load() }, [])
  useCanteenAutoRefresh(() => load({ background: true }), [], { enabled: false })

  const create = async (e) => {
    e.preventDefault()
    const res = await api('/api/canteen/branches', { method: 'POST', data: { name, description }, skipBranchHeader: true })
    if (res?.ok) {
      setName('')
      setDescription('')
      load()
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Şubeyi silmek istiyor musun?')) return
    const res = await api(`/api/canteen/branches/${id}`, { method: 'DELETE', skipBranchHeader: true })
    if (res?.ok) load()
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <form className="card" onSubmit={create}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Yeni Şube</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Açıklama</div>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <button className="btn" disabled={loading || !name.trim()}>Ekle</button>
        </div>
      </form>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>Şubeler</div>
          <button className="btn" type="button" onClick={load} disabled={loading} style={{ padding: '0 10px', height: 34 }}>{loading ? '...' : 'Yenile'}</button>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{b.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{b.description || ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--danger" type="button" onClick={() => remove(b.id)}>Sil</button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
        </div>
      </div>
    </div>
  )
}
