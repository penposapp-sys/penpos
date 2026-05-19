import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../components/Modal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useResponsiveFlags } from '../hooks/useResponsiveFlags.js'
import { api } from '../lib/apiClient.js'
import { buildBranchQueryParams } from '../lib/branchQuery.js'
import { downloadBlob } from '../lib/download.js'
import { toast } from '../lib/toast.js'

const toMoney = (value) => Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const escapeHtml = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const normalizeSearchText = (value) => String(value || '')
  .toLocaleLowerCase('tr-TR')
  .replaceAll(/\s+/g, ' ')
  .trim()

const rankAccountsByQuery = (accounts, query) => {
  const normalizedQuery = normalizeSearchText(query)
  const list = Array.isArray(accounts) ? [...accounts] : []
  if (!normalizedQuery) {
    return list.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'tr'))
  }
  const scoreAccount = (account) => {
    const name = normalizeSearchText(account?.name)
    const phone = normalizeSearchText(account?.phone)
    if (name === normalizedQuery) return 0
    if (name.startsWith(normalizedQuery)) return 1
    if (name.includes(normalizedQuery)) return 2
    if (phone.startsWith(normalizedQuery)) return 3
    if (phone.includes(normalizedQuery)) return 4
    return 5
  }
  return list.sort((a, b) => {
    const scoreDiff = scoreAccount(a) - scoreAccount(b)
    if (scoreDiff !== 0) return scoreDiff
    return String(a?.name || '').localeCompare(String(b?.name || ''), 'tr')
  })
}

const buildAccountsExcelHtml = (accounts) => `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <style>
    body{font-family:Segoe UI,Arial,sans-serif}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left}
    th{background:#f8fafc}
  </style>
</head>
<body>
  <table>
    <tr><th colspan="4">Cari Hesaplar</th></tr>
    <tr><th>Isim</th><th>Telefon</th><th>Not</th><th>Bakiye</th></tr>
    ${(accounts || []).map((account) => `
      <tr>
        <td>${escapeHtml(account?.name)}</td>
        <td>${escapeHtml(account?.phone || '-')}</td>
        <td>${escapeHtml(account?.note || '-')}</td>
        <td>${toMoney(account?.balance || 0)} TL</td>
      </tr>
    `).join('')}
  </table>
</body>
</html>`

export default function AccountsPage() {
  const nav = useNavigate()
  const { isMobilePortrait } = useResponsiveFlags()
  const { user, allowedBranchIds } = useAuth()

  const hasPerm = (perm) => user?.role === 'tenant_admin' || user?.role === 'superadmin' || (user?.permissions || []).includes(perm)
  const canManage = hasPerm('manage_accounts') || hasPerm('accounts_manage')

  const [q, setQ] = useState('')
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [missingBranch, setMissingBranch] = useState(false)
  const [viewMode, setViewMode] = useState('cards')

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

  const branchKey = Array.isArray(allowedBranchIds) ? allowedBranchIds.join(',') : 'none'

  const fetchAccounts = async ({ search = q, limit = 120 } = {}) => {
    setMissingBranch(false)
    if (!Array.isArray(allowedBranchIds)) return []
    const { ids, params } = buildBranchQueryParams(allowedBranchIds)
    if (!params || ids.length === 0) {
      setMissingBranch(true)
      return []
    }
    params.set('q', String(search || '').trim())
    params.set('limit', String(limit))
    const res = await api(`/api/accounts?${params.toString()}`, { skipBranchHeader: true, suppressBranchModal: true, silent: true })
    if (res?.success === false) return []
    return Array.isArray(res?.accounts) ? res.accounts : []
  }

  const loadList = async ({ search = q, keepLoader = true } = {}) => {
    if (keepLoader) setLoading(true)
    try {
      const nextAccounts = await fetchAccounts({ search })
      setAccounts(rankAccountsByQuery(nextAccounts, search))
    } catch (err) {
      toast.error(err?.message || 'Cari listesi yuklenemedi')
    } finally {
      if (keepLoader) setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      if (cancelled) return
      await loadList({ search: q, keepLoader: true })
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [q, branchKey])

  const createAccount = async () => {
    if (createSaving) return
    const name = String(createForm.name || '').trim()
    if (!name) {
      setCreateError('Isim zorunlu')
      createNameRef.current?.focus?.()
      return
    }
    setCreateError('')
    setCreateSaving(true)
    try {
      const res = await api('/api/accounts', { method: 'POST', body: JSON.stringify({ ...createForm, name }), silent: true })
      if (!res?.ok) {
        if (res?.code === 'duplicate') {
          const msg = String(res?.message || 'Kayit zaten var')
          setCreateError(msg)
          toast.error(msg)
          const field = String(res?.field || '')
          if (field === 'phone') createPhoneRef.current?.focus?.()
          else createNameRef.current?.focus?.()
          return
        }
        const msg = String(res?.message || 'Islem basarisiz')
        setCreateError(msg)
        toast.error(msg)
        return
      }

      const account = res?.account || null
      const newId = account?.id || account?._id || null
      toast.success('Cari olusturuldu')
      setCreateOpen(false)
      setCreateForm({ name: '', phone: '', note: '' })
      setCreateError('')
      await loadList({ search: q })
      if (newId) nav(`/kermes/app/accounts/${newId}`)
    } catch (err) {
      const msg = err?.message || 'Islem basarisiz'
      setCreateError(msg)
      toast.error(msg)
    } finally {
      setCreateSaving(false)
    }
  }

  const openEdit = (account) => {
    const current = account || {}
    setEditId(current.id || current._id || null)
    setEditForm({
      name: String(current.name || ''),
      phone: String(current.phone || ''),
      note: String(current.note || '')
    })
    setEditError('')
    setEditOpen(true)
    window.setTimeout(() => {
      editNameRef.current?.focus?.()
      editNameRef.current?.select?.()
    }, 0)
  }

  const saveEdit = async () => {
    if (!editId) return
    const name = String(editForm.name || '').trim()
    if (!name) {
      setEditError('Isim zorunlu')
      editNameRef.current?.focus?.()
      return
    }
    setEditError('')
    const res = await api(`/api/accounts/${editId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...editForm, name }),
      silent: true
    })
    if (!res?.ok) {
      if (res?.code === 'duplicate') {
        const msg = String(res?.message || 'Kayit zaten var')
        setEditError(msg)
        const field = String(res?.field || '')
        if (field === 'phone') editPhoneRef.current?.focus?.()
        else editNameRef.current?.focus?.()
        return
      }
      setEditError(String(res?.message || 'Guncelleme basarisiz'))
      return
    }
    toast.success('Cari guncellendi')
    setEditOpen(false)
    setEditId(null)
    setEditError('')
    await loadList({ search: q })
  }

  const confirmDelete = (account) => {
    setDeleteId(account?.id || account?._id || null)
    setDeleteConfirmOpen(true)
  }

  const deleteAccount = async () => {
    if (!deleteId) return
    setDeletingAccount(true)
    const res = await api(`/api/accounts/${deleteId}`, { method: 'DELETE', silent: true })
    if (res?.ok) {
      toast.success('Cari silindi')
      setDeleteId(null)
      await loadList({ search: q })
      setDeletingAccount(false)
      return
    }
    if (res?.code === 'duplicate') {
      toast.error(res?.message || 'Kayit zaten var')
      setDeletingAccount(false)
      return
    }
    if (res?.code === 'has_transactions') {
      toast.error(res?.message || 'Bu cari hareket gordugu icin silinemez. Pasife alabilirsiniz.')
    } else if (res?.message) {
      toast.error(res.message)
    }
    setDeletingAccount(false)
  }

  const exportAccounts = async () => {
    setExporting(true)
    try {
      const rows = await fetchAccounts({ search: q, limit: 5000 })
      const blob = new Blob(['\ufeff', buildAccountsExcelHtml(rows)], {
        type: 'application/vnd.ms-excel;charset=utf-8;'
      })
      const suffix = String(q || '').trim() ? `-${String(q).trim().replaceAll(/\s+/g, '-')}` : ''
      downloadBlob(blob, `cari-hesaplar${suffix}.xls`)
    } catch (err) {
      toast.error(err?.message || 'Cari listesi indirilemedi')
    } finally {
      setExporting(false)
    }
  }

  const renderActionButtons = (account) => {
    if (!canManage) return null
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button
          className="btn btn--xs"
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            openEdit(account)
          }}
        >
          Duzenle
        </button>
        <button
          className="btn btn--xs btn--danger-soft"
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            confirmDelete(account)
          }}
        >
          Sil
        </button>
      </div>
    )
  }

  const renderCards = () => (
    <div
      style={{
        display: 'grid',
        gap: 14,
        gridTemplateColumns: isMobilePortrait ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))'
      }}
    >
      {(accounts || []).map((account) => {
        const balance = Number(account?.balance || 0)
        return (
          <div
            key={String(account?.id || account?._id)}
            className="card"
            onClick={() => nav(`/kermes/app/accounts/${account.id || account._id}`)}
            style={{
              cursor: 'pointer',
              display: 'grid',
              gap: 14,
              minHeight: 180,
              border: '1px solid var(--border)',
              background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-surface, var(--panel)) 92%, #eef4ff) 0%, var(--app-surface, var(--panel)) 100%)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0, display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1, wordBreak: 'break-word' }}>
                  {account?.name || 'Cari'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{account?.phone || 'Telefon yok'}</div>
              </div>
              {renderActionButtons(account)}
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', minHeight: 36 }}>
                {String(account?.note || '').trim() || 'Not girilmemis'}
              </div>
              <div
                style={{
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  padding: '12px 14px',
                  background: 'color-mix(in srgb, var(--app-surface-soft, var(--panelElevated)) 92%, #ffffff)'
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Bakiye</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: balance > 0 ? '#b45309' : '#047857' }}>
                  {toMoney(balance)} TL
                </div>
              </div>
            </div>

            <div style={{ marginTop: 'auto', fontSize: 12, color: 'var(--muted)' }}>
              Detay, hareket ve tahsilat icin karta dokunun.
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderTable = () => (
    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr style={{ background: 'var(--app-surface-soft, var(--panelElevated))' }}>
              <th style={{ padding: '14px 16px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Isim</th>
              <th style={{ padding: '14px 16px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Telefon</th>
              <th style={{ padding: '14px 16px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Not</th>
              <th style={{ padding: '14px 16px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Bakiye</th>
              {canManage ? (
                <th style={{ padding: '14px 16px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Islem</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {(accounts || []).map((account) => {
              const balance = Number(account?.balance || 0)
              return (
                <tr
                  key={String(account?.id || account?._id)}
                  onClick={() => nav(`/kermes/app/accounts/${account.id || account._id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 800 }}>{account?.name || 'Cari'}</td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>{account?.phone || '-'}</td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', maxWidth: 320 }}>
                    {String(account?.note || '').trim() || '-'}
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 900, color: balance > 0 ? '#b45309' : '#047857', whiteSpace: 'nowrap' }}>
                    {toMoney(balance)} TL
                  </td>
                  {canManage ? (
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                      {renderActionButtons(account)}
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className={isMobilePortrait ? 'main pageMobile' : 'main'} style={{ display: 'grid', gap: 14 }}>
      {missingBranch ? (
        <div className="card" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ maxWidth: 520, width: '100%', display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              Sube yetkisi yok. Ayarlar &gt; Sistem Ayarlari &gt; Yetkili Subeler'den sube sec.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {user?.role === 'tenant_admin' && (
                <button className="btn" onClick={() => { window.location.href = '/kermes/settings/system' }}>
                  Sistem Ayarlari
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="input"
                placeholder="Isim veya telefon yaz..."
                value={q}
                onChange={(event) => setQ(event.target.value)}
                style={{ flex: '1 1 280px', minWidth: 220 }}
              />
              {q ? (
                <button className="btn" type="button" onClick={() => setQ('')}>
                  Temizle
                </button>
              ) : null}
              <button className="btn" type="button" onClick={exportAccounts} disabled={exporting || loading}>
                {exporting ? 'Indiriliyor...' : 'Indir'}
              </button>
              {canManage ? (
                <button className="btn" type="button" onClick={() => setCreateOpen(true)}>
                  Yeni Cari
                </button>
              ) : null}
              <div
                style={{
                  display: 'inline-flex',
                  gap: 6,
                  padding: 4,
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  background: 'var(--app-surface-soft, var(--panelElevated))'
                }}
              >
                <button
                  className="btn btn--xs"
                  type="button"
                  onClick={() => setViewMode('cards')}
                  style={{
                    minWidth: 88,
                    background: viewMode === 'cards' ? 'var(--theme-accent, #111827)' : 'transparent',
                    color: viewMode === 'cards' ? '#fff' : 'inherit'
                  }}
                >
                  Liste
                </button>
                <button
                  className="btn btn--xs"
                  type="button"
                  onClick={() => setViewMode('table')}
                  style={{
                    minWidth: 88,
                    background: viewMode === 'table' ? 'var(--theme-accent, #111827)' : 'transparent',
                    color: viewMode === 'table' ? '#fff' : 'inherit'
                  }}
                >
                  Tablo
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13 }}>
              <div>{loading ? 'Cari listesi guncelleniyor...' : `${accounts.length} cari listelendi`}</div>
              <div>{viewMode === 'table' ? 'Bir satira tiklayarak detay sayfasini acabilirsiniz.' : 'Bir karta tiklayarak detay sayfasini acabilirsiniz.'}</div>
            </div>
          </div>

          {viewMode === 'table' ? renderTable() : renderCards()}

          {!loading && (accounts || []).length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 28 }}>
              Aramaniza uygun cari bulunamadi.
            </div>
          ) : null}

          <Modal open={createOpen} onClose={() => { setCreateOpen(false); setCreateError('') }} title="Yeni Cari">
            <div style={{ display: 'grid', gap: 10 }}>
              {!!createError && (
                <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
                  <div style={{ fontWeight: 700, color: '#b91c1c' }}>{createError}</div>
                </div>
              )}
              <label>Isim <input ref={createNameRef} className="input" value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} /></label>
              <label>Telefon <input ref={createPhoneRef} className="input" value={createForm.phone} onChange={(event) => setCreateForm({ ...createForm, phone: event.target.value })} /></label>
              <label>Not <input className="input" value={createForm.note} onChange={(event) => setCreateForm({ ...createForm, note: event.target.value })} /></label>
              <button className="btn" onClick={createAccount} disabled={createSaving}>{createSaving ? 'Kaydediliyor...' : 'Kaydet'}</button>
            </div>
          </Modal>

          <Modal open={editOpen} onClose={() => { setEditOpen(false); setEditError('') }} title="Cari Duzenle">
            <div style={{ display: 'grid', gap: 10 }}>
              {!!editError && (
                <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
                  <div style={{ fontWeight: 700, color: '#b91c1c' }}>{editError}</div>
                </div>
              )}
              <label>Isim <input ref={editNameRef} className="input" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></label>
              <label>Telefon <input ref={editPhoneRef} className="input" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} /></label>
              <label>Not <input className="input" value={editForm.note} onChange={(event) => setEditForm({ ...editForm, note: event.target.value })} /></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={saveEdit}>Kaydet</button>
                <button className="btn" onClick={() => setEditOpen(false)}>Vazgec</button>
              </div>
            </div>
          </Modal>

          <ConfirmModal
            open={deleteConfirmOpen}
            onClose={() => setDeleteConfirmOpen(false)}
            title="Bu cari silinsin mi?"
            confirmText={deletingAccount ? 'Siliniyor...' : 'Evet, Sil'}
            cancelText="Vazgec"
            danger
            onConfirm={async () => {
              setDeleteConfirmOpen(false)
              await deleteAccount()
            }}
          />
        </>
      )}
    </div>
  )
}
