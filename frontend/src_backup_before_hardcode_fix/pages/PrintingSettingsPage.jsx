import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import AutoPrintInfoCard from '../components/printing/AutoPrintInfoCard.jsx'
import LabelPrinterSettingsCard from '../components/printing/LabelPrinterSettingsCard.jsx'
import ReceiptPrinterSettingsCard from '../components/printing/ReceiptPrinterSettingsCard.jsx'
import PrintStationsCard from '../components/printing/PrintStationsCard.jsx'
import PrintJobsCard from '../components/printing/PrintJobsCard.jsx'

const mmNum = (v, fallback) => {
  const s = String(v || '').trim().replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export default function PrintingSettingsPage({ system }) {
  const sys = String(system || 'kermes') === 'canteen' ? 'canteen' : 'kermes'
  const [busy, setBusy] = useState(false)
  const [agentError, setAgentError] = useState('')
  const [agentHint, setAgentHint] = useState('')
  const [agentPrinters, setAgentPrinters] = useState([])

  const [printers, setPrinters] = useState([])
  const [profiles, setProfiles] = useState([])
  const [stations, setStations] = useState([])
  const [jobs, setJobs] = useState([])

  const [pcPrinterDownloadUrl, setPcPrinterDownloadUrl] = useState('')

  const [labelPrinterName, setLabelPrinterName] = useState('')
  const [labelActive, setLabelActive] = useState(false)
  const [labelW, setLabelW] = useState('50')
  const [labelH, setLabelH] = useState('30')

  const [receiptPrinterName, setReceiptPrinterName] = useState('')
  const [receiptActive, setReceiptActive] = useState(false)
  const [receiptWidth, setReceiptWidth] = useState('80')

  const labelProfile = useMemo(() => (profiles || []).find(p => p.code === 'label') || null, [profiles])
  const receiptProfile = useMemo(() => (profiles || []).find(p => p.code === 'receipt') || null, [profiles])

  const activeStation = useMemo(() => (stations || []).find(s => s.isActive === true) || null, [stations])
  const heartbeatAt = activeStation?.lastHeartbeatAt
  const heartbeatAgeMs = useMemo(() => {
    if (!heartbeatAt) return null
    const t = new Date(heartbeatAt).getTime()
    if (!Number.isFinite(t)) return null
    return Date.now() - t
  }, [heartbeatAt])

  const agentStatus = useMemo(() => {
    if ((stations || []).length === 0) return 'no_station'
    if (!activeStation?.id) return 'no_active_station'
    if (heartbeatAgeMs === null) return 'no_heartbeat'
    if (heartbeatAgeMs <= 15000) return 'online'
    if (heartbeatAgeMs <= 60000) return 'stale'
    return 'offline'
  }, [stations, activeStation?.id, heartbeatAgeMs])

  const agentHostname = String(activeStation?.lastHeartbeatMeta?.hostname || '').trim()
  const agentVersion = String(activeStation?.lastHeartbeatMeta?.version || '').trim()
  const agentOnline = agentStatus === 'online'

  const labelPrinter = useMemo(() => {
    const pr = printers.find(p => p.id === String(labelProfile?.printerId || ''))
    return pr || null
  }, [printers, labelProfile?.printerId])

  const receiptPrinter = useMemo(() => {
    const pr = printers.find(p => p.id === String(receiptProfile?.printerId || ''))
    return pr || null
  }, [printers, receiptProfile?.printerId])

  const loadAll = async () => {
    setBusy(true)
    try {
      const qs = `?system=${encodeURIComponent(sys)}`
      const [p1, p2, p3, p4, p5] = await Promise.all([
        api(`/api/printing/printers${qs}`, { silent: true }),
        api(`/api/printing/profiles${qs}`, { silent: true }),
        api(`/api/printing/stations${qs}`, { silent: true }),
        api(`/api/printing/jobs${qs}&limit=50`, { silent: true }),
        api('/api/settings/printers', { silent: true, skipBranchHeader: true })
      ])
      setPrinters(Array.isArray(p1?.printers) ? p1.printers : [])
      setProfiles(Array.isArray(p2?.profiles) ? p2.profiles : [])
      setStations(Array.isArray(p3?.stations) ? p3.stations : [])
      setJobs(Array.isArray(p4?.jobs) ? p4.jobs : [])
      setPcPrinterDownloadUrl(String(p5?.printAgent?.pcPrinter?.downloadUrl || '').trim())
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [sys])

  useEffect(() => {
    setAgentError('')
    if ((stations || []).length === 0) {
      setAgentHint('Önce Print Station oluşturun.')
      setAgentPrinters([])
      return
    }
    if (!activeStation?.id) {
      setAgentHint('Aktif Print Station seçin (aynı anda sadece 1 istasyon aktif olabilir).')
      setAgentPrinters([])
      return
    }

    if (agentStatus === 'no_heartbeat') {
      setAgentHint('Agent bu istasyona bağlanmamış. Agent `config.json` içine `stationId` + `stationSecret` girin ve agent’ı çalıştırın.')
    } else if (agentStatus === 'offline') {
      const sec = heartbeatAgeMs !== null ? Math.round(heartbeatAgeMs / 1000) : null
      setAgentHint(sec ? `Agent offline. Son görüldü: ${sec} sn önce` : 'Agent offline.')
    } else if (agentStatus === 'stale') {
      const sec = heartbeatAgeMs !== null ? Math.round(heartbeatAgeMs / 1000) : null
      setAgentHint(sec ? `Agent yavaşladı (stale). Son görüldü: ${sec} sn önce` : 'Agent yavaşladı (stale).')
    } else {
      setAgentHint('')
    }
    ;(async () => {
      try {
        const qs = `?system=${encodeURIComponent(sys)}`
        const res = await api(`/api/printing/stations/${encodeURIComponent(activeStation.id)}/printers${qs}`, { silent: true })
        const list = Array.isArray(res?.printers) ? res.printers.map(String).filter(Boolean) : []
        setAgentPrinters(list)
      } catch {
        setAgentPrinters([])
      }
    })()
  }, [sys, stations?.length, activeStation?.id, agentStatus, heartbeatAgeMs])

  useEffect(() => {
    if (labelProfile?.options && typeof labelProfile.options === 'object') {
      if (labelProfile.options.widthMm) setLabelW(String(labelProfile.options.widthMm))
      if (labelProfile.options.heightMm) setLabelH(String(labelProfile.options.heightMm))
    }
    setLabelActive(labelProfile?.isActive === true)
  }, [labelProfile?.id])

  useEffect(() => {
    setLabelPrinterName(String(labelPrinter?.windowsPrinterName || ''))
  }, [labelPrinter?.id])

  useEffect(() => {
    if (receiptProfile?.options && typeof receiptProfile.options === 'object') {
      if (receiptProfile.options.widthMm) setReceiptWidth(String(receiptProfile.options.widthMm))
    }
    setReceiptActive(receiptProfile?.isActive === true)
  }, [receiptProfile?.id])

  useEffect(() => {
    setReceiptPrinterName(String(receiptPrinter?.windowsPrinterName || ''))
  }, [receiptPrinter?.id])

  const upsertPrinterByName = async ({ logicalName, windowsPrinterName }) => {
    const current = (printers || []).find(p => String(p.name || '') === String(logicalName || ''))
    if (!current) {
      const res = await api('/api/printing/printers', {
        method: 'POST',
        data: { system: sys, name: logicalName, windowsPrinterName, isActive: true },
        silent: true
      })
      return res?.printer || null
    }
    const res = await api(`/api/printing/printers/${encodeURIComponent(current.id)}`, {
      method: 'PATCH',
      data: { system: sys, windowsPrinterName, isActive: true, name: logicalName },
      silent: true
    })
    return res?.printer || null
  }

  const upsertProfile = async ({ code, name, printerId, payloadType, options, isActive }) => {
    const current = (profiles || []).find(p => String(p.code || '') === String(code || ''))
    if (!current) {
      const res = await api('/api/printing/profiles', {
        method: 'POST',
        data: { system: sys, code, name, printerId, payloadType, options, isActive },
        silent: true
      })
      return res?.profile || null
    }
    const res = await api(`/api/printing/profiles/${encodeURIComponent(current.id)}`, {
      method: 'PATCH',
      data: { system: sys, code, name, printerId, payloadType, options, isActive },
      silent: true
    })
    return res?.profile || null
  }

  const saveLabel = async () => {
    const prn = String(labelPrinterName || '').trim()
    if (!prn) {
      toast.error('Etiket yazıcısı seçmelisin')
      return
    }
    setBusy(true)
    try {
      const printer = await upsertPrinterByName({ logicalName: 'Etiket Yazıcısı', windowsPrinterName: prn })
      if (!printer?.id) throw new Error('Yazıcı kaydedilemedi')
      const profile = await upsertProfile({
        code: 'label',
        name: 'Etiket',
        printerId: printer.id,
        payloadType: 'raw',
        options: { widthMm: mmNum(labelW, 50), heightMm: mmNum(labelH, 30) },
        isActive: labelActive === true
      })
      if (!profile?.id) throw new Error('Profil kaydedilemedi')
      toast.success('Etiket ayarları kaydedildi')
      await loadAll()
    } catch (e) {
      toast.error(e?.message || 'Kaydetme başarısız')
    } finally {
      setBusy(false)
    }
  }

  const saveReceipt = async () => {
    const prn = String(receiptPrinterName || '').trim()
    if (!prn) {
      toast.error('Fiş yazıcısı seçmelisin')
      return
    }
    setBusy(true)
    try {
      const printer = await upsertPrinterByName({ logicalName: 'Fiş Yazıcısı', windowsPrinterName: prn })
      if (!printer?.id) throw new Error('Yazıcı kaydedilemedi')
      const profile = await upsertProfile({
        code: 'receipt',
        name: 'Fiş',
        printerId: printer.id,
        payloadType: 'raw',
        options: { widthMm: mmNum(receiptWidth, 80) },
        isActive: receiptActive === true
      })
      if (!profile?.id) throw new Error('Profil kaydedilemedi')
      toast.success('Fiş ayarları kaydedildi')
      await loadAll()
    } catch (e) {
      toast.error(e?.message || 'Kaydetme başarısız')
    } finally {
      setBusy(false)
    }
  }

  const testLabel = async () => {
    setBusy(true)
    try {
      if (!labelProfile?.id || labelActive !== true) throw new Error('Etiket profili aktif olmalı')
      const payload = `TEST ETİKET\n${new Date().toLocaleString('tr-TR')}\n`
      const res = await api('/api/printing/jobs', {
        method: 'POST',
        data: {
          system: sys,
          type: 'label',
          profileId: String(labelProfile.id),
          payload: { type: 'raw', content: payload },
          meta: { test: true, copies: 1 }
        },
        silent: true
      })
      if (!res?.success) throw new Error(res?.message || 'Kuyruğa alınamadı')
      toast.success('Test etiket kuyruğa alındı')
    } catch (e) {
      toast.error(e?.message || 'Test baskı başarısız')
    } finally {
      setBusy(false)
    }
  }

  const testReceipt = async () => {
    setBusy(true)
    try {
      if (!receiptProfile?.id || receiptActive !== true) throw new Error('Fiş profili aktif olmalı')
      const payload = `PENPOS TEST FİŞ\n${new Date().toLocaleString('tr-TR')}\n`
      const res = await api('/api/printing/jobs', {
        method: 'POST',
        data: {
          system: sys,
          type: 'receipt',
          profileId: String(receiptProfile.id),
          payload: { type: 'raw', content: payload },
          meta: { test: true, copies: 1 }
        },
        silent: true
      })
      if (!res?.success) throw new Error(res?.message || 'Kuyruğa alınamadı')
      toast.success('Test fiş kuyruğa alındı')
    } catch (e) {
      toast.error(e?.message || 'Test baskı başarısız')
    } finally {
      setBusy(false)
    }
  }

  const createStation = async () => {
    const name = String(window.prompt('İstasyon adı', 'Print Station') || '').trim()
    if (!name) return
    setBusy(true)
    try {
      const res = await api('/api/printing/stations', { method: 'POST', data: { system: sys, name, isActive: false, assignedProfileIds: [] }, silent: true })
      if (!res?.station?.id) throw new Error(res?.message || 'İstasyon eklenemedi')
      const secret = String(res?.station?.stationSecret || '').trim()
      toast.success('İstasyon eklendi')
      await loadAll()
      return { stationId: String(res.station.id), secret }
    } catch (e) {
      toast.error(e?.message || 'İstasyon eklenemedi')
    } finally {
      setBusy(false)
    }
  }

  const setActiveStation = async (stationId) => {
    const id = String(stationId || '').trim()
    if (!id) return
    setBusy(true)
    try {
      const res = await api(`/api/printing/stations/${encodeURIComponent(id)}`, { method: 'PATCH', data: { system: sys, isActive: true }, silent: true })
      if (!res?.station?.id) throw new Error(res?.message || 'Aktifleştirme başarısız')
      toast.success('Aktif Print Station güncellendi')
      await loadAll()
    } catch (e) {
      toast.error(e?.message || 'Aktifleştirme başarısız')
    } finally {
      setBusy(false)
    }
  }

  const cancelJob = async (jobId) => {
    const id = String(jobId || '').trim()
    if (!id) return
    setBusy(true)
    try {
      const res = await api(`/api/printing/jobs/${encodeURIComponent(id)}/cancel`, { method: 'PATCH', data: { system: sys }, silent: true })
      if (!res?.success) throw new Error(res?.message || 'İptal başarısız')
      toast.success('Job iptal edildi')
      await loadAll()
    } catch (e) {
      toast.error(e?.message || 'İptal başarısız')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 800 }}>PC Yazıcı Ayarları</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Fiş ve etiket yazdırmak için bilgisayara PenPOS Yazdırma Servisi kurulmalıdır. Kurulumdan sonra yazdırma otomatik olarak çalışır.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="btn"
            type="button"
            onClick={() => {
              const url = String(pcPrinterDownloadUrl || '').trim()
              if (!url) return
              window.open(url, '_blank')
            }}
            disabled={!pcPrinterDownloadUrl}
          >
            İndir (Windows)
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Kurulumdan sonra Setup uygulamasını açıp Servisi Kur ve Başlat demeniz yeterlidir.
        </div>
      </div>

      <AutoPrintInfoCard
        busy={busy}
        status={agentStatus}
        printerCount={agentPrinters.length}
        hostname={agentHostname}
        version={agentVersion}
        lastSeenSec={heartbeatAgeMs !== null ? heartbeatAgeMs / 1000 : null}
        onReload={loadAll}
        error={agentError}
        hint={agentHint}
      />

      <LabelPrinterSettingsCard
        busy={busy}
        agentOnline={agentOnline}
        agentPrinters={agentPrinters}
        printerName={labelPrinterName}
        setPrinterName={setLabelPrinterName}
        widthMm={labelW}
        setWidthMm={setLabelW}
        heightMm={labelH}
        setHeightMm={setLabelH}
        active={labelActive}
        setActive={setLabelActive}
        onSave={saveLabel}
        onTest={testLabel}
      />

      <ReceiptPrinterSettingsCard
        busy={busy}
        agentOnline={agentOnline}
        agentPrinters={agentPrinters}
        printerName={receiptPrinterName}
        setPrinterName={setReceiptPrinterName}
        widthMm={receiptWidth}
        setWidthMm={setReceiptWidth}
        active={receiptActive}
        setActive={setReceiptActive}
        onSave={saveReceipt}
        onTest={testReceipt}
      />

      <PrintStationsCard
        busy={busy}
        system={sys}
        stations={stations}
        onCreate={createStation}
        onActivate={setActiveStation}
        onReload={loadAll}
      />

      <PrintJobsCard
        busy={busy}
        jobs={jobs}
        onCancel={cancelJob}
      />
    </div>
  )
}
