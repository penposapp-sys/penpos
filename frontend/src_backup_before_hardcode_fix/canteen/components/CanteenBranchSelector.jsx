import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/apiClient.js'

const key = 'selectedBranchId_canteen'

export default function CanteenBranchSelector({ compact = false }) {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const selected = useMemo(() => {
    try {
      return String(localStorage.getItem(key) || '')
    } catch {
      return ''
    }
  }, [])
  const [value, setValue] = useState(selected)

  const load = async () => {
    setLoading(true)
    const res = await api('/api/canteen/branches', { silent: true })
    const list = Array.isArray(res?.branches) ? res.branches : []
    setBranches(list)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const onChange = (v) => {
    setValue(v)
    try {
      if (v) localStorage.setItem(key, String(v))
      else localStorage.removeItem(key)
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent('canteen_branch_changed', { detail: { branchId: v || null } }))
    } catch {}
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {!compact && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şube</div>}
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)} style={{ height: compact ? 32 : 38, paddingTop: 6, paddingBottom: 6 }} disabled={loading}>
        <option value="">Şube seç</option>
        {branches.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      {!compact && <button className="btn btn--compact" type="button" onClick={load} disabled={loading}>{loading ? '...' : 'Yenile'}</button>}
    </div>
  )
}
