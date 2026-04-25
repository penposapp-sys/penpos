import React, { useEffect, useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { api } from '../lib/apiClient.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function BranchSelectorModal() {
  const { user, logout, allowedBranchIds } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState([])
  const [error, setError] = useState('')

  const canSelectBranch = user?.role === 'tenant_admin' || user?.role === 'staff'

  const currentSelected = useMemo(() => {
    const v = localStorage.getItem('selectedBranchId')
    return v ? String(v) : ''
  }, [open])

  const normalizedAllowedIds = useMemo(() => {
    const raw = Array.isArray(allowedBranchIds) ? allowedBranchIds : []
    return Array.from(new Set(raw.map(String).filter(Boolean)))
  }, [allowedBranchIds])

  useEffect(() => {
    const onMissingBranch = () => {
      if (!canSelectBranch) return
      setOpen(true)
    }
    window.addEventListener('missing_branch', onMissingBranch)
    return () => window.removeEventListener('missing_branch', onMissingBranch)
  }, [canSelectBranch])

  useEffect(() => {
    if (!open || !canSelectBranch) return
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await api('/api/branches', { silent: true })
        if (!mounted) return
        const list = Array.isArray(res?.branches) ? res.branches : []
        const filtered = user?.role === 'tenant_admin'
          ? list.filter(b => b.isActive !== false)
          : list.filter(b => normalizedAllowedIds.includes(String(b?._id || b?.id || '')))
        setBranches(filtered)
      } catch (e) {
        if (!mounted) return
        setError(e?.message || 'Şubeler yüklenemedi')
        setBranches([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [open, canSelectBranch, user?.role, normalizedAllowedIds])

  useEffect(() => {
    if (!open || !canSelectBranch) return
    if (user?.role === 'tenant_admin') return
    if (normalizedAllowedIds.length !== 1) return
    const branchId = normalizedAllowedIds[0]
    if (!branchId) return
    localStorage.setItem('selectedBranchId', branchId)
    setOpen(false)
    try {
      window.dispatchEvent(new CustomEvent('selected_branch_changed', { detail: { branchId } }))
    } catch {}
  }, [open, canSelectBranch, user?.role, normalizedAllowedIds])

  const select = (id) => {
    const bid = String(id || '')
    if (!bid) return
    localStorage.setItem('selectedBranchId', bid)
    setOpen(false)
    try {
      window.dispatchEvent(new CustomEvent('selected_branch_changed', { detail: { branchId: bid } }))
    } catch {}
  }

  if (!canSelectBranch) return null

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Şube seçimi gerekli">
      <div style={{ display: 'grid', gap: 10 }}>
        <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
          <div style={{ fontWeight: 700, color: '#b91c1c' }}>Şube seçimi gerekli</div>
          <div style={{ color: 'var(--muted)', marginTop: 4 }}>
            Lütfen işlem yapacağınız şubeyi seçin.
          </div>
        </div>

        {loading && <div style={{ color: 'var(--muted)' }}>Şubeler yükleniyor…</div>}
        {!!error && <div style={{ color: '#ef4444' }}>{error}</div>}

        {!loading && branches.length === 0 && !error && (
          <div style={{ color: 'var(--muted)' }}>{user?.role === 'staff' ? 'Şube yetkiniz yok' : 'Şube bulunamadı. Önce şube oluşturun.'}</div>
        )}

        <div style={{ display: 'grid', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
          {branches.map(b => (
            <button
              key={b._id || b.id}
              className="btn"
              style={{ justifyContent: 'space-between', display: 'flex' }}
              onClick={() => select(b._id || b.id)}
              disabled={loading}
            >
              <span>{b.name}</span>
              <span style={{ color: 'var(--muted)' }}>{String(b._id || b.id) === currentSelected ? 'Seçili' : 'Seç'}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={() => {
              logout()
              window.location.href = '/login'
            }}
          >
            Çıkış Yap
          </button>
          {user?.role === 'tenant_admin' && (
            <button className="btn" onClick={() => { window.location.href = '/kermes/settings/branches' }}>
              Şube Ayarları
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
