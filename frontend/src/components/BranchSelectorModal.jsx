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
    const value = localStorage.getItem('selectedBranchId')
    return value ? String(value) : ''
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
          ? list.filter((branch) => branch.isActive !== false)
          : list.filter((branch) => normalizedAllowedIds.includes(String(branch?._id || branch?.id || '')))
        setBranches(filtered)
      } catch (err) {
        if (!mounted) return
        setError(err?.message || 'Şubeler yüklenemedi')
        setBranches([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
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
    const branchId = String(id || '')
    if (!branchId) return
    localStorage.setItem('selectedBranchId', branchId)
    setOpen(false)
    try {
      window.dispatchEvent(new CustomEvent('selected_branch_changed', { detail: { branchId } }))
    } catch {}
  }

  if (!canSelectBranch) return null

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Şube seçimi gerekli"
      dialogStyle={{ width: 'min(92vw, 560px)', marginInline: 'auto' }}
      bodyStyle={{ padding: 18 }}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
          <div style={{ fontWeight: 700, color: '#b91c1c' }}>Şube seçimi gerekli</div>
          <div style={{ color: 'var(--muted)', marginTop: 4 }}>
            Lütfen işlem yapacağınız şubeyi seçin.
          </div>
        </div>

        {loading && <div style={{ color: 'var(--muted)' }}>Şubeler yükleniyor...</div>}
        {!!error && <div style={{ color: '#ef4444' }}>{error}</div>}

        {!loading && branches.length === 0 && !error && (
          <div style={{ color: 'var(--muted)' }}>
            {user?.role === 'staff' ? 'Şube yetkiniz yok' : 'Şube bulunamadı. Önce şube oluşturun.'}
          </div>
        )}

        <div style={{ display: 'grid', gap: 8 }}>
          {branches.map((branch) => (
            <button
              key={branch._id || branch.id}
              className="btn"
              style={{ justifyContent: 'space-between', display: 'flex' }}
              onClick={() => select(branch._id || branch.id)}
              disabled={loading}
            >
              <span>{branch.name}</span>
              <span style={{ color: 'var(--muted)' }}>
                {String(branch._id || branch.id) === currentSelected ? 'Seçili' : 'Seç'}
              </span>
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
