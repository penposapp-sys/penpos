import React, { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { toast } from '../lib/toast.js'

const baseUrl = '/api'

const parseFilenameFromDisposition = (value) => {
  const v = String(value || '')
  const match = v.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i)
  const raw = match?.[1] || match?.[2] || ''
  try {
    const decoded = decodeURIComponent(raw)
    return decoded || null
  } catch {
    return raw || null
  }
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

const fetchWithAuth = async (path, options = {}) => {
  const token = localStorage.getItem('token_restaurant')
  const selectedBranchId = localStorage.getItem('selectedBranchId')
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(selectedBranchId ? { 'x-branch-id': selectedBranchId } : {}),
    ...(options.headers || {})
  }
  const url = /^https?:\/\//i.test(path)
  ? path
  : (String(path || '').startsWith('/api/')
      ? String(path)
      : `${baseUrl}${String(path || '').startsWith('/') ? '' : '/'}${path}`)

  return fetch(url, { ...options, headers })
}

export default function BulkProductsExcelCard() {
  const [importOpen, setImportOpen] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const errors = useMemo(() => (Array.isArray(result?.errors) ? result.errors : []), [result])

  const onDownload = async (path, fallbackName) => {
    setBusy(true)
    try {
      const res = await fetchWithAuth(path)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'İndirme başarısız')
      }
      const cd = res.headers.get('content-disposition')
      const filename = parseFilenameFromDisposition(cd) || fallbackName
      const blob = await res.blob()
      downloadBlob(blob, filename)
      toast.success('İndirme başladı')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const onUpload = async (e) => {
    e.preventDefault()
    if (!file) {
      toast.error('Lütfen bir dosya seçin')
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetchWithAuth('/api/settings/products/import', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.success === false) {
        throw new Error(data.message || 'Yükleme başarısız')
      }
      setResult(data)
      setResultOpen(true)
      toast.success('İçe aktarma tamamlandı')
      setImportOpen(false)
      setFile(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600 }}>Toplu Ürün İşlemleri (Excel)</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Şablonu indir, ürünleri Excel’e aktar veya Excel/CSV ile toplu güncelle.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => onDownload('/api/settings/products/template?format=xlsx', 'products_template.xlsx')} disabled={busy}>Örnek Şablon İndir</button>
            <button className="btn" onClick={() => onDownload('/api/settings/products/export?format=xlsx', 'products_export.xlsx')} disabled={busy}>Mevcut Ürünleri İndir</button>
            <button className="btn" onClick={() => setImportOpen(true)} disabled={busy}>Excel/CSV Yükle</button>
          </div>
        </div>
      </div>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Excel/CSV ile Toplu Ürün Yükle">
        <form onSubmit={onUpload} style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Desteklenen format: .xlsx veya .csv (max 5MB, max 5000 satır)
          </div>
          <input
            className="input"
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button className="btn" disabled={busy}>{busy ? 'Yükleniyor...' : 'Yükle'}</button>
        </form>
      </Modal>

      <Modal open={resultOpen} onClose={() => setResultOpen(false)} title="Toplu Ürün İşlemi Sonucu">
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="card" style={{ borderColor: 'var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Toplam Satır</div>
                <div style={{ fontWeight: 800 }}>{result?.totalRows ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Eklenen</div>
                <div style={{ fontWeight: 800, color: '#22c55e' }}>{result?.created ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Güncellenen</div>
                <div style={{ fontWeight: 800 }}>{result?.updated ?? 0}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Hatalı</div>
                <div style={{ fontWeight: 800, color: errors.length ? '#ef4444' : 'var(--text)' }}>{result?.failed ?? errors.length}</div>
              </div>
            </div>

            {(result?.createdCategories !== undefined || result?.matchedCategories !== undefined || result?.missingCategoryRows !== undefined) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yeni Kategori</div>
                  <div style={{ fontWeight: 800, color: '#22c55e' }}>{result?.createdCategories ?? 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Eşleşen Kategori</div>
                  <div style={{ fontWeight: 800 }}>{result?.matchedCategories ?? 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kategorisi Boş Satır</div>
                  <div style={{ fontWeight: 800, color: (result?.missingCategoryRows || 0) > 0 ? '#f59e0b' : 'var(--text)' }}>{result?.missingCategoryRows ?? 0}</div>
                </div>
              </div>
            )}
          </div>

          {errors.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--border)' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Hatalı Satırlar</div>
              <div style={{ maxHeight: 320, overflow: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr><th>Satır</th><th>Alan</th><th>Mesaj</th></tr>
                  </thead>
                  <tbody>
                    {errors.slice(0, 200).map((er, idx) => (
                      <tr key={idx}>
                        <td style={{ width: 80 }}>{er.row}</td>
                        <td style={{ width: 160 }}>{er.field}</td>
                        <td>{er.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {errors.length > 200 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                  Çok fazla hata var. İlk 200 hata gösteriliyor.
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
