import React, { useEffect, useState } from 'react'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'
import ConfirmModal from '../ConfirmModal.jsx'
import Modal from '../Modal.jsx'

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
    toast.success('Kopyalandi')
  } catch {
    try { window.prompt(label, v) } catch {}
  }
}

const makeDraftPrinter = (type = 'label') => ({
  id: `tmp_${Math.random().toString(36).slice(2, 10)}`,
  name: type === 'receipt' ? 'Yeni Fis Yazicisi' : 'Yeni Etiket Yazicisi',
  printerType: type === 'receipt' ? 'receipt' : 'label',
  windowsPrinterName: '',
  isActive: true,
  labelCategoryIds: [],
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
      if (!secret) throw new Error(res?.message || 'Secret uretilemedi')
      setRotatedSecret(secret)
      setSecretModalOpen(true)
      toast.success('Secret yenilendi')
      if (typeof onReload === 'function') await onReload()
    } catch (e) {
      toast.error(e?.message || 'Secret yenileme basarisiz')
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
      toast.success('Istasyon silindi')
      if (typeof onReload === 'function') await onReload()
    } catch (e) {
      toast.error(e?.message || 'Silme basarisiz')
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
        } else {
          next.autoPrintOnOrder = true
          next.printOnReady = true
        }
      }
      return next
    }))
  }

  const toggleCategory = (stationId, id, categoryId) => {
    updateDrafts(stationId, (prev) => prev.map((entry) => {
      if (String(entry.id) !== String(id)) return entry
      const set = new Set(entry.labelCategoryIds || [])
      if (set.has(categoryId)) set.delete(categoryId)
      else set.add(categoryId)
      return { ...entry, labelCategoryIds: Array.from(set) }
    }))
  }

  const removeDraft = (stationId, id) => {
    updateDrafts(stationId, (prev) => prev.filter((entry) => String(entry.id) !== String(id)))
  }

  const addDraft = (stationId, type) => {
    updateDrafts(stationId, (prev) => [...prev, makeDraftPrinter(type)])
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800 }}>Print Station</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Istasyon bilgisayar demektir. Birden fazla istasyon ayni anda aktif olabilir ve her istasyonun altina birden fazla fis ve etiket yazicisi ekleyebilirsin.</div>
        </div>
        <button className="btn" onClick={handleCreate} disabled={blocked}>Yeni Istasyon Ekle</button>
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
                    <div>PC: {host || '-'} · v{ver || '-'} · Agent Yazicilari: {printersCount} · Tanimli Kurallar: {configuredPrinters.length}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => onActivate(s.id)} disabled={blocked || s.isActive === true}>{s.isActive ? 'Aktif' : 'Aktif Yap'}</button>
                  <button className="btn" onClick={() => setRotateStationId(String(s.id))} disabled={blocked}>Secret Yenile</button>
                  <button className="btn btn--danger" onClick={() => setDeleteStationId(String(s.id))} disabled={blocked}>Sil</button>
                </div>
              </div>

              {s.isActive === true && (
                <div style={{ display: 'grid', gap: 10, padding: 12, border: '1px dashed var(--border)', borderRadius: 12, background: 'rgba(15,23,42,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>Istasyon Yazicilari</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Etiket yazicilarinda kategori filtresi bossa tum kategoriler basilir.</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn" type="button" onClick={() => addDraft(s.id, 'label')} disabled={blocked}>Etiket Yazicisi Ekle</button>
                      <button className="btn" type="button" onClick={() => addDraft(s.id, 'receipt')} disabled={blocked}>Fis Yazicisi Ekle</button>
                      <button className="btn" type="button" onClick={() => savePrinters(s.id)} disabled={blocked}>Kaydet</button>
                    </div>
                  </div>

                  {draftPrinters.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Bu istasyonda henuz yazici kurali yok.</div>
                  )}

                  {draftPrinters.map((entry) => (
                    <div key={entry.id} style={{ display: 'grid', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: '#fff' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) 150px minmax(220px,1fr) auto auto', gap: 10, alignItems: 'end' }}>
                        <label>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kural Adi</div>
                          <input className="input" value={entry.name} onChange={(e) => updateDraft(s.id, entry.id, 'name', e.target.value)} disabled={blocked} />
                        </label>
                        <label>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tip</div>
                          <select className="input" value={entry.printerType} onChange={(e) => updateDraft(s.id, entry.id, 'printerType', e.target.value)} disabled={blocked}>
                            <option value="label">Etiket</option>
                            <option value="receipt">Fis</option>
                          </select>
                        </label>
                        <label>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Windows Yazicisi</div>
                          <select className="input" value={entry.windowsPrinterName} onChange={(e) => updateDraft(s.id, entry.id, 'windowsPrinterName', e.target.value)} disabled={blocked}>
                            <option value="">Seciniz</option>
                            {(availablePrinters || []).map((printer) => <option key={printer} value={printer}>{printer}</option>)}
                          </select>
                        </label>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center', height: 42 }}>
                          <input type="checkbox" checked={entry.isActive} onChange={(e) => updateDraft(s.id, entry.id, 'isActive', e.target.checked)} disabled={blocked} />
                          <span>Aktif</span>
                        </label>
                        <button className="btn btn--danger" type="button" onClick={() => removeDraft(s.id, entry.id)} disabled={blocked}>Sil</button>
                      </div>

                      {entry.printerType === 'label' ? (
                        <div style={{ display: 'grid', gap: 10 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '120px 120px 120px', gap: 10 }}>
                            <label>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Genislik</div>
                              <input className="input" value={entry.widthMm} onChange={(e) => updateDraft(s.id, entry.id, 'widthMm', e.target.value)} disabled={blocked} />
                            </label>
                            <label>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yukseklik</div>
                              <input className="input" value={entry.heightMm} onChange={(e) => updateDraft(s.id, entry.id, 'heightMm', e.target.value)} disabled={blocked} />
                            </label>
                            <label>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kopya</div>
                              <input className="input" value={entry.copies} onChange={(e) => updateDraft(s.id, entry.id, 'copies', e.target.value)} disabled={blocked} />
                            </label>
                          </div>

                          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input type="checkbox" checked={entry.autoPrintOnOrder} onChange={(e) => updateDraft(s.id, entry.id, 'autoPrintOnOrder', e.target.checked)} disabled={blocked} />
                              <span>Sipariste otomatik bas</span>
                            </label>
                            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input type="checkbox" checked={entry.printOnReady} onChange={(e) => updateDraft(s.id, entry.id, 'printOnReady', e.target.checked)} disabled={blocked} />
                              <span>Hazirda etiket bas</span>
                            </label>
                          </div>

                          <div style={{ display: 'grid', gap: 6 }}>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kategori Filtresi</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {(categories || []).map((category) => {
                                const checked = (entry.labelCategoryIds || []).includes(String(category.id))
                                return (
                                  <label key={category.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 999 }}>
                                    <input type="checkbox" checked={checked} onChange={() => toggleCategory(s.id, entry.id, String(category.id))} disabled={blocked} />
                                    <span>{category.name}</span>
                                  </label>
                                )
                              })}
                              {(categories || []).length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kategori listesi bos.</div>}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 120px', gap: 10 }}>
                          <label>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fis Genisligi</div>
                            <input className="input" value={entry.receiptWidthMm} onChange={(e) => updateDraft(s.id, entry.id, 'receiptWidthMm', e.target.value)} disabled={blocked} />
                          </label>
                          <label>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Kopya</div>
                            <input className="input" value={entry.copies} onChange={(e) => updateDraft(s.id, entry.id, 'copies', e.target.value)} disabled={blocked} />
                          </label>
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
        description="Secret yenilenirse bu istasyona bagli agent yeniden ayarlanmalidir. Devam edilsin mi?"
        confirmText="Yenile"
        cancelText="Vazgec"
        onConfirm={doRotate}
        confirmDisabled={blocked}
        cancelDisabled={blocked}
      />

      <ConfirmModal
        open={!!deleteStationId}
        onClose={() => setDeleteStationId('')}
        title="Istasyon silinsin mi?"
        description="Bu istasyon silinecek. Istasyonun kilitledigi joblar failed olacaktir."
        confirmText="Sil"
        cancelText="Vazgec"
        danger
        onConfirm={doDelete}
        confirmDisabled={blocked}
        cancelDisabled={blocked}
      />

      <Modal open={secretModalOpen} onClose={closeSecretModal} title="Yeni secret">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Bu secret tek sefer gosterilir. Kaybedersen Secret Yenile'ye bas.</div>
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
