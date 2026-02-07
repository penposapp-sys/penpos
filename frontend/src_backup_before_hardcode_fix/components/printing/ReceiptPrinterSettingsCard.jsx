import React from 'react'

export default function ReceiptPrinterSettingsCard({
  busy,
  agentOnline,
  agentPrinters,
  printerName,
  setPrinterName,
  widthMm,
  setWidthMm,
  active,
  setActive,
  onSave,
  onTest
}) {
  return (
    <div className="card" style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontWeight: 800 }}>Fiş Yazıcısı Ayarları</div>
      <div style={{ display: 'grid', gap: 8 }}>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fiş Yazıcını Seç</div>
          <select className="input" value={printerName} onChange={(e) => setPrinterName(e.target.value)} disabled={!agentOnline || busy}>
            <option value="">Seçiniz</option>
            {(agentPrinters || []).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fiş Genişliği (mm)</div>
          <input className="input" value={widthMm} onChange={(e) => setWidthMm(e.target.value)} placeholder="80" disabled={busy} />
        </label>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={!String(printerName || '').trim()} />
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Aktif</div>
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={onSave} disabled={busy}>Kaydet</button>
          <button className="btn" onClick={onTest} disabled={busy || !agentOnline || !String(printerName || '').trim() || active !== true}>Test Fiş Bas</button>
        </div>
      </div>
    </div>
  )
}
