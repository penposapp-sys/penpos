import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/apiClient.js'
import { getPermissionLabel } from '../utils/permissionLabels.js'

const PERMS = [
  { key: 'canteen_pos_access', label: 'POS' },
  { key: 'canteen_settings_manage', label: 'Ayarlar' },
  { key: 'canteen_catalog_manage', label: 'Katalog' },
  { key: 'canteen_staff_manage', label: 'Personel' },
  { key: 'canteen_sales_view', label: 'Rapor' }
]

export default function CanteenStaffPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [permissions, setPermissions] = useState([])

  const permSet = useMemo(() => new Set(permissions), [permissions])

  const load = async () => {
    setLoading(true)
    const res = await api('/api/canteen/staff', { silent: true, skipBranchHeader: true })
    setItems(Array.isArray(res?.staff) ? res.staff : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const togglePerm = (p) => {
    setPermissions(prev => {
      const set = new Set(prev)
      if (set.has(p)) set.delete(p)
      else set.add(p)
      return Array.from(set)
    })
  }

  const create = async (e) => {
    e.preventDefault()
    const res = await api('/api/canteen/staff', {
      method: 'POST',
      data: { name, username, email, password, permissions },
      skipBranchHeader: true
    })
    if (res?.ok) {
      setName('')
      setUsername('')
      setEmail('')
      setPassword('')
      setPermissions([])
      load()
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Personeli devre dışı bırakmak istiyor musun?')) return
    const res = await api(`/api/canteen/staff/${id}`, { method: 'DELETE', skipBranchHeader: true })
    if (res?.ok) load()
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <form className="card" onSubmit={create}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Yeni Personel</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kullanıcı Adı</div>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ornek: kantin1" />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>E-posta</div>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şifre</div>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {PERMS.map(p => (
            <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 999 }}>
              <input type="checkbox" checked={permSet.has(p.key)} onChange={() => togglePerm(p.key)} />
              <span style={{ fontSize: 13 }}>{p.label}</span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn" disabled={!name.trim() || !email.trim() || !password.trim()}>Ekle</button>
        </div>
      </form>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>Personel</div>
          <button className="btn" type="button" onClick={load} disabled={loading} style={{ padding: '0 10px', height: 34 }}>{loading ? '...' : 'Yenile'}</button>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map(u => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{u.name}</div>
                {u.username ? <div style={{ color: 'var(--muted)', fontSize: 12 }}>{u.username}</div> : null}
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{u.email}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {(Array.isArray(u.permissions) ? u.permissions : []).map(p => (
                    <span key={p} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, border: '1px solid var(--border)', background: '#f9fafb' }}>
                      {getPermissionLabel(p)}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--danger" type="button" onClick={() => remove(u.id)}>Sil</button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div style={{ color: 'var(--muted)' }}>Kayıt yok</div>}
        </div>
      </div>
    </div>
  )
}
