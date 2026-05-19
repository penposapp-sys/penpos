import React, { useEffect, useState } from 'react'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'
import ConfirmModal from '../ConfirmModal.jsx'
import Modal from '../Modal.jsx'
import { SettingsToggle, SettingsUiStyles } from '../settings/SettingsUi.jsx'

const calcStatus = (lastHeartbeatAt) => {
  if (!lastHeartbeatAt) return { status: 'no_heartbeat', ageSec: null }
  const t = new Date(lastHeartbeatAt).getTime()
  if (!Number.isFinite(t)) return { status: 'no_heartbeat', ageSec: null }
  const ageMs = Date.now() - t
  const ageSec = Math.max(0, ageMs / 1000)
  if (ageMs <= 15000) return { status: 'online', ageSec }
  if (ageMs <= 60000) return { status: 'stale', ageSec }
  return { status: 'offline', ageSec }
}

const shortId = (id) => {
  const v = String(id || '').trim()
  if (!v) return ''
  if (v.length <= 12) return v
  return `${v.slice(0, 6)}...${v.slice(-4)}`
}

const copyText = async (label, text) => {
  const v = String(text || '')
  if (!v) return
  try {
    await navigator.clipboard.writeText(v)
    toast.success('Kopyalandı')
  } catch {
    try { window.prompt(label, v) } catch {}
  }
}

const makeDraftPrinter = (type = 'label') => ({
  id: `tmp_${Math.random().toString(36).slice(2, 10)}`,
  name: type === 'receipt' ? 'Yeni Fiş Yazıcısı' : 'Yeni Etiket Yazıcısı',
  printerType: type === 'receipt' ? 'receipt' : 'label',
  windowsPrinterName: '',
  isActive: true,
  labelCategoryIds: [],
  categoryIds: [],
  receiptRole: 'cashier',
  useForCashierReceipt: true,
  useForKitchenReceipt: false,
  autoPrintOnOrder: type === 'label',
  printOnReady: type === 'label',
  widthMm: 50,
  heightMm: 30,
  receiptWidthMm: 80,
  copies: 1
})

const normalizeDrafts = (list) => (Array.isArray(list) ? list : []).map((entry) => ({
  id: String(entry?.id || entry?._id || `tmp_${Math.random().toString(36).slice(2, 10)}`),
  name: String(entry?.name || ''),
  printerType: String(entry?.printerType || 'label') === 'receipt' ? 'receipt' : 'label',
  windowsPrinterName: String(entry?.windowsPrinterName || ''),
  isActive: entry?.isActive !== false,
  labelCategoryIds: Array.isArray(entry?.labelCategoryIds) ? entry.labelCategoryIds.map(String) : [],
  categoryIds: Array.isArray(entry?.categoryIds) ? entry.categoryIds.map(String) : [],
  receiptRole: String(entry?.receiptRole || '').trim().toLowerCase() === 'kitchen' ? 'kitchen' : 'cashier',
  useForCashierReceipt: typeof entry?.useForCashierReceipt === 'boolean'
    ? entry.useForCashierReceipt === true
    : (String(entry?.receiptRole || '').trim().toLowerCase() === 'kitchen' ? false : true),
  useForKitchenReceipt: typeof entry?.useForKitchenReceipt === 'boolean'
    ? entry.useForKitchenReceipt === true
    : (String(entry?.receiptRole || '').trim().toLowerCase() === 'kitchen'),
  autoPrintOnOrder: entry?.autoPrintOnOrder === true,
  printOnReady: entry?.printOnReady === true,
  widthMm: Number(entry?.widthMm || 50) || 50,
  heightMm: Number(entry?.heightMm || 30) || 30,
  receiptWidthMm: Number(entry?.receiptWidthMm || 80) || 80,
  copies: Math.max(1, Math.min(10, Number(entry?.copies || 1) || 1))
}))

export default function PrintStationsCard({
  busy,
  system,
  stations,
  agentPrinters,
  categories,
  onCreate,
  onActivate,
  onSavePrinters,
  onReload
}) {
  const [rotateStationId, setRotateStationId] = useState('')
  const [deleteStationId, setDeleteStationId] = useState('')
  const [secretModalOpen, setSecretModalOpen] = useState(false)
  const [rotatedSecret, setRotatedSecret] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [draftsByStation, setDraftsByStation] = useState({})

  useEffect(() => {
    const next = {}
    for (const station of (stations || [])) {
      next[String(station.id)] = normalizeDrafts(station?.printers || [])
    }
    setDraftsByStation(next)
  }, [JSON.stringify(stations || [])])

  const blocked = busy || submitting

  const doRotate = async () => {
    const id = String(rotateStationId || '').trim()
    if (!id) return
    setSubmitting(true)
    try {
      const res = await api(`/api/printing/stations/${encodeURIComponent(id)}/rotate-secret`, { method: 'POST', data: { system }, silent: true })
      const secret = String(res?.secret || '').trim()
      if (!secret) throw new Error(res?.message || 'Secret üretilemedi')
      setRotatedSecret(secret)
      setSecretModalOpen(true)
      toast.success('Secret yenilendi')
      if (typeof onReload === 'function') await onReload()
    } catch (e) {
      toast.error(e?.message || 'Secret yenileme başarısız')
    } finally {
      setSubmitting(false)
      setRotateStationId('')
    }
  }

  const doDelete = async () => {
    const id = String(deleteStationId || '').trim()
    if (!id) return
    setSubmitting(true)
    try {
      const qs = `?system=${encodeURIComponent(system)}`
      await api(`/api/printing/stations/${encodeURIComponent(id)}${qs}`, { method: 'DELETE', silent: true })
      toast.success('İstasyon silindi')
      if (typeof onReload === 'function') await onReload()
    } catch (e) {
      toast.error(e?.message || 'Silme başarısız')
    } finally {
      setSubmitting(false)
      setDeleteStationId('')
    }
  }

  const closeSecretModal = () => {
    setSecretModalOpen(false)
    setRotatedSecret('')
  }

  const handleCreate = async () => {
    if (blocked) return
    try {
      const r = typeof onCreate === 'function' ? await onCreate() : null
      const secret = String(r?.secret || '').trim()
      if (secret) {
        setRotatedSecret(secret)
        setSecretModalOpen(true)
      }
    } catch {
    }
  }

  const updateDrafts = (stationId, updater) => {
    const key = String(stationId || '')
    setDraftsByStation((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : []
      return { ...prev, [key]: updater(current) }
    })
  }

  const updateDraft = (stationId, id, field, value) => {
    updateDrafts(stationId, (prev) => prev.map((entry) => {
      if (String(entry.id) !== String(id)) return entry
      const next = { ...entry, [field]: value }
      if (field === 'printerType') {
        if (value === 'receipt') {
          next.autoPrintOnOrder = false
          next.printOnReady = false
          next.labelCategoryIds = []
          next.categoryIds = []
          next.receiptRole = 'cashier'
          next.useForCashierReceipt = true
          next.useForKitchenReceipt = false
        } else {
          next.autoPrintOnOrder = true
          next.printOnReady = true
        }
      }
      if (field === 'useForKitchenReceipt' && value !== true) {
        next.categoryIds = []
      }
      return next
    }))
  }

  const toggleCategory = (stationId, id, categoryId, field = 'labelCategoryIds') => {
    updateDrafts(stationId, (prev) => prev.map((entry) => {
      if (String(entry.id) !== String(id)) return entry
      const set = new Set(entry[field] || [])
      if (set.has(categoryId)) set.delete(categoryId)
      else set.add(categoryId)
      return { ...entry, [field]: Array.from(set) }
    }))
  }

  const removeDraft = (stationId, id) => {
    updateDrafts(stationId, (prev) => prev.filter((entry) => String(entry.id) !== String(id)))
  }

  const addDraft = (stationId, type) => {
    updateDrafts(stationId, (prev) => [...prev, makeDraftPrinter(type)])
  }

  const setAllCategories = (stationId, id, enabled, field = 'labelCategoryIds') => {
    updateDrafts(stationId, (prev) => prev.map((entry) => {
      if (String(entry.id) !== String(id)) return entry
      return {
        ...entry,
        [field]: enabled ? (categories || []).map((category) => String(category.id)) : []
      }
    }))
  }

  const savePrinters = async (stationId) => {
    if (!stationId || typeof onSavePrinters !== 'function') return
    const draftPrinters = Array.isArray(draftsByStation[String(stationId)]) ? draftsByStation[String(stationId)] : []
    const payload = draftPrinters.map((entry) => ({
      id: String(entry.id || '').startsWith('tmp_') ? undefined : entry.id,
      name: entry.name,
      printerType: entry.printerType,
      windowsPrinterName: entry.windowsPrinterName,
      isActive: entry.isActive === true,
      labelCategoryIds: entry.printerType === 'label' ? entry.labelCategoryIds : [],
      categoryIds: entry.printerType === 'receipt' && entry.useForKitchenReceipt === true ? entry.categoryIds : [],
      receiptRole: entry.printerType === 'receipt' ? entry.receiptRole : 'cashier',
      useForCashierReceipt: entry.printerType === 'receipt' ? entry.useForCashierReceipt === true : false,
      useForKitchenReceipt: entry.printerType === 'receipt' ? entry.useForKitchenReceipt === true : false,
      autoPrintOnOrder: entry.printerType === 'label' ? entry.autoPrintOnOrder === true : false,
      printOnReady: entry.printerType === 'label' ? entry.printOnReady === true : false,
      widthMm: entry.printerType === 'label' ? Number(entry.widthMm || 50) : null,
      heightMm: entry.printerType === 'label' ? Number(entry.heightMm || 30) : null,
      receiptWidthMm: entry.printerType === 'receipt' ? Number(entry.receiptWidthMm || 80) : null,
      copies: Math.max(1, Math.min(10, Number(entry.copies || 1) || 1))
    }))
    await onSavePrinters(stationId, payload)
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 10 }}>
      <SettingsUiStyles />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800 }}>Print Station</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>İstasyon bilgisayar demektir. Birden fazla istasyon aynı anda aktif olabilir ve her istasyonun altına birden fazla fiş ve etiket yazıcısı ekleyebilirsin.</div>
        </div>
        <button className="btn" onClick={handleCreate} disabled={blocked}>Yeni İstasyon Ekle</button>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {(stations || []).map((s) => {
          const st = calcStatus(s.lastHeartbeatAt)
          const label = st.status === 'online' ? 'Online' : st.status === 'stale' ? 'Stale' : st.status === 'offline' ? 'Offline' : 'Heartbeat yok'
          const age = typeof st.ageSec === 'number' ? ` · Son görüldü: ${Math.round(st.ageSec)} sn önce` : ''
          const host = String(s.lastHeartbeatMeta?.hostname || '').trim()
          const ver = String(s.lastHeartbeatMeta?.version || '').trim()
          const printersCount = Number.isFinite(Number(s.lastHeartbeatMeta?.printersCount)) ? Number(s.lastHeartbeatMeta.printersCount) : 0
          const configuredPrinters = Array.isArray(s.printers) ? s.printers : []
          const draftPrinters = Array.isArray(draftsByStation[String(s.id)]) ? draftsByStation[String(s.id)] : []
          const availablePrinters = Array.isArray(s.lastHeartbeatMeta?.printers) && s.lastHeartbeatMeta.printers.length > 0
            ? s.lastHeartbeatMeta.printers
            : agentPrinters

          return (
            <div key={s.id} style={{ display: 'grid', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{s.name}</div>
                  <div style={{ marginTop: 2, fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>Station ID: <span style={{ fontFamily: 'monospace' }}>{shortId(s.id)}</span></div>
                    <button className="btn btn--compact" onClick={() => copyText('Station ID', s.id)} disabled={blocked}>Kopyala</button>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)', display: 'grid', gap: 2 }}>
                    <div>{s.isActive ? 'Aktif' : 'Pasif'} · {label}{age}</div>
                    <div>PC: {host || '-'} · v{ver || '-'} · Agent Yazıcıları: {printersCount} · Tanımlı Kurallar: {configuredPrinters.length}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => onActivate(s.id)} disabled={blocked || s.isActive === true}>{s.isActive ? 'Aktif' : 'Aktif Yap'}</button>
                  <button className="btn" onClick={() => setRotateStationId(String(s.id))} disabled={blocked}>Secret Yenile</button>
                  <button className="btn btn--danger" onClick={() => setDeleteStationId(String(s.id))} disabled={blocked}>Sil</button>
                </div>
              </div>

              {s.isActive === true && (
                <div style={{ display: 'grid', gap: 10, padding: 12, border: '1px dashed var(--app-border, var(--border))', borderRadius: 12, background: 'var(--app-surface-2, var(--app-surface-soft))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>İstasyon Yazıcıları</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Etiket yazıcılarında kategori filtresi boşsa tüm kategoriler basılır.</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn" type="button" onClick={() => addDraft(s.id, 'label')} disabled={blocked}>Etiket Yazıcısı Ekle</button>
                      <button className="btn" type="button" onClick={() => addDraft(s.id, 'receipt')} disabled={blocked}>Fiş Yazıcısı Ekle</button>
                      <button className="btn" type="button" onClick={() => savePrinters(s.id)} disabled={blocked}>Kaydet</button>
                    </div>
                  </div>

                  {draftPrinters.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Bu istasyonda henüz yazıcı kuralı yok.</div>
                  )}

                  {draftPrinters.map((entry) => (
                    <div key={entry.id} style={{ display: 'grid', gap: 10, padding: 12, border: '1px solid var(--app-border, var(--border))', borderRadius: 10, background: 'var(--app-surface)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) 150px minmax(220px,1fr) auto auto', gap: 10, alignItems: 'end' }}>
                        <label>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kural Adı</div>
                          <input className="input" value={entry.name} onChange={(e) => updateDraft(s.id, entry.id, 'name', e.target.value)} disabled={blocked} />
                        </label>
                        <label>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tip</div>
                          <select className="input" value={entry.printerType} onChange={(e) => updateDraft(s.id, entry.id, 'printerType', e.target.value)} disabled={blocked}>
                            <option value="label">Etiket</option>
                            <option value="receipt">Fiş</option>
                          </select>
                        </label>
                        <label>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Windows Yazıcısı</div>
                          <select className="input" value={entry.windowsPrinterName} onChange={(e) => updateDraft(s.id, entry.id, 'windowsPrinterName', e.target.value)} disabled={blocked}>
                            <option value="">Seçiniz</option>
                            {(availablePrinters || []).map((printer) => <option key={printer} value={printer}>{printer}</option>)}
                          </select>
                        </label>
                        <div style={{ minWidth: 140 }}>
                          <SettingsToggle label="Aktif" checked={entry.isActive} onChange={(e) => updateDraft(s.id, entry.id, 'isActive', e.target.checked)} disabled={blocked} />
                        </div>
                        <button className="btn btn--danger" type="button" onClick={() => removeDraft(s.id, entry.id)} disabled={blocked}>Sil</button>
                      </div>

                      {entry.printerType === 'label' ? (
                        <div style={{ display: 'grid', gap: 10 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '120px 120px 120px', gap: 10 }}>
                            <label>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Genişlik</div>
                              <input className="input" value={entry.widthMm} onChange={(e) => updateDraft(s.id, entry.id, 'widthMm', e.target.value)} disabled={blocked} />
                            </label>
                            <label>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yükseklik</div>
                              <input className="input" value={entry.heightMm} onChange={(e) => updateDraft(s.id, entry.id, 'heightMm', e.target.value)} disabled={blocked} />
                            </label>
                            <label>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kopya</div>
                              <input className="input" value={entry.copies} onChange={(e) => updateDraft(s.id, entry.id, 'copies', e.target.value)} disabled={blocked} />
                            </label>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                            <SettingsToggle label="Siparişte otomatik bas" checked={entry.autoPrintOnOrder} onChange={(e) => updateDraft(s.id, entry.id, 'autoPrintOnOrder', e.target.checked)} disabled={blocked} />
                            <SettingsToggle label="Hazırda etiket bas" checked={entry.printOnReady} onChange={(e) => updateDraft(s.id, entry.id, 'printOnReady', e.target.checked)} disabled={blocked} />
                          </div>

                          <div style={{ display: 'grid', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kategori Filtresi</div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button type="button" className="btn btn--compact" onClick={() => setAllCategories(s.id, entry.id, true)} disabled={blocked || (categories || []).length === 0}>Hepsini Seç</button>
                                <button type="button" className="btn btn--compact" onClick={() => setAllCategories(s.id, entry.id, false)} disabled={blocked || (entry.labelCategoryIds || []).length === 0}>Temizle</button>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              {(categories || []).map((category) => {
                                const checked = (entry.labelCategoryIds || []).includes(String(category.id))
                                return (
                                  <button
                                    key={category.id}
                                    type="button"
                                    onClick={() => toggleCategory(s.id, entry.id, String(category.id))}
                                    disabled={blocked}
                                    style={{
                                      border: `1px solid ${checked ? 'var(--theme-accent)' : 'var(--app-border)'}`,
                                      borderRadius: 999,
                                      background: checked ? 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--app-surface-2, var(--app-surface-soft))), var(--app-surface))' : 'var(--app-surface-2, var(--app-surface-soft))',
                                      color: 'var(--app-text)',
                                      padding: '10px 14px',
                                      fontWeight: 900,
                                      boxShadow: checked ? 'var(--theme-active-glow)' : 'none',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      cursor: blocked ? 'not-allowed' : 'pointer',
                                      opacity: blocked ? 0.7 : 1,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: 999,
                                        border: `2px solid ${checked ? 'var(--theme-accent)' : 'var(--app-text-muted)'}`,
                                        background: checked ? 'var(--theme-accent)' : 'var(--app-surface)',
                                        boxShadow: checked ? 'inset 0 0 0 3px var(--app-surface)' : 'none',
                                      }}
                                    />
                                    <span>{category.name}</span>
                                  </button>
                                )
                              })}
                              {(categories || []).length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kategori listesi boş.</div>}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gap: 10 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '120px 120px', gap: 10 }}>
                            <label>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fiş Genişliği</div>
                              <input className="input" value={entry.receiptWidthMm} onChange={(e) => updateDraft(s.id, entry.id, 'receiptWidthMm', e.target.value)} disabled={blocked} />
                            </label>
                            <label>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kopya</div>
                              <input className="input" value={entry.copies} onChange={(e) => updateDraft(s.id, entry.id, 'copies', e.target.value)} disabled={blocked} />
                            </label>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(220px, 1fr)', gap: 12 }}>
                            <SettingsToggle
                              label="Kasa fişinde kullan"
                              checked={entry.useForCashierReceipt === true}
                              onChange={(e) => updateDraft(s.id, entry.id, 'useForCashierReceipt', e.target.checked)}
                              disabled={blocked}
                            />
                            <SettingsToggle
                              label="Mutfak fişinde kullan"
                              checked={entry.useForKitchenReceipt === true}
                              onChange={(e) => updateDraft(s.id, entry.id, 'useForKitchenReceipt', e.target.checked)}
                              disabled={blocked}
                            />
                          </div>

                          {entry.useForKitchenReceipt === true && (
                            <div style={{ display: 'grid', gap: 6 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <div>
                                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Mutfak kategorileri</div>
                                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kategori filtresi boşsa tüm kategoriler basılır.</div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  <button type="button" className="btn btn--compact" onClick={() => setAllCategories(s.id, entry.id, true, 'categoryIds')} disabled={blocked || (categories || []).length === 0}>Hepsini Seç</button>
                                  <button type="button" className="btn btn--compact" onClick={() => setAllCategories(s.id, entry.id, false, 'categoryIds')} disabled={blocked || (entry.categoryIds || []).length === 0}>Temizle</button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                {(categories || []).map((category) => {
                                  const checked = (entry.categoryIds || []).includes(String(category.id))
                                  return (
                                    <button
                                      key={category.id}
                                      type="button"
                                      onClick={() => toggleCategory(s.id, entry.id, String(category.id), 'categoryIds')}
                                      disabled={blocked}
                                      style={{
                                        border: `1px solid ${checked ? 'var(--theme-accent)' : 'var(--app-border)'}`,
                                        borderRadius: 999,
                                        background: checked ? 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--app-surface-2, var(--app-surface-soft))), var(--app-surface))' : 'var(--app-surface-2, var(--app-surface-soft))',
                                        color: 'var(--app-text)',
                                        padding: '10px 14px',
                                        fontWeight: 900,
                                        boxShadow: checked ? 'var(--theme-active-glow)' : 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        cursor: blocked ? 'not-allowed' : 'pointer',
                                        opacity: blocked ? 0.7 : 1,
                                      }}
                                    >
                                      <span
                                        style={{
                                          width: 18,
                                          height: 18,
                                          borderRadius: 999,
                                          border: `2px solid ${checked ? 'var(--theme-accent)' : 'var(--app-text-muted)'}`,
                                          background: checked ? 'var(--theme-accent)' : 'var(--app-surface)',
                                          boxShadow: checked ? 'inset 0 0 0 3px var(--app-surface)' : 'none',
                                        }}
                                      />
                                      <span>{category.name}</span>
                                    </button>
                                  )
                                })}
                                {(categories || []).length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kategori listesi boş.</div>}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {(stations || []).length === 0 && <div style={{ color: 'var(--muted)' }}>Henüz istasyon yok.</div>}
      </div>

      <ConfirmModal
        open={!!rotateStationId}
        onClose={() => setRotateStationId('')}
        title="Secret yenilensin mi?"
        description="Secret yenilenirse bu istasyona bağlı agent yeniden ayarlanmalıdır. Devam edilsin mi?"
        confirmText="Yenile"
        cancelText="Vazgeç"
        onConfirm={doRotate}
        confirmDisabled={blocked}
        cancelDisabled={blocked}
      />

      <ConfirmModal
        open={!!deleteStationId}
        onClose={() => setDeleteStationId('')}
        title="İstasyon silinsin mi?"
        description="Bu istasyon silinecek. İstasyonun kilitlediği joblar failed olacaktır."
        confirmText="Sil"
        cancelText="Vazgeç"
        danger
        onConfirm={doDelete}
        confirmDisabled={blocked}
        cancelDisabled={blocked}
      />

      <Modal open={secretModalOpen} onClose={closeSecretModal} title="Yeni secret">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Bu secret tek sefer gösterilir. Kaybedersen Secret Yenile'ye bas.</div>
          <div className="input" style={{ fontFamily: 'monospace', userSelect: 'all' }}>{rotatedSecret}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => copyText('Station Secret', rotatedSecret)} disabled={!rotatedSecret}>Kopyala</button>
            <button className="btn" onClick={closeSecretModal}>Kapat</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
