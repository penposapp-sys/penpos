import React, { useRef, useState } from 'react'
import { Database, Download, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'

const ACTIONS = [
  {
    key: 'cash',
    title: 'Kasa Verisi',
    description: 'Geçmiş satış ve adisyon kayıtlarını yedekleyin veya silin.',
    backupLabel: 'Kasa Verisi Çek',
    deleteLabel: 'Kasa Verilerini Sil'
  },
  {
    key: 'productDetails',
    title: 'Ürün Verisi',
    description: 'Yalnızca geçmiş satışların ürün kalemlerini yedekleyin veya temizleyin.',
    backupLabel: 'Ürün Verisi Çek',
    deleteLabel: 'Ürün Verilerini Sil'
  },
  {
    key: 'reset',
    title: 'Tüm Sistemi Sıfırla',
    description: 'Satışları ve operasyonel hareketleri temizleyip firmayı başlangıç durumuna getirir.',
    backupLabel: 'Sıfırlama Önizlemesi',
    deleteLabel: 'Tüm Sistemi Sıfırla',
    danger: true
  }
]

const SYSTEM_LABELS = {
  restaurant: 'Restoran',
  canteen: 'Kantin/Market'
}

const COLLECTION_LABELS = {
  accountappearancepreferences: 'Kullanıcı görünüm tercihleri',
  accounttransactions: 'Cari borç/alacak ve tahsilat hareketleri',
  auditlogs: 'Denetim kayıtları',
  branches: 'Şubeler',
  canteenbranches: 'Şubeler',
  canteencategories: 'Ürün kategorileri',
  canteencustomercollections: 'Cari tahsilatlar',
  canteencustomers: 'Cari kişiler',
  canteenproductbatches: 'Ürün stok partileri',
  canteenproducts: 'Ürün kataloğu',
  canteenqrorders: 'QR siparişleri',
  canteensales: 'Kasa satışları',
  canteenstockcountitems: 'Stok sayım kalemleri',
  canteenstockcountsessions: 'Stok sayım oturumları',
  canteenstockmovements: 'Stok hareketleri',
  canteentenantpaymentsettings: 'Ödeme ayarları',
  canteentenantsettings: 'İşletme ayarları',
  categories: 'Ürün kategorileri',
  customeraccounts: 'Cari kişiler',
  deliverycustomers: 'Paket servis müşteri kayıtları',
  kitchenbulkprepstates: 'Mutfak hazırlık hareketleri',
  lucaextensiondevices: 'Luca entegrasyon cihazları',
  membershiprequests: 'Üyelik talepleri',
  menuitems: 'Ürün kataloğu',
  ordercounters: 'Satış numara sayaçları',
  orders: 'Geçmiş satışlar ve adisyonlar',
  paymentrequests: 'Abonelik ödeme kayıtları',
  paymentsettings: 'Ödeme ayarları',
  printjobs: 'Yazdırma işleri',
  printprinters: 'Yazıcılar',
  printprofiles: 'Yazıcı profilleri',
  printstations: 'Yazdırma istasyonları',
  tables: 'Masalar',
  tenantusagedailies: 'Günlük kullanım kayıtları',
  tenantusagesessions: 'Kullanım oturumları',
  tenantwebsitesettings: 'Web sitesi ayarları',
  userpreferences: 'Kullanıcı tercihleri',
  waitercalls: 'Garson çağrıları',
  users: 'Kullanıcı erişimleri',
}
const REFERENCE_LABELS = {
  'canteen_qr_orders.customerId': 'QR sipariş müşteri bağlantıları',
  'canteen_qr_orders.cariId': 'QR sipariş cari bağlantıları',
  'canteen_sales.items.batchId': 'Satış kalemlerinin stok partisi bağlantıları',
  'users.branchId': 'Kullanıcının aktif şubesi',
  'users.branchIds': 'Kullanıcı şube erişimleri',
  'users.accessibleBranchIds': 'Kullanıcının erişilebilir şubeleri',
  'print_jobs.stationId': 'Yazdırma işi istasyonu',
  'print_jobs.lockedByStationId': 'Yazdırma işi kilit istasyonu'
}

const formatCount = (value) => new Intl.NumberFormat('tr-TR').format(Number(value) || 0)
const normalizeCollectionLabelKey = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '')

const fileSafeName = (value) => String(value || 'firma')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9_-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase() || 'firma'

export default function DataManagementPage({ system = 'restaurant' }) {
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [scopeWarnings, setScopeWarnings] = useState([])
  const [confirmationName, setConfirmationName] = useState('')
  const [backupDownloaded, setBackupDownloaded] = useState(false)
  const [resetToken, setResetToken] = useState('')
  const [fullBackupBusy, setFullBackupBusy] = useState(false)
  const [restoreFile, setRestoreFile] = useState(null)
  const restoreInputRef = useRef(null)
  const [restorePreview, setRestorePreview] = useState(null)
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false)
  const [referenceCleanupConfirmed, setReferenceCleanupConfirmed] = useState(false)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const apiBase = system === 'canteen' ? '/api/canteen' : '/api/tenant'

  const createPreview = async (action) => {
    setBusy(true)
    setError('')
    setPreview(null)
    setScopeWarnings([])
    setConfirmationName('')
    setBackupDownloaded(false)
    try {
      const response = await api(`${apiBase}/data-management/preview`, {
        method: 'POST',
        data: { action },
        silent: true,
        skipBranchHeader: true
      })
      if (!response?.ok) {
        setError(response?.message || 'Yedek önizlemesi oluşturulamadı.')
        return
      }
      setPreview(response)
      setScopeWarnings(response.warnings || [])
    } catch (requestError) {
      setError(requestError?.message || 'Yedek önizlemesi oluşturulamadı.')
    } finally {
      setBusy(false)
    }
  }

  const downloadBackup = () => {
    if (!preview?.backup) return
    const blob = new Blob([JSON.stringify(preview.backup, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `penpos-${fileSafeName(preview.tenantName)}-${preview.action}-yedek-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setBackupDownloaded(true)
  }

  const downloadFullBackup = async () => {
    setFullBackupBusy(true)
    setError('')
    setScopeWarnings([])
    try {
      const response = await api(`${apiBase}/data-management/backup`, {
        method: 'POST',
        data: {},
        silent: true,
        skipBranchHeader: true
      })
      if (!response?.ok || !response.backup || !response.resetToken) {
        setError(response?.message || 'Tam JSON yedeği oluşturulamadı.')
        return
      }
      const blob = new Blob([JSON.stringify(response.backup, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `penpos-${fileSafeName(response.backup.tenant?.name)}-tam-yedek-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setResetToken(response.resetToken)
      setScopeWarnings(response.warnings || [])
      toast.success('Tam JSON yedeği indirildi. Sıfırlama onayı 15 dakika geçerlidir.')
    } catch (requestError) {
      setError(requestError?.message || 'Tam JSON yedeği oluşturulamadı.')
    } finally {
      setFullBackupBusy(false)
    }
  }

  const previewRestore = async (event) => {
    event.preventDefault()
    if (!restoreFile) {
      setError('Önce bir JSON yedek dosyası seçin.')
      return
    }
    setRestoreBusy(true)
    setError('')
    setRestorePreview(null)
    setOverwriteConfirmed(false)
    setReferenceCleanupConfirmed(false)
    setScopeWarnings([])
    const form = new FormData()
    form.append('file', restoreFile)
    try {
      const response = await api(`${apiBase}/data-management/restore/preview`, {
        method: 'POST',
        body: form,
        silent: true,
        skipBranchHeader: true
      })
      if (!response?.ok) {
        setError(response?.message || 'Yedek dosyası doğrulanamadı.')
        return
      }
      setRestorePreview(response)
      setScopeWarnings(response.warnings || [])
    } catch (requestError) {
      setError(requestError?.message || 'Yedek dosyası doğrulanamadı.')
    } finally {
      setRestoreBusy(false)
    }
  }

  const runRestore = async () => {
    const backupIdentityVerified = restorePreview &&
      restorePreview.tenantId === restorePreview.backupTenantId &&
      restorePreview.system === restorePreview.backupSystem &&
      restorePreview.system === system
    if (
      !restoreFile ||
      !backupIdentityVerified ||
      !overwriteConfirmed ||
      (restorePreview.referenceWarnings?.length > 0 && !referenceCleanupConfirmed) ||
      confirmationName !== restorePreview.tenantName
    ) return
    setRestoreBusy(true)
    setError('')
    const form = new FormData()
    form.append('file', restoreFile)
    form.append('confirmationName', confirmationName)
    form.append('overwriteConfirmed', 'true')
    if (referenceCleanupConfirmed) form.append('referenceCleanupConfirmed', 'true')
    form.append('expectedChecksum', restorePreview.checksum)
    try {
      const response = await api(`${apiBase}/data-management/restore/execute`, {
        method: 'POST',
        body: form,
        silent: true,
        skipBranchHeader: true
      })
      if (!response?.ok) {
        setError(response?.message || 'Yedek geri yüklenemedi.')
        return
      }
      toast.success(`${response.tenantName} için ${formatCount(response.totalRestored)} kayıt geri yüklendi.`)
      setRestorePreview(null)
      setRestoreFile(null)
      if (restoreInputRef.current) restoreInputRef.current.value = ''
      setConfirmationName('')
      setOverwriteConfirmed(false)
      setReferenceCleanupConfirmed(false)
    } catch (requestError) {
      setError(requestError?.message || 'Yedek geri yüklenemedi.')
    } finally {
      setRestoreBusy(false)
    }
  }

  const runAction = async () => {
    if (
      !preview ||
      (preview.action !== 'reset' && !backupDownloaded) ||
      (preview.action === 'reset' && !resetToken) ||
      confirmationName !== preview.tenantName
    ) return
    setBusy(true)
    setError('')
    try {
      const response = await api(`${apiBase}/data-management/execute`, {
        method: 'POST',
        data: {
          action: preview.action,
          confirmationName,
          backupHash: preview.backupHash,
          counts: preview.counts,
          resetToken
        },
        silent: true,
        skipBranchHeader: true
      })
      if (!response?.ok) {
        setError(response?.message || 'Veri işlemi tamamlanamadı.')
        return
      }
      toast.success(`${response.tenantName} için işlem tamamlandı. ${formatCount(response.totalAffected)} kayıt etkilendi.`)
      setPreview(null)
      setConfirmationName('')
      setBackupDownloaded(false)
      if (preview.action === 'reset') setResetToken('')
    } catch (requestError) {
      setError(requestError?.message || 'Veri işlemi tamamlanamadı.')
    } finally {
      setBusy(false)
    }
  }

  const selectedAction = ACTIONS.find((item) => item.key === preview?.action)
  const backupIdentityVerified = restorePreview &&
    restorePreview.tenantId === restorePreview.backupTenantId &&
    restorePreview.system === restorePreview.backupSystem &&
    restorePreview.system === system

  return (
    <div className="main pageMobile" style={{ display: 'grid', gap: 18, maxWidth: 1080, margin: '0 auto', width: '100%' }}>
      <header className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: 20 }}>
        <Database size={28} aria-hidden="true" />
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Veri Yönetimi</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--muted)', lineHeight: 1.55 }}>
            Tam JSON yedeği, geri yükleme ve firma sıfırlama işlemleri yalnızca firma yöneticisine açıktır. Geri yükleme mevcut kayıtları yedekteki hâliyle değiştirir.
          </p>
        </div>
      </header>

      <section className="card" style={{ display: 'grid', gap: 12, padding: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>JSON Tam Yedekleme ve Geri Yükleme</h2>
        <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.55 }}>
          Firmanın MongoDB kayıtları ve ilişkili ayarları BSON EJSON biçiminde yedeklenir. Yedek yalnızca aynı firma kimliği ve işletme türü için geri yüklenebilir.
        </p>
        <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.55 }}>
          Tüm sistemi sıfırlamadan önce tam yedek indirilir; işlemden önce firma adı ve silinecek kayıt sayıları gösterilir. Firma adı aynen onaylanmadan sıfırlama yapılmaz. Yalnızca bu firmanın işletme türüyle eşleşen ve tenant ilişkisi doğrulanan koleksiyonlar kullanılır.
        </p>
        <button type="button" className="btn" onClick={downloadFullBackup} disabled={busy || fullBackupBusy}>
          <Download size={17} /> {fullBackupBusy ? 'Tam yedek hazırlanıyor…' : 'JSON Yedeği İndir'}
        </button>

        <form onSubmit={previewRestore} style={{ display: 'grid', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <label style={{ display: 'grid', gap: 7, fontWeight: 750 }}>
            PenPOS JSON yedek dosyası
            <input
              ref={restoreInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                setRestoreFile(event.target.files?.[0] || null)
                setRestorePreview(null)
                setOverwriteConfirmed(false)
                setReferenceCleanupConfirmed(false)
              }}
              disabled={restoreBusy}
            />
          </label>
          <button type="submit" className="btn" disabled={restoreBusy || !restoreFile}>
            {restoreBusy ? 'Yedek doğrulanıyor…' : 'JSON Yedeğini Doğrula'}
          </button>
        </form>

        {restorePreview ? (
          <div style={{ display: 'grid', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div>
              <strong>Yedek firması:</strong> {restorePreview.tenantName}
              {restorePreview.backupTenantName !== restorePreview.tenantName ? (
                <div style={{ color: 'var(--muted)', marginTop: 4 }}>Yedek geri yüklendiğinde firma adı “{restorePreview.backupTenantName}” olarak değişir.</div>
              ) : null}
              <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                Firma kimliği: {restorePreview.tenantId} · Yedek kimliği: {restorePreview.backupTenantId} · İşletme türü: {SYSTEM_LABELS[restorePreview.system] || restorePreview.system}
              </div>
              <div style={{ color: backupIdentityVerified ? '#16803c' : '#b91c1c', marginTop: 4, fontWeight: 700 }}>
                {backupIdentityVerified
                  ? 'Firma kimliği ve işletme türü doğrulandı.'
                  : 'Yedek firma kimliği veya işletme türü eşleşmiyor.'}
              </div>
              <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                Yedek kayıt: {formatCount(restorePreview.backupTotal)} · Mevcut kayıt: {formatCount(restorePreview.currentTotal)}
              </div>
              {restorePreview.queuedJobsToReassign !== undefined ? (
                <div role="status" style={{ color: 'var(--warning-text, #92400e)', marginTop: 6, fontWeight: 700 }}>
                  {restorePreview.queuedJobsToReassign > 0
                    ? `${formatCount(restorePreview.queuedJobsToReassign)} bekleyen yazdırma işi, eski istasyon ataması kaldırılarak yeniden atanabilir hâle getirilecek.`
                    : 'Yeniden atanması gereken bekleyen yazdırma işi yok; yedekte bulunan istasyon atamaları korunacak.'}
                </div>
              ) : null}
              {Object.values(restorePreview.preservedStationReferenceCounts || {}).some((count) => count > 0) ? (
                <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                  Tamamlanmış/geçmiş yazdırma işlerinin istasyon referansları aynen korunacak.
                  {restorePreview.preservedStationReferenceCounts.stationId > 0
                    ? ` Geçmiş stationId: ${formatCount(restorePreview.preservedStationReferenceCounts.stationId)}.`
                    : ''}
                  {restorePreview.preservedStationReferenceCounts.lockedByStationId > 0
                    ? ` lockedByStationId: ${formatCount(restorePreview.preservedStationReferenceCounts.lockedByStationId)}.`
                    : ''}
                </div>
              ) : null}
              {Object.entries(restorePreview.preservedReferenceCounts || {}).length > 0 ? (
                <div role="status" style={{ display: 'grid', gap: 3, color: 'var(--muted)', marginTop: 6 }}>
                  <strong>Eksik hedefi bulunan tarihsel bağlantılar korunacak</strong>
                  {Object.entries(restorePreview.preservedReferenceCounts).map(([field, count]) => (
                    <div key={field}>
                      {REFERENCE_LABELS[field] || field}: {formatCount(count)}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={{ display: 'grid', gap: 5 }}>
              {Object.entries(restorePreview.backupCounts || {}).map(([collection, count]) => (
                <div key={collection} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
                  <span>{COLLECTION_LABELS[normalizeCollectionLabelKey(collection)] || collection}</span>
                  <strong>{formatCount(count)}</strong>
                </div>
              ))}
            </div>
            {restorePreview.referenceWarnings?.length > 0 ? (
              <div role="alert" style={{ display: 'grid', gap: 6, padding: 12, border: '1px solid var(--warning, #f59e0b)', borderRadius: 8, color: 'var(--warning-text, #92400e)' }}>
                <strong>Yedekteki bazı isteğe bağlı bağlantılar hedef kaydını bulamadı</strong>
                {restorePreview.referenceWarnings.map((warning) => <div key={warning}>{warning}</div>)}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, lineHeight: 1.5, marginTop: 4 }}>
                  <input type="checkbox" checked={referenceCleanupConfirmed} onChange={(event) => setReferenceCleanupConfirmed(event.target.checked)} />
                  <span>Diğer eksik isteğe bağlı bağlantıların geri yüklenen kayıtlarda boş bırakılmasını onaylıyorum.</span>
                </label>
              </div>
            ) : null}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, lineHeight: 1.5 }}>
              <input type="checkbox" checked={overwriteConfirmed} onChange={(event) => setOverwriteConfirmed(event.target.checked)} />
              <span>Bu işlem mevcut firmanın tüm kayıtlarını yedekteki hâliyle değiştirecek. Bunu açıkça onaylıyorum.</span>
            </label>
            <label style={{ display: 'grid', gap: 7, maxWidth: 520, fontWeight: 750 }}>
              Onaylamak için firma adını aynen yazın: {restorePreview.tenantName}
              <input className="input" value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} autoComplete="off" />
            </label>
            <button type="button" className="btn btn--danger" onClick={runRestore} disabled={restoreBusy || !backupIdentityVerified || !overwriteConfirmed || (restorePreview.referenceWarnings?.length > 0 && !referenceCleanupConfirmed) || confirmationName !== restorePreview.tenantName}>
              {restoreBusy ? 'Yedek geri yükleniyor…' : 'Mevcut Verileri Yedekten Geri Yükle'}
            </button>
          </div>
        ) : null}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 14 }}>
        {ACTIONS.map((action) => (
          <article key={action.key} className="card" style={{ display: 'grid', alignContent: 'start', gap: 12, padding: 18, borderColor: action.danger ? '#ef4444' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {action.danger ? <RotateCcw size={20} color="#dc2626" /> : <Database size={20} />}
              <h2 style={{ margin: 0, fontSize: 17 }}>{action.title}</h2>
            </div>
            <p style={{ margin: 0, minHeight: 48, color: 'var(--muted)', lineHeight: 1.5 }}>{action.description}</p>
            {action.key === 'reset' ? (
              <button type="button" className="btn" disabled={busy || !resetToken} onClick={() => createPreview(action.key)}>
                {!resetToken ? 'Önce Tam JSON Yedeği İndirin' : action.backupLabel}
              </button>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))', gap: 8 }}>
                <button type="button" className="btn" disabled={busy} onClick={() => createPreview(action.key)}>
                  {action.backupLabel}
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  disabled={busy}
                  onClick={() => createPreview(action.key)}
                >
                  <Trash2 size={16} /> Verileri Sil
                </button>
              </div>
            )}
          </article>
        ))}
      </section>

      <aside className="card" style={{ padding: 18, borderColor: 'var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 800 }}>
          <ShieldCheck size={20} color="#16803c" />
          Korunan veriler
        </div>
        <p style={{ margin: '8px 0 0', color: 'var(--muted)', lineHeight: 1.55 }}>
          Tam sıfırlama firma hesabını, aboneliği, kullanıcı erişimini ve abonelik ödeme kayıtlarını korur. Şubeler, işletme ve ödeme ayarları, yazıcı kurulumu, denetim/kullanım kayıtları, kullanıcı tercihleri ve diğer işletme verileri seçili firmada temizlenir.
        </p>
      </aside>

      {error ? <div role="alert" className="card" style={{ padding: 14, color: '#b91c1c', borderColor: '#ef4444' }}>{error}</div> : null}
      {scopeWarnings.length > 0 ? (
        <div role="status" className="card" style={{ display: 'grid', gap: 6, padding: 14, borderColor: 'var(--warning, #f59e0b)', color: 'var(--warning-text, #92400e)' }}>
          <strong>Bazı veriler kapsam dışında bırakıldı</strong>
          {scopeWarnings.map((warning) => <div key={warning}>{warning}</div>)}
        </div>
      ) : null}

      {preview && selectedAction ? (
        <section className="card" style={{ display: 'grid', gap: 16, padding: 20, borderColor: selectedAction.danger ? '#ef4444' : undefined }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>İşlem önizlemesi: {selectedAction.title}</h2>
            <p style={{ margin: '8px 0 0' }}>Firma: <strong>{preview.tenantName}</strong></p>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>Etkilenecek toplam kayıt: <strong>{formatCount(preview.totalCount)}</strong></p>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            {Object.entries(preview.counts || {}).map(([collection, count]) => (
              <div key={collection} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border)', padding: '7px 0' }}>
                <span>{COLLECTION_LABELS[collection] || collection}</span>
                <strong>{formatCount(count)}</strong>
              </div>
            ))}
          </div>

          {preview.action !== 'reset' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={downloadBackup} disabled={busy}>
                <Download size={17} /> Yedeği JSON olarak indir
              </button>
              <span style={{ color: backupDownloaded ? '#16803c' : 'var(--muted)', fontWeight: 700 }}>
                {backupDownloaded ? 'Yedek indirildi' : 'İşlemden önce yedeği indirin'}
              </span>
            </div>
          ) : (
            <p style={{ margin: 0, fontWeight: 700, color: resetToken ? '#16803c' : '#b91c1c' }}>
              {resetToken ? 'Tam JSON yedeği indirildi; sıfırlama onayı 15 dakika içinde geçerli.' : 'Sıfırlama öncesinde tam JSON yedeği indirilmesi zorunludur.'}
            </p>
          )}

          <label style={{ display: 'grid', gap: 7, maxWidth: 520, fontWeight: 750 }}>
            Onaylamak için firma adını aynen yazın: {preview.tenantName}
            <input
              className="input"
              value={confirmationName}
              onChange={(event) => setConfirmationName(event.target.value)}
              autoComplete="off"
              disabled={busy}
            />
          </label>

          {preview.action === 'productDetails' ? (
            <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.5 }}>
              Satış/adisyon kayıtları ve tutarları korunur; yalnızca geçmiş satışların ürün kalemleri temizlenir.
            </p>
          ) : null}
          {preview.action === 'reset' ? (
            <p style={{ margin: 0, color: '#b91c1c', fontWeight: 700, lineHeight: 1.5 }}>
              Bu işlem geri alınamaz. İşletmeye ait ürün, stok, cari, satış, borç/alacak, tahsilat ve diğer tenant kayıtları silinir; firma, giriş ve abonelik için gereken temel sistem kayıtları korunur.
            </p>
          ) : null}

          <button
            type="button"
            className={selectedAction.danger ? 'btn btn--danger' : 'btn'}
            onClick={runAction}
            disabled={busy || (preview.action === 'reset' ? !resetToken : !backupDownloaded) || confirmationName !== preview.tenantName}
            style={selectedAction.danger ? { background: '#dc2626', color: '#fff', borderColor: '#dc2626' } : undefined}
          >
            <Trash2 size={17} /> {busy ? 'İşleniyor…' : selectedAction.deleteLabel}
          </button>
        </section>
      ) : null}
    </div>
  )
}
